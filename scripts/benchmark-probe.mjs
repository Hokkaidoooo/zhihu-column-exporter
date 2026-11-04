import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";
import { createArticleProbe } from "../src/article-probe.js";
import { probeArticleDocument } from "../src/content-core.js";

const mode = process.argv[2];
if (!mode) {
  const results = [];
  for (let round = 0; round < 3; round++) {
    for (const name of ["full", "cached"]) {
      const result = spawnSync(process.execPath, ["--expose-gc", fileURLToPath(import.meta.url), name], { encoding: "utf8" });
      if (result.error) throw result.error;
      if (result.status !== 0) throw new Error(result.stderr || "Probe benchmark failed");
      results.push(JSON.parse(result.stdout));
    }
  }
  console.log(JSON.stringify({ scope: "Synthetic DOM readiness sampling only; not total browser RAM or live Zhihu export speed.", results }, null, 2));
} else {
  assert.ok(["full", "cached"].includes(mode));
  const paragraphs = Array.from({ length: 150 }, (_, i) => `<p>合成段落 ${i} ${"正文内容用于验证采样开销。".repeat(40)}</p>`).join("");
  const navigation = Array.from({ length: 300 }, (_, i) => `<a href="/question/${i + 1}">合成链接</a>`).join("");
  const dom = new JSDOM(`<h1>合成性能样本</h1><a href="https://www.zhihu.com/column/c_100">专栏</a>${navigation}<article class="RichText">${paragraphs}</article>`, { url: "https://zhuanlan.zhihu.com/p/201" });
  let scans = 0;
  const reader = createArticleProbe(dom.window.document, { enabled: mode === "cached", probe: (...args) => { scans++; return probeArticleDocument(...args); } });
  globalThis.gc();
  const startHeap = process.memoryUsage().heapUsed;
  let peakHeap = startHeap;
  const cpu = process.cpuUsage();
  const start = performance.now();
  let fingerprint = "";
  const samples = 60;
  for (let i = 0; i < samples; i++) {
    if (i === 30) dom.window.document.querySelector("article p").firstChild.data += "真实变化";
    const current = reader.read(dom.window.location.href);
    assert.equal(current.ok, true);
    if (i === 30) assert.notEqual(current.fingerprint, fingerprint);
    fingerprint = current.fingerprint;
    peakHeap = Math.max(peakHeap, process.memoryUsage().heapUsed);
  }
  const elapsedMs = performance.now() - start;
  const usedCpu = process.cpuUsage(cpu);
  reader.release();
  globalThis.gc();
  console.log(JSON.stringify({ mode, samples, fullScans: scans, elapsedMs: Math.round(elapsedMs), cpuMs: Math.round((usedCpu.user + usedCpu.system) / 1000), peakHeapGrowthBytes: Math.max(0, peakHeap - startHeap), retainedHeapGrowthBytes: Math.max(0, process.memoryUsage().heapUsed - startHeap) }));
  dom.window.close();
}
