const WINDOWS_RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i;

export function exactNumericId(value) {
  if (typeof value === "string" && /^\d+$/.test(value)) return value;
  if (Number.isSafeInteger(value) && value >= 0) return String(value);
  return null;
}

// Preserve integer tokens before JSON.parse can round them; quoted text is untouched.
export function parseExactJsonNumbers(text) {
  const tokens = /"(?:\\.|[^"\\])*"|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/g;
  return JSON.parse(text.replace(tokens, (token, offset) => {
    if (!/^\d+$/.test(token) || Number.isSafeInteger(Number(token))) return token;
    // Do not turn an invalid unquoted numeric object key into valid JSON.
    if (/^\s*:/.test(text.slice(offset + token.length))) return token;
    return `"${token}"`;
  }));
}

export function isZhihuUrl(input) {
  try {
    return /(^|\.)zhihu\.com$/i.test(new URL(input).hostname);
  } catch {
    return false;
  }
}

export function parsePaidColumnUrl(input) {
  let url;
  try {
    url = new URL(input);
  } catch {
    return null;
  }

  if (!isZhihuUrl(url.href)) return null;

  const path = url.pathname.replace(/\/+$/, "");
  let match = path.match(/^\/column\/(c_\d+)$/);
  if (url.hostname === "www.zhihu.com" && match) {
    return { columnId: match[1], sectionId: null, kind: "catalog" };
  }

  match = path.match(/^\/p\/(\d+)$/);
  if ((url.hostname === "zhuanlan.zhihu.com" || url.hostname === "www.zhihu.com") && match) {
    return { columnId: null, sectionId: match[1], kind: "section" };
  }

  match = path.match(/^\/market\/paid_column\/(\d+)(?:\/section\/(\d+))?$/);
  if (match) {
    return {
      columnId: match[1],
      sectionId: match[2] || null,
      kind: match[2] ? "section" : "catalog"
    };
  }

  match = path.match(/^\/xen\/market\/remix\/paid_column\/(\d+)(?:\/section\/(\d+))?$/);
  if (match) {
    return {
      columnId: match[1],
      sectionId: match[2] || null,
      kind: match[2] ? "section" : "catalog"
    };
  }

  match = path.match(/(?:^|\/)paid_column\/(\d+)(?:\/section\/(\d+))?(?:\/|$)/);
  if (match) {
    return {
      columnId: match[1],
      sectionId: match[2] || null,
      kind: match[2] ? "section" : "catalog"
    };
  }

  return null;
}

export function canonicalSectionUrl(columnId, sectionId) {
  if (!/^(?:c_)?\d+$/.test(String(columnId)) || !/^\d+$/.test(String(sectionId))) {
    throw new TypeError("专栏 ID 和章节 ID 必须是数字");
  }
  if (String(columnId).startsWith("c_")) return `https://zhuanlan.zhihu.com/p/${sectionId}`;
  return `https://www.zhihu.com/market/paid_column/${columnId}/section/${sectionId}`;
}

export function sanitizeFilename(value, fallback = "未命名", maxLength = 80) {
  let output = String(value || "")
    .replace(/[\u0000-\u001f<>:"/\\|?*]/g, "_")
    .replace(/\s+/g, " ")
    .replace(/[. ]+$/g, "")
    .trim();

  if (!output) output = fallback;
  if (WINDOWS_RESERVED.test(output)) output = `_${output}`;
  return Array.from(output).slice(0, maxLength).join("");
}

export function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function padNumber(value, width = 3) {
  return String(value).padStart(width, "0");
}

export function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export function uniqueBy(items, keyOf) {
  const seen = new Set();
  return items.filter((item) => {
    const key = keyOf(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
