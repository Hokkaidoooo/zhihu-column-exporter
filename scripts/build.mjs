import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const outdir = new URL("../extension/", import.meta.url);
const staticDir = new URL("../static/", import.meta.url);

await rm(outdir, { recursive: true, force: true });
await mkdir(outdir, { recursive: true });

await build({
  entryPoints: {
    background: fileURLToPath(new URL("../src/background.js", import.meta.url)),
    content: fileURLToPath(new URL("../src/content.js", import.meta.url)),
    exporter: fileURLToPath(new URL("../src/exporter.js", import.meta.url))
  },
  outdir: fileURLToPath(outdir),
  bundle: true,
  format: "iife",
  target: ["chrome120"],
  legalComments: "eof",
  minify: false,
  sourcemap: false
});

await cp(staticDir, outdir, { recursive: true });
const notices = ["# Third-party licenses", "", "Bundled dependency licenses are reproduced below.", ""];
for (const name of ["fflate", "lucide", "turndown", "turndown-plugin-gfm"]) {
  const dependencyRoot = new URL(`../node_modules/${name}/`, import.meta.url);
  const metadata = JSON.parse(await readFile(new URL("package.json", dependencyRoot), "utf8"));
  const license = await readFile(new URL("LICENSE", dependencyRoot), "utf8");
  notices.push(`## ${name} ${metadata.version} (${metadata.license})`, "", "```text", license.trim(), "```", "");
}
await writeFile(new URL("../THIRD_PARTY_NOTICES.md", import.meta.url), notices.join("\n"));
await writeFile(new URL("THIRD_PARTY_NOTICES.md", outdir), notices.join("\n"));
await cp(new URL("../LICENSE", import.meta.url), new URL("LICENSE", outdir));
console.log("Built extension/");
