import test from "node:test";
import assert from "node:assert/strict";
import { createImageCache, archiveImages, downloadImage, validateImage, localizeArticleImages } from "../src/images.js";
import { JSDOM } from "jsdom";
import { requestResource, httpError } from "../src/request.js";
import { delay, abortError } from "../src/cancellation.js";
import { createArchive } from "../src/archive.js";
import { unzipSync, strFromU8 } from "fflate";

test("同图跨文章只下载一次，任务全局最多四路", async () => {
  const articles = Array.from({ length: 12 }, (_, i) => ({ images: [{ url: `https://example.invalid/${i % 8}.png` }] }));
  let active = 0;
  let peak = 0;
  let calls = 0;
  const written = [];
  const results = await archiveImages(articles, { add: async (path) => written.push(path) }, {
    cache: createImageCache(),
    download: async () => {
      calls++;
      active++;
      peak = Math.max(peak, active);
      await delay(2);
      active--;
      return { bytes: new Uint8Array([1, 2]), extension: "png" };
    }
  });
  assert.equal(calls, 8);
  assert.equal(peak, 4);
  assert.equal(results.size, 8);
  assert.equal(written.length, 8);
});

test("图片缓存有明确字节上限并按最近使用淘汰，零容量可关闭", () => {
  const cache = createImageCache(4);
  const item = { bytes: new Uint8Array(2), extension: "png" };
  cache.set("a", item); cache.set("b", item); cache.get("a"); cache.set("c", item);
  assert.equal(cache.get("b"), undefined);
  assert.equal(cache.bytes, 4);
  cache.set("large", { bytes: new Uint8Array(5) });
  assert.equal(cache.get("large"), undefined);
  const disabled = createImageCache(0); disabled.set("a", item);
  assert.equal(disabled.bytes, 0);
  assert.throws(() => createImageCache(-1), /非负/);
});

test("SVG 保留静态公式，拒绝脚本、外部资源和动态链接改写", async (t) => {
  const dom = new JSDOM("");
  t.after(() => dom.window.close());
  const previous = globalThis.DOMParser;
  globalThis.DOMParser = dom.window.DOMParser;
  t.after(() => { if (previous) globalThis.DOMParser = previous; else delete globalThis.DOMParser; });
  const svg = (body, attributes = "") => new TextEncoder().encode(`<svg xmlns="http://www.w3.org/2000/svg" ${attributes}>${body}</svg>`);
  const valid = svg('<defs><path id="x" d="M0 0 L1 1"/></defs><use href="#x" style="fill: black"/>');
  assert.equal((await validateImage(valid, "image/svg+xml")).extension, "svg");
  for (const unsafe of [
    svg('<script>alert(1)</script>'), svg('<foreignObject/>'), svg('<path onload="alert(1)"/>'),
    svg('<image href="https://example.invalid/image.png"/>'),
    svg('<use href="#x"><set attributeName="href" to="https://example.invalid/x"/></use>'),
    svg('<path style="fill: url(https://example.invalid/x)"/>'),
    svg('<path style="fill: u\\72l(https://example.invalid/x)"/>'),
    svg('<use href="#x"/>', 'xml:base="https://example.invalid/"'),
    new TextEncoder().encode('<?xml-stylesheet href="https://example.invalid/x"?>' + new TextDecoder().decode(valid))
  ]) await assert.rejects(validateImage(unsafe, "image/svg+xml"), /SVG/);
});

test("图片原始链接中的括号与空格可正确写入 Markdown", () => {
  const token = "__ZHIHU_EXPORT_IMAGE_0__";
  const article = { images: [{ placeholder: token, url: "https://example.invalid/a(b c).png" }], markdown: `![image](${token})`, html: `<img src="${token}">` };
  const result = localizeArticleImages(article);
  assert.equal(result.markdown, "![image](https://example.invalid/a%28b%20c%29.png)");
  assert.equal(result.html, '<img src="https://example.invalid/a(b c).png">');
});

