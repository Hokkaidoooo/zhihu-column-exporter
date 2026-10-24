import { parsePaidColumnUrl } from "./shared.js";

export function expectedPageFromUrl(url) {
  const parsed = parsePaidColumnUrl(url);
  return {
    url: new URL(url).href,
    kind: parsed?.kind || null,
    columnId: parsed?.columnId || null,
    sectionId: parsed?.sectionId || null
  };
}

export function pageMatchesExpectation(actualUrl, expected) {
  const actual = parsePaidColumnUrl(actualUrl);
  if (expected?.kind === "section" && expected.sectionId) {
    return actual?.kind === "section"
      && actual.sectionId === expected.sectionId
      && (!expected.columnId || actual.columnId === expected.columnId);
  }
  if (expected?.kind === "catalog" && expected.columnId) {
    return actual?.kind === "catalog" && actual.columnId === expected.columnId;
  }
  try {
    const actual = new URL(actualUrl);
    const target = new URL(expected?.url || "");
    return actual.origin === target.origin
      && actual.pathname.replace(/\/+$/, "") === target.pathname.replace(/\/+$/, "");
  } catch {
    return false;
  }
}

export function assertExpectedArticleResult(result, expectedSectionId, expectedColumnId = null) {
  if (result?.ok && String(result.sectionId || "") !== String(expectedSectionId || "")) {
    throw new Error(`正文身份不匹配：预期文章 ${expectedSectionId}，实际返回 ${result.sectionId || "未知"}`);
  }
  if (result?.ok && expectedColumnId && String(result.columnId || "") !== String(expectedColumnId)) {
    throw new Error(`正文专栏不匹配：预期专栏 ${expectedColumnId}，实际返回 ${result.columnId || "未知"}`);
  }
  return result;
}
