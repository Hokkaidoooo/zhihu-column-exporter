import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { validateManifest } from "../scripts/manifest-policy.mjs";

const manifest = JSON.parse(readFileSync(new URL("../static/manifest.json", import.meta.url), "utf8"));

test("当前最小权限与版本可通过成品验证", () => {
  assert.doesNotThrow(() => validateManifest(manifest, manifest.version));
});

test("拒绝含知乎字样的伪装域名和全站通配权限", () => {
  for (const host of ["https://zhihu.com.example.org/*", "https://example.org/zhimg.com/*", "<all_urls>"]) {
    assert.throws(() => validateManifest({ ...manifest, host_permissions: [...manifest.host_permissions.slice(0, 2), host] }, manifest.version), /host_permissions/);
  }
});

test("拒绝 Cookie 权限、额外可选权限与扩大注入范围", () => {
  assert.throws(() => validateManifest({ ...manifest, permissions: [...manifest.permissions, "cookies"] }, manifest.version), /permissions/);
  assert.throws(() => validateManifest({ ...manifest, optional_permissions: ["cookies"] }, manifest.version), /可选权限/);
  assert.throws(() => validateManifest({ ...manifest, content_scripts: [{ ...manifest.content_scripts[0], matches: ["<all_urls>"] }] }, manifest.version), /content_scripts.matches/);
});

test("拒绝源码和构建版本不一致", () => {
  assert.throws(() => validateManifest(manifest, "0.0.0"), /版本/);
});
