export const EXTENSION_FILES = ["manifest.json", "background.js", "content.js", "exporter.js", "export.html", "styles.css", "LICENSE", "THIRD_PARTY_NOTICES.md"];

const REQUIRED_PERMISSIONS = ["downloads", "scripting", "tabs"];
const REQUIRED_HOSTS = ["https://www.zhihu.com/*", "https://zhuanlan.zhihu.com/*", "https://*.zhimg.com/*"];

function assertSameSet(actual, expected, field) {
  if (!Array.isArray(actual) || actual.length !== expected.length || expected.some((value) => !actual.includes(value))) {
    throw new Error(`${field} 与扩展所需的最小权限不一致`);
  }
}

export function validateManifest(manifest, version) {
  if (manifest.manifest_version !== 3) throw new Error("manifest_version 必须为 3");
  if (manifest.version !== version) throw new Error("扩展版本与 package.json 不一致");
  assertSameSet(manifest.permissions, REQUIRED_PERMISSIONS, "permissions");
  assertSameSet(manifest.host_permissions, REQUIRED_HOSTS, "host_permissions");
  if (manifest.optional_permissions?.length || manifest.optional_host_permissions?.length) {
    throw new Error("扩展不得声明额外可选权限");
  }
  const scripts = manifest.content_scripts;
  if (!Array.isArray(scripts) || scripts.length !== 1) throw new Error("content_scripts 必须只有一个配置");
  assertSameSet(scripts[0].matches, REQUIRED_HOSTS.slice(0, 2), "content_scripts.matches");
  assertSameSet(scripts[0].js, ["content.js"], "content_scripts.js");
  if (manifest.background?.service_worker !== "background.js") throw new Error("后台入口不正确");
}
