import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { zipSync } from "fflate";
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
const outdir = new URL("dist/", root);
await mkdir(outdir, { recursive: true });
await writeFile(new URL(name, outdir), bytes);
await writeFile(new URL("SHA256SUMS.txt", outdir), `${digest}  ${name}\n`);
console.log(`Packaged dist/${name} (${bytes.length} bytes). SHA-256: ${digest}`);
