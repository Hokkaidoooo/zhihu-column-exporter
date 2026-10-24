import { readdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

let checked = 0;
for (const directory of ["src", "scripts", "tests"]) {
  const root = new URL(`../${directory}/`, import.meta.url);
  for (const name of await readdir(root)) {
    if (!/\.m?js$/.test(name)) continue;
    const result = spawnSync(process.execPath, ["--check", fileURLToPath(new URL(name, root))], { encoding: "utf8" });
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error(result.stderr || `语法检查失败：${directory}/${name}`);
    checked += 1;
  }
}
console.log(`Syntax checked ${checked} JavaScript modules.`);
