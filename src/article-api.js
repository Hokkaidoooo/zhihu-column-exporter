import { canonicalSectionUrl, parsePaidColumnUrl } from "./shared.js";

export function sourceFromArticleItem(item) {
  return item?.target || item?.article || item;
}

export function sectionIdFromArticleItem(item) {
  const source = sourceFromArticleItem(item);
  const candidateUrls = [source?.url, item?.url, source?.canonical_url, item?.canonical_url];
  for (const candidate of candidateUrls) {
    const parsed = parsePaidColumnUrl(candidate);
    if (parsed?.sectionId) return parsed.sectionId;
  }

  const candidateIds = [source?.id, item?.id];
  for (const candidate of candidateIds) {
    if (typeof candidate === "string" && /^\d+$/.test(candidate)) return candidate;
    if (Number.isSafeInteger(candidate) && candidate >= 0) return String(candidate);
  }
  return null;
}

export function normalizeColumnArticleItem(item, columnId) {
  const source = sourceFromArticleItem(item);
  const sectionId = sectionIdFromArticleItem(item);
  if (!sectionId) return { ok: false, reason: "目录文章缺少精确 ID" };

  const regularContent = typeof source?.content === "string" ? source.content.trim() : "";
  if (!regularContent) return { ok: false, sectionId, reason: "目录接口没有返回标准正文" };
  const title = String(source?.title ?? item?.title ?? `文章 ${sectionId}`).replace(/\s+/g, " ").trim();
  return {
    ok: true,
    columnId,
    sectionId,
    title: title || `文章 ${sectionId}`,
    url: canonicalSectionUrl(columnId, sectionId),
    content: regularContent,
    requiresAccessValidation: source?.content_need_truncated === true
  };
}
