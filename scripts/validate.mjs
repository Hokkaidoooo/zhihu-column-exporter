import { access, readFile } from "node:fs/promises";
import { EXTENSION_FILES, validateManifest } from "./manifest-policy.mjs";

const root = new URL("../extension/", import.meta.url);
for (const name of EXTENSION_FILES) {
  await access(new URL(name, root));
}

const manifest = JSON.parse(await readFile(new URL("manifest.json", root), "utf8"));
const metadata = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
validateManifest(manifest, metadata.version);
const sourceManifest = JSON.parse(await readFile(new URL("../static/manifest.json", import.meta.url), "utf8"));
if (JSON.stringify(manifest) !== JSON.stringify(sourceManifest)) throw new Error("成品 manifest 与源配置不一致");

console.log("Validated extension manifest and output files.");