test("图片重试只下载未成功资源，已停止时仍可写入成功缓存", async () => {
  const cache = createImageCache();
  const articles = [{ images: [{ url: "a" }, { url: "b" }] }];
  const calls = [];
  let first = true;
  const options = { cache, download: async (url) => {
    calls.push(url);
    if (url === "b" && first) throw new Error("synthetic unavailable");
    return { bytes: new Uint8Array([1]), extension: "png" };
  } };
  await archiveImages(articles, { add: async () => {} }, options);
  first = false;
  const retry = await archiveImages(articles, { add: async () => {} }, options);
  assert.deepEqual(calls, ["a", "b", "b"]);
  assert.ok([...retry.values()].every((item) => item.ok));
  const controller = new AbortController(); controller.abort(abortError());
  const stopped = await archiveImages(articles, { add: async () => {} }, { ...options, signal: controller.signal });
  assert.ok([...stopped.values()].every((item) => item.ok));
  assert.deepEqual(calls, ["a", "b", "b"]);
});

test("图片 HTTP 404 只请求一次，HTTP 200 HTML 显式失败", async () => {
  let calls = 0;
  await assert.rejects(downloadImage("https://example.invalid/a", { request: async () => { calls++; return new Response("missing", { status: 404 }); } }), /HTTP 404/);
  assert.equal(calls, 1);
  await assert.rejects(downloadImage("https://example.invalid/a", { request: async () => new Response("<html>登录</html>", { headers: { "content-type": "text/html" } }) }), /不是图片/);
});

test("图片不仅检查文件头，解码失败也不得当成成功", async () => {
  const bytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  await assert.rejects(validateImage(bytes, "image/png", async () => { throw new Error("truncated"); }), /无法解码/);
});

test("请求超时覆盖响应体读取，停止能够中断无响应请求", async () => {
  let timedSignal;
  await assert.rejects(requestResource("synthetic", {
    timeoutMs: 10,
    request: async (_url, options) => { timedSignal = options.signal; return {}; },
    read: () => new Promise(() => {})
  }), /未完成/);
  assert.equal(timedSignal.aborted, true);
  const controller = new AbortController();
  const request = requestResource("synthetic", { signal: controller.signal, request: () => new Promise(() => {}), read: (value) => value });
  controller.abort(abortError());
  await assert.rejects(request, { name: "AbortError" });
});

test("响应体连接中断可重试，HTTP 拒绝保持永久失败，Retry-After 有上限", async () => {
  await assert.rejects(requestResource("synthetic", { request: async () => ({}), read: async () => { throw new TypeError("body stream failed"); } }), { retryable: true });
  assert.equal(httpError(new Response(null, { status: 403 })).retryable, false);
  const limited = httpError(new Response(null, { status: 429, headers: { "retry-after": "120" } }));
  assert.equal(limited.retryable, true);
  assert.equal(limited.retryAfterMs, 60000);
});

test("停止图片下载后不会启动剩余网络任务，已有成功资源仍能保存", async () => {
  const controller = new AbortController();
  let calls = 0;
  const results = await archiveImages(Array.from({ length: 8 }, (_, i) => ({ images: [{ url: `https://example.invalid/${i}` }] })), { add: async () => {} }, {
    signal: controller.signal,
    download: async () => { calls++; controller.abort(abortError()); throw abortError(); }
  });
  assert.equal(calls, 1);
  assert.equal(results.size, 8);
  assert.ok([...results.values()].every((result) => !result.ok));
});

test("流式 ZIP 保留原始图片字节、正文可解压、分片让出主线程", async () => {
  let yields = 0;
  const archive = createArchive({ yieldControl: async () => { yields++; } });
  const image = Uint8Array.from({ length: 180000 }, (_, i) => i % 251);
  const text = "合成正文".repeat(40000);
  await Promise.all([archive.add("assets/image.png", image, { compress: false }), archive.add("articles/a.md", text)]);
  const bytes = new Uint8Array(await (await archive.finish()).arrayBuffer());
  const files = unzipSync(bytes);
  assert.deepEqual(files["assets/image.png"], image);
  assert.equal(strFromU8(files["articles/a.md"]), text);
  assert.equal(new DataView(bytes.buffer).getUint16(8, true), 0, "图片 ZIP 条目采用 STORE");
  assert.ok(yields >= 10);
});

test("ZIP 拒绝重复文件路径，错误不能被后续文件掩盖", async () => {
  const archive = createArchive({ yieldControl: async () => {} });
  await archive.add("a", "first");
  await assert.rejects(archive.add("a", "second"), /重复/);
  await assert.rejects(archive.finish(), /重复/);
});
