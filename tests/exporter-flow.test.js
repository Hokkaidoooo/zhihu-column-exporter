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
const PNG_BYTES = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
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

async function createFixture(t, { count = 1, images = false, downloadError = null } = {}) {
  const errors = [];
  const console = new VirtualConsole();
  console.on("jsdomError", (error) => errors.push(error));
  const dom = new JSDOM(await htmlPromise, {
    url: "https://extension.invalid/export.html?tabId=1",
    runScripts: "outside-only",
    virtualConsole: console
  });
  const context = dom.getInternalVMContext();
  const links = Array.from({ length: count }, (_, index) => {
    const sectionId = String(201 + index);
    return { sectionId, title: `合成章节 ${index + 1}`, url: `${SOURCE_URL}/section/${sectionId}` };
  });
  const tabs = new Map([[1, { id: 1, url: SOURCE_URL, title: "合成测试专栏 - 知乎", status: "complete" }]]);
  const heldRequests = new Map();
  const timers = new Set();
  const blobs = new Map();
  const downloads = [];
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
  context.require = (name) => {
    assert.equal(name, "fflate", "Only the real ZIP library may be external");
    return fflate;
  };
  context.setTimeout = (callback, milliseconds = 0, ...args) => {
    clock += milliseconds;
    const id = realSetTimeout(() => {
      timers.delete(id);
      callback(...args);
    }, 0);
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
  context.fetch = async (url) => {
    assert.equal(url, IMAGE_URL, "Fixture forbids external requests");
    fetchCalls.push(url);
    return new Response(imageStatus === 200 ? PNG_BYTES : "synthetic unavailable", {
      status: imageStatus,
      headers: { "content-type": "image/png" }
    });
  };

  function tabById(id) {
    const tab = tabs.get(id);
    if (!tab) throw new Error(`Synthetic tab ${id} is closed`);
    return tab;
  }

  async function sendMessage(id, message) {
    const tab = tabById(id);
    if (message.type === "PING") return { ok: true };
    if (message.type === "DISCOVER_COLUMN") {
      return { ok: true, columnId: "100", columnTitle: "合成测试专栏", catalogComplete: true, expectedCount: links.length, links };
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
    if (mode.stopAfter === sectionId) dom.window.document.querySelector("#stop-button").click();
    return articleFor(link, images);
  }

  context.chrome = {
    tabs: {
      get: async (id) => ({ ...tabById(id) }),
      create: async ({ url }) => {
        const tab = { id: nextTabId++, url, status: "complete" };
        tabs.set(tab.id, tab);
        return { ...tab };
      },
      update: async (id, update) => {
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
      download: async (options) => {
        const blob = blobs.get(options.url);
        assert.ok(blob, "Download must receive the real generated ZIP blob");
        const bytes = new Uint8Array(await blob.arrayBuffer());
        downloads.push({ ...options, files: fflate.unzipSync(bytes) });
        if (downloadError) throw new Error(downloadError);
        return downloads.length;
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
    links, downloads, extractCalls, fetchCalls, createdBlobs, errors, element,
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
