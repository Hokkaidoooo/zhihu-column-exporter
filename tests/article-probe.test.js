import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { createArticleProbe } from "../src/article-probe.js";
import { probeArticleDocument } from "../src/content-core.js";

function fixture(t, options = {}) {
  const dom = new JSDOM(`<h1>合成正文</h1><a href="https://www.zhihu.com/column/c_100">所属专栏</a><article class="RichText"><p>${"原始正文。".repeat(500)}</p><img src="https://example.org/a.png"></article>`, { url: "https://zhuanlan.zhihu.com/p/201" });
  let scans = 0;
  const document = dom.window.document;
  const probe = createArticleProbe(document, { ...options, probe: (...args) => { scans++; return probeArticleDocument(...args); } });
  t.after(() => { probe.release(); dom.window.close(); });
  return { dom, document, probe, read: () => probe.read(dom.window.location.href), scans: () => scans };
}

test("稳定页面重复采样只扫描一次，关闭缓存时每次重新扫描", (t) => {
  const f = fixture(t);
  const before = f.read();
  for (let i = 0; i < 20; i++) assert.deepEqual(f.read(), before);
  assert.equal(f.scans(), 1);
  const uncached = fixture(t, { enabled: false });
  uncached.read(); uncached.read();
  assert.equal(uncached.scans(), 2);
});

test("同一轮事件内等长文字、图片和公式变化必须立即作废缓存", (t) => {
  const f = fixture(t);
  let before = f.read().fingerprint;
  f.document.querySelector("p").firstChild.data = "更新正文。".repeat(500);
  assert.notEqual(f.read().fingerprint, before);
  before = f.read().fingerprint;
  f.document.querySelector("img").setAttribute("src", "https://example.org/b.png");
  assert.notEqual(f.read().fingerprint, before);
  before = f.read().fingerprint;
  f.document.querySelector("p").setAttribute("data-tex", "x^2");
  assert.notEqual(f.read().fingerprint, before);
});

test("正文外出现权限控件时缓存失效，移除后才重新就绪", (t) => {
  const f = fixture(t);
  assert.equal(f.read().ok, true);
  const lock = f.document.createElement("button");
  lock.textContent = "立即订阅";
  f.document.body.append(lock);
  assert.equal(f.read().ok, false);
  lock.remove();
  assert.equal(f.read().ok, true);
});

test("正文节点替换、SPA 地址变化和 currentSrc 变化不会复用旧结果", (t) => {
  const f = fixture(t);
  const before = f.read();
  const replacement = f.document.querySelector("article").cloneNode(true);
  replacement.querySelector("p").textContent = "新的正文。".repeat(500);
  f.document.querySelector("article").replaceWith(replacement);
  assert.notEqual(f.read().fingerprint, before.fingerprint);
  f.dom.window.history.replaceState({}, "", "/p/202");
  assert.equal(f.read().sectionId, "202");
  const previous = f.read().fingerprint;
  Object.defineProperty(replacement.querySelector("img"), "currentSrc", { value: "https://example.org/c.png", configurable: true });
  assert.notEqual(f.read().fingerprint, previous);
});

test("释放后停止观察并丢弃缓存，下一次读取重新校验", (t) => {
  const f = fixture(t);
  f.read();
  f.probe.release();
  f.read();
  assert.equal(f.scans(), 2);
});
