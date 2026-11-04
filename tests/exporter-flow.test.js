import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { runInContext } from "node:vm";
import { build } from "esbuild";
import { JSDOM, VirtualConsole } from "jsdom";
import * as fflate from "fflate";

// Synthetic fixtures exercise the real exporter and ZIP code without a browser
// account, external requests, user data, or writes to disk.
const SOURCE_URL = "https://www.zhihu.com/market/paid_column/100";
const IMAGE_URL = "https://pic1.zhimg.com/synthetic-export-test.png";
const IMAGE_PLACEHOLDER = "__ZHIHU_EXPORT_IMAGE_TEST__";
const PNG_BYTES = new Uint8Array(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a0xsAAAAASUVORK5CYII=", "base64"));
const realSetTimeout = setTimeout;
const realClearTimeout = clearTimeout;
const htmlPromise = readFile(new URL("../static/export.html", import.meta.url), "utf8");
const bundlePromise = build({
  entryPoints: [fileURLToPath(new URL("../src/exporter.js", import.meta.url))],
  bundle: true,
  format: "iife",
  platform: "browser",
  external: ["fflate"],
  target: ["chrome120"],
  write: false
}).then((result) => result.outputFiles[0].text);

async function waitUntil(predicate, label) {
  const deadline = Date.now() + 5000;
  while (!predicate()) {
    if (Date.now() >= deadline) throw new Error(`等待测试状态超时：${label}`);
    await new Promise((resolve) => realSetTimeout(resolve, 1));
  }
}

function articleFor(link, images) {
  return {
    ...link,
    ok: true,
    columnId: "100",
    markdown: `合成正文 ${link.sectionId}${images ? `\n![测试图片](${IMAGE_PLACEHOLDER})` : ""}`,
    html: `<p>合成正文 ${link.sectionId}</p>${images ? `<img src="${IMAGE_PLACEHOLDER}" alt="测试图片">` : ""}`,
    images: images ? [{ placeholder: IMAGE_PLACEHOLDER, url: IMAGE_URL, alt: "测试图片" }] : [],
    discovered: []
  };
}

async function createFixture(t, { count = 1, images = false, downloadError = null, catalogComplete = true, api = false } = {}) {
  const errors = [];
  const console = new VirtualConsole();
  console.on("jsdomError", (error) => errors.push(error));
  const dom = new JSDOM(await htmlPromise, {
    url: "https://extension.invalid/export.html?tabId=1",
    runScripts: "outside-only",
    virtualConsole: console
  });
  const context = dom.getInternalVMContext();
  const columnId = api ? "c_100" : "100";
  const sourceUrl = api ? "https://www.zhihu.com/column/c_100" : SOURCE_URL;
  const links = Array.from({ length: count }, (_, index) => {
    const sectionId = String(201 + index);
    return { sectionId, title: `合成章节 ${index + 1}`, url: api ? `https://zhuanlan.zhihu.com/p/${sectionId}` : `${SOURCE_URL}/section/${sectionId}` };
  });
  const tabs = new Map([[1, { id: 1, url: sourceUrl, title: "合成测试专栏 - 知乎", status: "complete" }]]);
  const heldRequests = new Map();
  const timers = new Set();
  const blobs = new Map();
  const downloads = [];
  const downloadListeners = new Set();
  const downloadStates = new Map();
  let finishDownloads = true;
  let fetchHandler = null;
  let apiHandler = null;
  let tabHook = async () => {};
  let createdTabs = 0;
  let peakTabs = 0;
  const missingTabCalls = [];
  const apiCalls = [];
  const extractCalls = [];
  const fetchCalls = [];
  const createdBlobs = [];
  let nextTabId = 10;
  let clock = Date.UTC(2026, 0, 1);
  let mode = { stopAfter: null, blocked: new Set(), failed: new Set() };
  let imageStatus = 503;

  class FixtureDate extends Date {
    constructor(...args) { super(...(args.length ? args : [clock])); }
    static now() { return clock; }
  }
  context.Date = FixtureDate;
  context.Blob = Blob;
  context.AbortController = AbortController;
  context.TextDecoder = TextDecoder;
  // jsdom does not decode images; real-browser smoke covers browser decoding.
  context.createImageBitmap = async (blob) => {
    assert.deepEqual(new Uint8Array(await blob.arrayBuffer()), PNG_BYTES);
    return { close() {} };
  };
  context.require = (name) => {
    assert.equal(name, "fflate", "Only the real ZIP library may be external");
    return fflate;
  };
  context.setTimeout = (callback, milliseconds = 0, ...args) => {
    if (milliseconds < 20000) clock += milliseconds;
    const id = realSetTimeout(() => {
      timers.delete(id);
      callback(...args);
    }, milliseconds >= 20000 ? milliseconds : 0);
    timers.add(id);
    return id;
  };
  context.clearTimeout = (id) => { timers.delete(id); realClearTimeout(id); };
  context.URL.createObjectURL = (blob) => {
    const id = `blob:synthetic-fixture-${createdBlobs.length + 1}`;
    blobs.set(id, blob);
    createdBlobs.push(blob);
    return id;
  };
  context.URL.revokeObjectURL = (id) => blobs.delete(id);
  context.fetch = async (url, options) => {
    assert.ok(url.startsWith(IMAGE_URL), "Fixture forbids external requests");
    fetchCalls.push(url);
    if (fetchHandler) return fetchHandler(url, options);
    return new Response(imageStatus === 200 ? PNG_BYTES : "synthetic unavailable", {
      status: imageStatus,
      headers: { "content-type": "image/png" }
    });
  };

  function tabById(id) {
    const tab = tabs.get(id);
    if (!tab) {
      missingTabCalls.push(id);
      throw new Error(`No tab with id: ${id}.`);
    }
    return tab;
  }

  function article(link) {
    const result = articleFor(link, images);
    if (api) {
      result.columnId = columnId;
      result.html += `<p>${"合成完整正文内容。".repeat(100)}</p>`;
      result.markdown += "合成完整正文内容。".repeat(100);
    }
    return result;
  }

  function completeDownload(id, state = "complete", error) {
    downloadStates.set(id, { id, state, error });
    for (const listener of downloadListeners) listener({ id, state: { current: state }, ...(error ? { error: { current: error } } : {}) });
  }

  async function sendMessage(id, message) {
    await tabHook({ type: message.type, id });
    const tab = tabById(id);
    if (message.type === "CANCEL_OPERATION") return { ok: true };
    if (message.type === "DISCOVER_COLUMN") {
      return { ok: true, columnId, columnTitle: "合成测试专栏", catalogComplete, expectedCount: catalogComplete ? links.length : null, articleApiAvailable: api, links };
    }
    if (message.type === "PROBE_ARTICLE_API") return { ok: true, anonymousDenied: true, apiOrigin: "https://www.zhihu.com", article: article(links[0]) };
    if (message.type === "EXTRACT_API_ARTICLE") {
      apiCalls.push(message.sectionId);
      return apiHandler ? apiHandler(message.sectionId) : article(links.find((item) => item.sectionId === message.sectionId));
    }
    const sectionId = tab.url.split("/").at(-1);
    const link = links.find((item) => item.sectionId === sectionId);
    assert.ok(link, `Unexpected article tab URL: ${tab.url}`);
    if (message.type === "PROBE_ARTICLE") {
      if (mode.blocked.has(sectionId)) {
        return new Promise((resolve, reject) => { heldRequests.set(id, { resolve, reject }); });
      }
      return { ok: true, sectionId, fingerprint: `synthetic-stable-${sectionId}` };
    }
    assert.equal(message.type, "EXTRACT_ARTICLE", "Unexpected content-script request");
    extractCalls.push(sectionId);
    if (mode.failed.has(sectionId)) return { ok: false, sectionId, reason: "合成测试正文暂时不可用" };
    if (mode.stopAfter === sectionId) context.setTimeout(() => dom.window.document.querySelector("#stop-button").click(), 0);
    return article(link);
  }

  context.chrome = {
    tabs: {
      get: async (id) => ({ ...tabById(id) }),
      create: async ({ url }) => {
        await tabHook({ type: "before-create", id: nextTabId });
        const tab = { id: nextTabId++, url, status: "complete" };
        tabs.set(tab.id, tab);
        createdTabs += 1;
        peakTabs = Math.max(peakTabs, tabs.size - 1);
        await tabHook({ type: "created", id: tab.id });
        return { ...tab };
      },
      update: async (id, update) => {
        await tabHook({ type: "update", id, url: update.url });
        const tab = tabById(id);
        Object.assign(tab, update);
        return { ...tab };
      },
      remove: async (id) => {
        tabs.delete(id);
        const held = heldRequests.get(id);
        heldRequests.delete(id);
        if (held) held.reject(new Error("Synthetic tab closed by stop"));
      },
      sendMessage
    },
    scripting: {
      executeScript: async ({ target }) => { tabById(target.tabId); }
    },
    downloads: {
      onChanged: { addListener(fn) { downloadListeners.add(fn); }, removeListener(fn) { downloadListeners.delete(fn); } },
      search: async ({ id }) => [downloadStates.get(id)].filter(Boolean),
      download: async (options) => {
        const blob = blobs.get(options.url);
        assert.ok(blob, "Download must receive the real generated ZIP blob");
        const bytes = new Uint8Array(await blob.arrayBuffer());
        downloads.push({ ...options, files: fflate.unzipSync(bytes) });
        if (downloadError) throw new Error(downloadError);
        const id = downloads.length;
        downloadStates.set(id, { id, state: "in_progress" });
        if (finishDownloads) completeDownload(id);
        return id;
      }
    }
  };

  t.after(() => {
    for (const id of timers) realClearTimeout(id);
    timers.clear();
    blobs.clear();
    dom.window.close();
  });
  runInContext(await bundlePromise, context, { filename: "real-exporter-bundle.js" });
  await waitUntil(() => !dom.window.document.querySelector("#start-button").disabled, "初始化");

  const element = (id) => dom.window.document.querySelector(`#${id}`);
  return {
    links, downloads, extractCalls, fetchCalls, createdBlobs, errors, element, apiCalls,
    setFetch(fn) { fetchHandler = fn; },
    setApi(fn) { apiHandler = fn; },
    setTabHook(fn) { tabHook = fn; },
    loseTab(id) { tabs.delete(id); },
    tabStats() { return { created: createdTabs, peak: peakTabs, missing: [...missingTabCalls] }; },
    setAutoFinishDownloads(value) { finishDownloads = value; },
    completeDownload,
    downloadListenerCount() { return downloadListeners.size; },
    configure(next) { mode = { stopAfter: null, blocked: new Set(), failed: new Set(), ...next }; },
    setImageStatus(status) { imageStatus = status; },
    temporaryTabCount() { return tabs.size - 1; },
    async act(id) {
      assert.equal(element(id).disabled, false, `Button ${id} should be enabled`);
      element(id).click();
      await waitUntil(() => !dom.window.document.body.classList.contains("is-running"), id);
      assert.deepEqual(errors, [], "Exporter must not emit unhandled DOM errors");
    }
  };
}

function archiveInfo(download) {
  return JSON.parse(fflate.strFromU8(download.files["export-info.json"]));
}

for (const lossStage of ["update", "PROBE_ARTICLE", "EXTRACT_ARTICLE"]) {
  test(`工作标签页在 ${lossStage} 消失后重建并完整导出，后续文章不复用失效 ID`, async (t) => {
    const f = await createFixture(t, { count: 16 });
    let lost = null;
    f.setTabHook(({ type, id }) => {
      if (type === lossStage && lost === null) {
        lost = id;
        f.loseTab(id);
      }
    });
    await f.act("start-button");
    const info = archiveInfo(f.downloads[0]);
    assert.equal(info.complete, true);
    assert.equal(info.articleCount, f.links.length);
    assert.deepEqual([...f.extractCalls].sort(), f.links.map((link) => link.sectionId).sort());
    assert.equal(f.tabStats().created, 5);
    assert.equal(f.tabStats().missing.filter((id) => id === lost).length, 1);
    assert.equal(f.tabStats().peak, 4);
    assert.equal(f.temporaryTabCount(), 0);
    assert.match(f.element("activity-log").textContent, /标签页.*重新创建/);
  });
}

test("重建标签页失败时停止领取新文章，保存已完成正文及全部未完成清单", async (t) => {
  const f = await createFixture(t, { count: 40 });
  let lost = false;
  f.setTabHook(({ type, id, url }) => {
    if (type === "update" && url.endsWith("/205") && !lost) {
      lost = true;
      f.loseTab(id);
    }
    if (type === "before-create" && lost) throw new Error("Synthetic tab creation denied");
  });
  await f.act("start-button");
  const info = archiveInfo(f.downloads[0]);
  assert.equal(lost, true);
  assert.equal(info.complete, false);
  assert.ok(info.articleCount > 0 && info.articleCount < 12);
  assert.equal(info.articleCount + info.failureCount, f.links.length);
  assert.match(f.element("error-message").textContent, /无法创建.*标签页/);
  assert.equal(f.tabStats().created, 4);
  assert.equal(f.temporaryTabCount(), 0);
});

test("标签页反复消失时有恢复次数上限，不逐篇耗尽整份目录", async (t) => {
  const f = await createFixture(t, { count: 40 });
  f.setTabHook(({ type, id }) => { if (type === "update") f.loseTab(id); });
  await f.act("start-button");
  assert.equal(f.downloads.length, 0);
  assert.ok(f.tabStats().created <= 12);
  assert.match(f.element("error-message").textContent, /标签页.*反复关闭/);
  assert.equal(f.temporaryTabCount(), 0);
});

test("重建返回前点击停止会关闭晚到的新标签页，保留部分结果且不恢复执行", async (t) => {
  const f = await createFixture(t, { count: 40 });
  let lost = false;
  let stopped = false;
  f.setTabHook(({ type, id, url }) => {
    if (type === "update" && url.endsWith("/205") && !lost) {
      lost = true;
      f.loseTab(id);
    }
    if (type === "created" && lost) {
      stopped = true;
      f.element("stop-button").click();
    }
  });
  await f.act("start-button");
  assert.equal(stopped, true);
  const info = archiveInfo(f.downloads[0]);
  assert.equal(info.complete, false);
  assert.ok(info.articleCount >= 1);
  assert.equal(info.articleCount + info.failureCount, f.links.length);
  assert.equal(f.tabStats().created, 5);
  assert.equal(f.temporaryTabCount(), 0);
});

test("单篇接口失败明确转正常页面，其他接口成功文章无需重读", async (t) => {
  const fixture = await createFixture(t, { count: 8, api: true });
  fixture.setApi((sectionId) => {
    if (sectionId === "204") return { ok: false, reason: "合成正文被截断" };
    return { ...articleFor(fixture.links.find((link) => link.sectionId === sectionId), false), columnId: "c_100" };
  });
  await fixture.act("start-button");
  assert.equal(archiveInfo(fixture.downloads[0]).complete, true);
  assert.deepEqual(fixture.extractCalls, ["201", "204"]);
  assert.match(fixture.element("activity-log").textContent, /合成正文被截断/);
  assert.equal(fixture.temporaryTabCount(), 0);
});

test("停止后真实 ZIP 包含所有尚未尝试文章并允许重试", async (t) => {
  const fixture = await createFixture(t, { count: 6 });
  fixture.configure({ stopAfter: "201", blocked: new Set(fixture.links.slice(1).map((link) => link.sectionId)) });
  await fixture.act("start-button");
  assert.equal(fixture.downloads.length, 1);
  const info = archiveInfo(fixture.downloads[0]);
  assert.equal(info.complete, false);
  assert.equal(info.articleCount, 1);
  assert.equal(info.failureCount, 5);
  assert.deepEqual(info.failures.map((item) => item.sectionId), ["202", "203", "204", "205", "206"]);
  assert.ok(info.failures.every((item) => item.reason.includes("用户停止")));
  const missing = fflate.strFromU8(fixture.downloads[0].files["未导出章节.txt"]);
  for (const link of fixture.links.slice(1)) assert.ok(missing.includes(link.url));
  assert.equal(fixture.element("retry-button").hidden, false);
  assert.equal(fixture.element("failed-count").textContent, "5");
  assert.equal(fixture.temporaryTabCount(), 0);
});

test("重试补回文章后连续失败熔断仍保存包含新文章的新 ZIP", async (t) => {
  const fixture = await createFixture(t, { count: 14 });
  fixture.configure({ stopAfter: "201", blocked: new Set(fixture.links.slice(1).map((link) => link.sectionId)) });
  await fixture.act("start-button");
  assert.equal(archiveInfo(fixture.downloads[0]).articleCount, 1);
  fixture.configure({ failed: new Set(fixture.links.slice(2).map((link) => link.sectionId)) });
  await fixture.act("retry-button");
  assert.equal(fixture.downloads.length, 2);
  const info = archiveInfo(fixture.downloads[1]);
  assert.equal(info.articleCount, 2);
  assert.deepEqual(info.articles.map((item) => item.sectionId), ["201", "202"]);
  assert.equal(info.failureCount, 12);
  assert.equal(info.complete, false);
  assert.match(fixture.element("error-message").textContent, /连续 \d+ 篇页面提取失败/);
  const chapter = Object.entries(fixture.downloads[1].files).find(([name]) => name.startsWith("articles/002-"));
  assert.ok(chapter, "Newly recovered article must be in the new ZIP");
  assert.match(fflate.strFromU8(chapter[1]), /合成正文 202/);
  assert.equal(fixture.temporaryTabCount(), 0);
});

test("图片 HTTP 503 被写入真实 ZIP 的失败清单且不报告完整", async (t) => {
  const fixture = await createFixture(t, { images: true });
  await fixture.act("start-button");
  const download = fixture.downloads[0];
  const info = archiveInfo(download);
  assert.equal(fixture.fetchCalls.length, 3);
  assert.equal(info.failureCount, 0);
  assert.equal(info.imageFailureCount, 1);
  assert.equal(info.imageCount, 0);
  assert.equal(info.complete, false);
  assert.equal(info.imageFailures[0].url, IMAGE_URL);
  assert.equal(info.imageFailures[0].reason, "HTTP 503");
  assert.match(fflate.strFromU8(download.files["未下载图片.txt"]), /HTTP 503/);
  assert.ok(!Object.keys(download.files).some((name) => name.startsWith("assets/")));
  assert.match(fixture.element("activity-log").textContent, /图片未下载/);
  assert.equal(fixture.element("retry-button").hidden, false);
});

test("只有图片失败时重试重新生成完整 ZIP 且不重复读取已成功文章", async (t) => {
  const fixture = await createFixture(t, { images: true });
  await fixture.act("start-button");
  fixture.setImageStatus(200);
  await fixture.act("retry-button");
  assert.equal(fixture.downloads.length, 2);
  assert.deepEqual(fixture.extractCalls, ["201"]);
  const download = fixture.downloads[1];
  const info = archiveInfo(download);
  assert.equal(info.complete, true);
  assert.equal(info.imageCount, 1);
  assert.equal(info.imageFailureCount, 0);
  assert.equal(info.failureCount, 0);
  assert.ok(!download.files["未下载图片.txt"]);
  assert.deepEqual(download.files["assets/001/01.png"], PNG_BYTES);
  assert.equal(fixture.element("retry-button").hidden, true);
});

test("保存被取消只发起一次下载并保留当前 ZIP 供再次保存", async (t) => {
  const fixture = await createFixture(t, { downloadError: "合成测试：用户取消保存" });
  await fixture.act("start-button");
  assert.equal(fixture.downloads.length, 1);
  assert.equal(fixture.createdBlobs.length, 1);
  assert.equal(archiveInfo(fixture.downloads[0]).articleCount, 1);
  assert.equal(fixture.element("error-message").hidden, false);
  assert.match(fixture.element("error-message").textContent, /用户取消保存/);
  assert.equal(fixture.element("save-again-button").hidden, false);
});

test("全部文章成功时真实 ZIP 的目录顺序与完成标记一致", async (t) => {
  const fixture = await createFixture(t, { count: 3 });
  await fixture.act("start-button");
  const download = fixture.downloads[0];
  const info = archiveInfo(download);
  assert.equal(info.complete, true);
  assert.equal(info.partial, false);
  assert.equal(info.articleCount, 3);
  assert.deepEqual(info.articles.map((item) => item.sectionId), ["201", "202", "203"]);
  assert.equal(info.failureCount, 0);
  assert.equal(info.imageFailureCount, 0);
  assert.ok(download.files["index.html"]);
  assert.equal(Object.keys(download.files).filter((name) => name.startsWith("articles/")).length, 3);
  assert.equal(Object.keys(download.files).filter((name) => name.startsWith("html/")).length, 3);
  assert.ok(!download.files["未导出章节.txt"]);
  assert.equal(fixture.element("state-label").textContent, "全部导出完成");
  assert.equal(fixture.temporaryTabCount(), 0);
});

test("同一图片跨篇复用一个文件，再次整理复用成功缓存", async (t) => {
  const f = await createFixture(t, { count: 3, images: true });
  f.setImageStatus(200);
  await f.act("start-button");
  assert.equal(f.fetchCalls.length, 1);
  assert.equal(Object.keys(f.downloads[0].files).filter((name) => name.startsWith("assets/")).length, 1);
  for (const [name, bytes] of Object.entries(f.downloads[0].files)) {
    if (name.startsWith("html/")) assert.match(fflate.strFromU8(bytes), /\.\.\/assets\/001\/01.png/);
  }
  await f.act("start-button");
  assert.equal(f.fetchCalls.length, 1);
});

test("HTTP 200 的 HTML 错误页不能进入图片或完整结果", async (t) => {
  const f = await createFixture(t, { images: true });
  f.setFetch(async () => new Response("<html>登录页</html>", { headers: { "content-type": "text/html" } }));
  await f.act("start-button");
  const info = archiveInfo(f.downloads[0]);
  assert.equal(info.complete, false);
  assert.equal(info.imageFailureCount, 1);
  assert.equal(f.fetchCalls.length, 1);
  assert.equal(info.imageCount, 0);
});

test("目录总量未知只保存已发现文章，不能宣称全量完成", async (t) => {
  const f = await createFixture(t, { count: 3, catalogComplete: null });
  await f.act("start-button");
  const info = archiveInfo(f.downloads[0]);
  assert.equal(info.complete, false);
  assert.equal(info.expectedArticleCount, null);
  assert.match(fflate.strFromU8(f.downloads[0].files["README.md"]), /目录完整性尚未确认/);
  assert.equal(f.element("state-label").textContent, "已保存部分结果");
});

test("图片阶段停止会中断请求并保存明确的部分结果", async (t) => {
  const f = await createFixture(t, { count: 3, images: true });
  let signal;
  f.setFetch((_url, options) => { signal = options.signal; return new Promise(() => {}); });
  const running = f.act("start-button");
  await waitUntil(() => signal, "图片请求启动");
  f.element("stop-button").click();
  await running;
  assert.equal(signal.aborted, true);
  assert.equal(f.fetchCalls.length, 1);
  const info = archiveInfo(f.downloads[0]);
  assert.equal(info.complete, false);
  assert.equal(info.articleCount, 3);
  assert.equal(info.imageFailureCount, 3);
});

test("运行中固定格式选项，不产生指向不存在文件的目录", async (t) => {
  const f = await createFixture(t, { count: 3, images: true });
  f.element("format-markdown").checked = false;
  let release;
  f.setFetch(() => new Promise((resolve) => { release = () => resolve(new Response(PNG_BYTES, { headers: { "content-type": "image/png" } })); }));
  const running = f.act("start-button");
  await waitUntil(() => release, "图片等待");
  assert.equal(f.element("format-html").disabled, true);
  f.element("format-html").checked = false;
  f.element("format-markdown").checked = true;
  release();
  await running;
  const files = f.downloads[0].files;
  assert.equal(Object.keys(files).filter((name) => name.startsWith("html/")).length, 3);
  assert.equal(Object.keys(files).filter((name) => name.startsWith("articles/")).length, 0);
  const readme = fflate.strFromU8(files["README.md"]);
  for (const match of readme.matchAll(/\]\(([^)]+)\)/g)) assert.ok(files[decodeURIComponent(match[1])]);
});

