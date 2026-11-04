import {
  normalizeColumnArticleItem,
  sectionIdFromArticleItem,
  sourceFromArticleItem
} from "./article-api.js";
import { canonicalSectionUrl } from "./shared.js";

const API_ORIGINS = new Set(["https://www.zhihu.com", "https://zhuanlan.zhihu.com"]);
const ACCESS_LOCK_PATTERN = /(订阅后.{0,8}(阅读|解锁)|购买后.{0,8}阅读|立即订阅|登录后.{0,8}(查看|阅读)|试看已结束)/;

function normalizedOrigin(value) {
  const origin = String(value || "").replace(/\/+$/, "");
  if (!API_ORIGINS.has(origin)) throw new TypeError("文章接口域名不受信任");
  return origin;
}

export function articleDetailApiUrl(sectionId, apiOrigin) {
  if (!/^\d+$/.test(String(sectionId || ""))) throw new TypeError("文章 ID 必须是精确数字字符串");
  const origin = normalizedOrigin(apiOrigin);
  const path = origin === "https://zhuanlan.zhihu.com"
    ? `/api/articles/${sectionId}`
    : `/api/v4/articles/${sectionId}`;
  if (origin === "https://zhuanlan.zhihu.com") return `${origin}${path}`;
  const params = new URLSearchParams({ include: "title,content,excerpt,content_need_truncated,url" });
  return `${origin}${path}?${params}`;
}

export function normalizeArticleDetailPayload(payload, columnId, requestedSectionId) {
  const sectionId = String(requestedSectionId || "");
  if (!/^\d+$/.test(sectionId)) return { ok: false, reason: "请求的文章 ID 无效" };
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { ok: false, sectionId, reason: "文章接口返回了无效数据" };
  }
  if (payload.error) {
    return { ok: false, sectionId, reason: payload.error.message || "文章接口拒绝访问" };
  }

  const responseSectionId = sectionIdFromArticleItem(payload);
  if (responseSectionId && responseSectionId !== sectionId) {
    return { ok: false, sectionId, reason: `文章接口身份不匹配：实际返回 ${responseSectionId}` };
  }

  const source = sourceFromArticleItem(payload);
  const content = typeof source?.content === "string" ? source.content : "";
  if (content.length < 8000 && ACCESS_LOCK_PATTERN.test(content)) {
    return { ok: false, sectionId, accessDenied: true, reason: "文章接口只返回了权限占位内容" };
  }
  if (source?.content_need_truncated === true) {
    return {
      ok: false,
      sectionId,
      truncated: true,
      reason: "文章接口标记正文已被知乎截断，只返回试看片段"
    };
  }
  const safeItem = {
    url: canonicalSectionUrl(columnId, sectionId),
    title: source?.title,
    content,
    content_need_truncated: false
  };
  return normalizeColumnArticleItem(safeItem, columnId);
}

export async function fetchArticleDetail({
  sectionId,
  columnId,
  apiOrigin,
  credentials = "include",
  request = fetch
}) {
  let response;
  try {
    response = await request(articleDetailApiUrl(sectionId, apiOrigin), {
      credentials,
      cache: "no-store",
      headers: { Accept: "application/json" }
    });
  } catch (error) {
    return { ok: false, sectionId, retryable: true, reason: error?.message || String(error) };
  }

  if (response.status === 401 || response.status === 403) {
    return {
      ok: false,
      sectionId,
      accessDenied: true,
      status: response.status,
      reason: `文章接口返回 HTTP ${response.status}`
    };
  }
  if (response.status === 429 || response.status >= 500) {
    return {
      ok: false,
      sectionId,
      retryable: true,
      status: response.status,
      reason: `文章接口返回 HTTP ${response.status}`
    };
  }
  if (!response.ok) {
    return { ok: false, sectionId, status: response.status, reason: `文章接口返回 HTTP ${response.status}` };
  }

  const contentType = String(response.headers?.get?.("content-type") || "").toLowerCase();
  if (!contentType.includes("application/json")) {
    return { ok: false, sectionId, reason: "文章接口没有返回 JSON" };
  }
  let payload;
  try {
    payload = await response.json();
  } catch {
    return { ok: false, sectionId, reason: "文章接口 JSON 无法解析" };
  }
  return normalizeArticleDetailPayload(payload, columnId, sectionId);
}
