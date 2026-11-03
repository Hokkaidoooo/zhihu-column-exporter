import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { zipSync } from "fflate";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { EXTENSION_FILES, validateManifest } from "./manifest-policy.mjs";

const root = new URL("../", import.meta.url);
const metadata = JSON.parse(await readFile(new URL("package.json", root), "utf8"));
const manifest = JSON.parse(await readFile(new URL("extension/manifest.json", root), "utf8"));
validateManifest(manifest, metadata.version);
const files = {};
for (const name of EXTENSION_FILES) {
  files[`extension/${name}`] = new Uint8Array(await readFile(new URL(`extension/${name}`, root)));
}
for (const name of ["README.md", "DEVELOPMENT.md", "CHANGELOG.md", "install-extension.cmd", "LICENSE", "THIRD_PARTY_NOTICES.md"]) {
  files[name] = new Uint8Array(await readFile(new URL(name, root)));
}
const name = `zhihu-column-exporter-v${metadata.version}.zip`;
const bytes = zipSync(files, { level: 6 });
const digest = createHash("sha256").update(bytes).digest("hex");
const args = process.argv.slice(2);
if (args.length && (args.length !== 2 || args[0] !== "--outdir" || !args[1])) {
  throw new Error("用法：node scripts/package.mjs [--outdir 输出目录]");
}
const outdir = args.length ? path.resolve(args[1]) : fileURLToPath(new URL("dist/", root));
await mkdir(outdir, { recursive: true });
await writeFile(path.join(outdir, name), bytes);
await writeFile(path.join(outdir, "SHA256SUMS.txt"), `${digest}  ${name}\n`);
console.log(`Packaged ${path.join(outdir, name)} (${bytes.length} bytes). SHA-256: ${digest}`);