test("下载启动后等待浏览器写入完成，中断时保留再次保存入口", async (t) => {
  const f = await createFixture(t);
  f.setAutoFinishDownloads(false);
  const running = f.act("start-button");
  await waitUntil(() => f.downloads.length === 1, "下载启动");
  assert.equal(f.element("state-label").textContent, "正在保存文件");
  assert.equal(f.element("start-button").disabled, true);
  f.completeDownload(1, "interrupted", "FILE_NO_SPACE");
  await running;
  assert.match(f.element("error-message").textContent, /FILE_NO_SPACE/);
  assert.equal(f.element("save-again-button").hidden, false);
  assert.equal(f.downloadListenerCount(), 0);
  f.setAutoFinishDownloads(true);
  f.element("save-again-button").click();
  await waitUntil(() => f.element("state-label").textContent === "压缩包已保存", "再次保存完成");
  assert.equal(f.downloads.length, 2);
  assert.equal(f.element("error-message").hidden, true);
  assert.equal(f.downloadListenerCount(), 0);
});

test("API 校验文章复用，后续单篇任务连续调度且最多四路", async (t) => {
  const f = await createFixture(t, { count: 9, api: true });
  let active = 0;
  let peak = 0;
  let releaseSlow;
  const slow = new Promise((resolve) => { releaseSlow = resolve; });
  f.setApi(async (sectionId) => {
    active++;
    peak = Math.max(peak, active);
    if (sectionId === "202") await slow;
    if (sectionId === "209") releaseSlow();
    active--;
    return { ...articleFor(f.links.find((link) => link.sectionId === sectionId), false), columnId: "c_100" };
  });
  await f.act("start-button");
  assert.equal(archiveInfo(f.downloads[0]).complete, true);
  assert.deepEqual(f.extractCalls, ["201"]);
  assert.ok(!f.apiCalls.includes("201"));
  assert.equal(f.apiCalls.length, 8);
  assert.ok(peak <= 4);
});

for (const status of [401, 403, 429]) {
  test(`正文接口 HTTP ${status} 停止领取新任务并保存部分结果，不换页面继续抓取`, async (t) => {
    const f = await createFixture(t, { count: 40, api: true, images: true });
    f.setApi(() => ({ ok: false, status, accessDenied: status !== 429, reason: `HTTP ${status}` }));
    await f.act("start-button");
    const info = archiveInfo(f.downloads[0]);
    assert.equal(info.complete, false);
    assert.equal(info.articleCount, 1);
    assert.equal(info.failureCount, 39);
    assert.ok(f.apiCalls.length <= 4);
    assert.equal(f.fetchCalls.length, 0);
    assert.deepEqual(f.extractCalls, ["201"]);
    assert.match(f.element("source-method").textContent, /限制了当前访问/);
    assert.equal(f.temporaryTabCount(), 0);
  });
}

test("逐篇读取原因不会被最近结果四十条上限挤掉", async (t) => {
  const f = await createFixture(t, { count: 45 });
  await f.act("start-button");
  assert.equal(f.element("activity-log").children.length, 40);
  assert.match(f.element("source-method").textContent, /当前来源页没有可用的正文接口/);
});
