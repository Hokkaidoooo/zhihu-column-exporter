import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { build } from "esbuild";
import { unzipSync, strFromU8, zlibSync } from "fflate";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";

const root = fileURLToPath(new URL("../", import.meta.url));
const baseline = "7dd4ee28325d8600d78f10e8a47f7c7a3a96df4d";
const old = await build({
  entryPoints: ["baseline:exporter.js"], bundle: true, platform: "browser", format: "iife", write: false,
  plugins: [{ name: "git-baseline", setup(builder) {
    builder.onResolve({ filter: /^baseline:/ }, (args) => ({ path: args.path.slice(9), namespace: "baseline" }));
    builder.onResolve({ filter: /^\./, namespace: "baseline" }, (args) => ({ path: path.posix.join(path.posix.dirname(args.importer), args.path), namespace: "baseline" }));
    builder.onLoad({ filter: /.*/, namespace: "baseline" }, (args) => ({ contents: execFileSync("git", ["show", `${baseline}:src/${args.path}`], { cwd: root, encoding: "utf8" }), resolveDir: path.join(root, "src") }));
  } }]
});
const html = (await readFile(new URL("../static/export.html", import.meta.url), "utf8")).replace('<script src="exporter.js" defer>', '<script src="harness.js" defer></script><script src="exporter.js" defer>');
const harness = await readFile(new URL("../tests/fixtures/browser-harness.js", import.meta.url));
const stats = new Map();
const results = [];
const errors = [];

function png(width) {
  const crc = (bytes) => { let value = 0xffffffff; for (const byte of bytes) { value ^= byte; for (let bit = 0; bit < 8; bit++) value = (value >>> 1) ^ ((value & 1) ? 0xedb88320 : 0); } return (value ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => { const output = Buffer.alloc(data.length + 12); output.writeUInt32BE(data.length); output.write(type, 4); Buffer.from(data).copy(output, 8); output.writeUInt32BE(crc(output.subarray(4, -4)), output.length - 4); return output; };
  const raw = Buffer.alloc(width * (width * 3 + 1));
  let seed = 517;
  for (let i = 0; i < raw.length; i++) { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; raw[i] = seed & 255; }
  for (let row = 0; row < width; row++) raw[row * (width * 3 + 1)] = 0;
  const header = Buffer.alloc(13); header.writeUInt32BE(width); header.writeUInt32BE(width, 4); header[8] = 8; header[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", header), chunk("IDAT", zlibSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}
const small = png(64);
const large = png(256);
const body = async (request) => { const chunks = []; for await (const chunk of request) chunks.push(chunk); return Buffer.concat(chunks); };

const server = createServer(async (request, response) => {
  const url = new URL(request.url, "http://127.0.0.1");
  const run = url.searchParams.get("run") || "current";
  const scenario = url.searchParams.get("scenario") || "normal";
  const key = `${run}:${scenario}`;
  response.setHeader("Cache-Control", "no-store");
  try {
    if (url.pathname === "/") {
      stats.delete(key);
      response.setHeader("Content-Type", "text/html; charset=utf-8");
      response.setHeader("Content-Security-Policy", "default-src 'self'; script-src 'self'; object-src 'none'; img-src 'self' blob: data:; connect-src 'self' blob:");
      response.end(html.replace('src="exporter.js"', `src="exporter.js?run=${run}"`));
    } else if (url.pathname === "/harness.js") {
      response.setHeader("Content-Type", "text/javascript"); response.end(harness);
    } else if (url.pathname === "/exporter.js") {
      response.setHeader("Content-Type", "text/javascript"); response.end(run === "baseline" ? old.outputFiles[0].contents : await readFile(new URL("../extension/exporter.js", import.meta.url)));
    } else if (url.pathname === "/styles.css") {
      response.setHeader("Content-Type", "text/css"); response.end(await readFile(new URL("../static/styles.css", import.meta.url)));
    } else if (url.pathname.startsWith("/image/")) {
      const current = stats.get(key) || { requests: 0, active: 0, peak: 0 };
      current.requests++; current.active++; current.peak = Math.max(current.peak, current.active); stats.set(key, current);
      await new Promise((resolve) => setTimeout(resolve, 100));
      current.active--;
      response.setHeader("Content-Type", scenario === "bad-image" ? "text/html" : "image/png");
      response.end(scenario === "bad-image" ? "<html>synthetic login</html>" : scenario === "large" ? large : small);
    } else if (url.pathname === "/result") {
      const bytes = await body(request);
      const files = unzipSync(bytes);
      const info = JSON.parse(strFromU8(files["export-info.json"]));
      assert.equal(info.articleCount, 24);
      assert.equal(info.complete, !["bad-image", "unknown"].includes(scenario));
      const assets = Object.keys(files).filter((name) => name.startsWith("assets/"));
      const expectedImages = scenario === "bad-image" ? 0 : run === "baseline" ? 24 : 12;
      assert.equal(assets.length, expectedImages);
      for (const name of assets) assert.deepEqual(Buffer.from(files[name]), scenario === "large" ? large : small);
      for (const [name, data] of Object.entries(files)) {
        if (!name.startsWith("html/")) continue;
        const text = strFromU8(data);
        assert.doesNotMatch(text, /__ZHIHU_EXPORT_IMAGE_/);
        for (const match of text.matchAll(/src="\.\.\/([^"]+)"/g)) assert.ok(files[match[1]], `Missing asset ${match[1]}`);
      }
      const bundle = run === "baseline" ? old.outputFiles[0].contents : await readFile(new URL("../extension/exporter.js", import.meta.url));
      const bundleSha256 = createHash("sha256").update(bundle).digest("hex");
      const row = { run, scenario, bundleSha256, elapsedMs: Math.round(Number(url.searchParams.get("elapsed"))), peakTabs: Number(url.searchParams.get("peakTabs")), imageRequests: stats.get(key)?.requests || 0, peakImageRequests: stats.get(key)?.peak || 0, zipBytes: bytes.length, articles: info.articleCount, images: assets.length, complete: info.complete, verified: true };
      results.push(row); console.log(JSON.stringify(row)); response.end("verified");
    } else if (url.pathname === "/error") {
      const error = (await body(request)).toString(); errors.push({ run, scenario, error }); console.error(error); response.end("recorded");
    } else if (url.pathname === "/results") {
      response.setHeader("Content-Type", "application/json"); response.end(JSON.stringify({ results, errors }, null, 2));
    } else { response.writeHead(404); response.end("Not found"); }
  } catch (error) {
    errors.push({ run, scenario, error: error.message }); console.error(error.message); response.writeHead(500); response.end(error.message);
  }
});
server.listen(0, "127.0.0.1", () => console.log(`Browser smoke: http://127.0.0.1:${server.address().port}/?tabId=1`));
