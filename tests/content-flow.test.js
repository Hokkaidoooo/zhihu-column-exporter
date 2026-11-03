import test from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { fileURLToPath } from "node:url";
import { runInContext } from "node:vm";
import { JSDOM } from "jsdom";

const bundle = build({ entryPoints: [fileURLToPath(new URL("../src/content.js", import.meta.url))], bundle: true, format: "iife", platform: "browser", write: false })
  .then((result) => result.outputFiles[0].text);

async function fixture(t, request) {
  const dom = new JSDOM(`<h1>合成文章</h1><a href="https://www.zhihu.com/column/c_100">所属专栏</a><article class="RichText"><p>${"合成正文内容。".repeat(100)}</p></article>`, {
    url: "https://zhuanlan.zhihu.com/p/201", runScripts: "outside-only"
  });
  t.after(() => dom.window.close());
  const listeners = [];
  const context = dom.getInternalVMContext();
  context.AbortController = AbortController;
  context.fetch = request || (() => { throw new Error("本测试不允许网络请求"); });
  context.chrome = { runtime: { onMessage: { addListener: (fn) => listeners.push(fn) } } };
  const script = await bundle;
  runInContext(script, context);
  return {
    dom,
    injectAgain() { runInContext(script, context); },
    get listenerCount() { return listeners.length; },
    send(message) {
      return new Promise((resolve, reject) => {
        const result = listeners[0]({ taskId: "test-task", ...message }, {}, resolve);
        if (result === false && !["PROBE_ARTICLE", "CANCEL_OPERATION"].includes(message.type)) reject(new Error("Unhandled test message"));
      });
    }
  };
}

test("重复注入只保留一个消息监听器，探针和提取使用同一正文", async (t) => {
  const f = await fixture(t);
  f.injectAgain();
  assert.equal(f.listenerCount, 1);
  const probe = await f.send({ type: "PROBE_ARTICLE" });
  const article = await f.send({ type: "EXTRACT_ARTICLE", settled: true, fingerprint: probe.fingerprint });
  assert.equal(article.ok, true);
  assert.equal(article.sectionId, "201");
});

test("探针通过后正文再次变化，提取明确失败并可重新校验", async (t) => {
  const f = await fixture(t);
  const before = await f.send({ type: "PROBE_ARTICLE" });
  f.dom.window.document.querySelector("p").textContent = "更新正文内容。".repeat(100);
  const stale = await f.send({ type: "EXTRACT_ARTICLE", settled: true, fingerprint: before.fingerprint });
  assert.equal(stale.ok, false);
  assert.match(stale.reason, /发生变化/);
  const current = await f.send({ type: "PROBE_ARTICLE" });
  const fresh = await f.send({ type: "EXTRACT_ARTICLE", settled: true, fingerprint: current.fingerprint });
  assert.equal(fresh.ok, true);
});

test("停止消息按任务身份中断正文请求，不影响另一个导出任务", async (t) => {
  const signals = [];
  const f = await fixture(t, (_url, options) => { signals.push(options.signal); return new Promise(() => {}); });
  const first = f.send({ type: "EXTRACT_API_ARTICLE", columnId: "c_100", sectionId: "201" });
  const second = f.send({ type: "EXTRACT_API_ARTICLE", taskId: "other-task", columnId: "c_100", sectionId: "202" });
  await f.send({ type: "CANCEL_OPERATION" });
  assert.equal((await first).ok, false);
  assert.equal(signals[0].aborted, true);
  assert.equal(signals[1].aborted, false);
  await f.send({ type: "CANCEL_OPERATION", taskId: "other-task" });
  assert.equal((await second).ok, false);
});

test("目录 HTTP 404 不滚动重抓也不重试永久错误", async (t) => {
  let calls = 0;
  const f = await fixture(t, async () => { calls++; return new Response("missing", { status: 404 }); });
  const result = await f.send({ type: "DISCOVER_COLUMN" });
  assert.equal(result.ok, false);
  assert.match(result.reason, /404/);
  assert.equal(calls, 1);
});
