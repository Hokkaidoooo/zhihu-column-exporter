import { canonicalSectionUrl } from "./shared.js";
import { sectionIdFromArticleItem } from "./article-api.js";

const DEFAULT_PAGE_SIZE = 20;
const DEFAULT_MAX_PAGES = 2000;
const API_ORIGINS = new Set(["https://www.zhihu.com", "https://zhuanlan.zhihu.com"]);

function nonNegativeInteger(value) {
  const number = Number(value);
  return Number.isSafeInteger(number) && number >= 0 ? number : null;
}

function normalizeApiOrigin(value) {
  const origin = String(value || "https://www.zhihu.com").replace(/\/+$/, "");
  if (!API_ORIGINS.has(origin)) throw new TypeError("目录接口域名不受信任");
  return origin;
}

function apiPath(columnId, apiOrigin) {
  return apiOrigin === "https://zhuanlan.zhihu.com"
    ? `/api/columns/${columnId}/articles`
    : `/api/v4/columns/${columnId}/articles`;
}

export function columnArticlesApiUrl(columnId, offset = 0, limit = DEFAULT_PAGE_SIZE, apiOrigin = "https://www.zhihu.com") {
  if (!/^c_\d+$/.test(String(columnId || ""))) {
    throw new TypeError("标准知乎专栏 ID 必须以 c_ 开头");
  }
  const safeOffset = nonNegativeInteger(offset);
  const safeLimit = nonNegativeInteger(limit);
  if (safeOffset === null || !safeLimit) throw new TypeError("目录分页参数无效");
  const origin = normalizeApiOrigin(apiOrigin);
  const params = new URLSearchParams({ limit: String(safeLimit), offset: String(safeOffset) });
  return `${origin}${apiPath(columnId, origin)}?${params}`;
}

function articleFromItem(item, columnId) {
  const source = item?.target || item?.article || item;
  const sectionId = sectionIdFromArticleItem(item);
  if (!sectionId) return null;
  const title = String(source?.title ?? item?.title ?? `文章 ${sectionId}`).replace(/\s+/g, " ").trim();
  return {
    sectionId,
    url: canonicalSectionUrl(columnId, sectionId),
    title: title || `文章 ${sectionId}`,
    requiresAccessProbe: source?.content_need_truncated === true
  };
}

function nextOffsetFromPaging(paging, columnId, apiOrigin, currentOffset) {
  if (!paging?.next) return { offset: null, invalid: false };
  try {
    const origin = normalizeApiOrigin(apiOrigin);
    const url = new URL(paging.next, origin);
    const expectedHost = new URL(origin).hostname;
    if (url.hostname !== expectedHost || !["http:", "https:"].includes(url.protocol) || url.pathname !== apiPath(columnId, origin)) {
      return { offset: null, invalid: true };
    }
    const offset = nonNegativeInteger(url.searchParams.get("offset"));
    return { offset: offset !== null && offset > currentOffset ? offset : null, invalid: offset === null || offset <= currentOffset };
  } catch {
    return { offset: null, invalid: true };
  }
}

export function parseColumnArticlesPage(payload, columnId, currentOffset = 0, apiOrigin = "https://www.zhihu.com") {
  const data = Array.isArray(payload?.data) ? payload.data : [];
  const links = data.map((item) => articleFromItem(item, columnId)).filter(Boolean);
  const paging = payload?.paging || {};
  const total = nonNegativeInteger(paging.totals);
  const next = nextOffsetFromPaging(paging, columnId, apiOrigin, currentOffset);
  return {
    links,
    rawItemCount: data.length,
    total,
    isEnd: paging.is_end === true,
    nextOffset: next.offset,
    invalidNext: next.invalid
  };
}

export async function fetchAllColumnArticles({
  columnId,
  requestPage,
  pageSize = DEFAULT_PAGE_SIZE,
  maxPages = DEFAULT_MAX_PAGES,
  apiOrigin = "https://www.zhihu.com",
  onPage = null
}) {
  if (typeof requestPage !== "function") throw new TypeError("requestPage 必须是函数");

  const collected = new Map();
  const visitedOffsets = new Set();
  let offset = 0;
  let expectedCount = null;

  for (let pageNumber = 1; pageNumber <= maxPages; pageNumber += 1) {
    if (visitedOffsets.has(offset)) throw new Error(`目录接口返回了重复分页位置：${offset}`);
    visitedOffsets.add(offset);

    const url = columnArticlesApiUrl(columnId, offset, pageSize, apiOrigin);
    const payload = await requestPage(url, { offset, pageNumber, pageSize });
    const page = parseColumnArticlesPage(payload, columnId, offset, apiOrigin);
    if (page.total !== null) expectedCount = page.total;
    for (const link of page.links) {
      if (!collected.has(link.sectionId)) collected.set(link.sectionId, link);
    }
    await onPage?.({
      pageNumber,
      offset,
      discoveredCount: collected.size,
      expectedCount,
      isEnd: page.isEnd
    });

    const reachedExpectedCount = expectedCount !== null && collected.size >= expectedCount;
    if (page.isEnd || reachedExpectedCount) {
      if (expectedCount !== null && collected.size !== expectedCount) {
        throw new Error(`目录接口报告 ${expectedCount} 篇，但只发现 ${collected.size} 篇`);
      }
      return {
        links: [...collected.values()],
        expectedCount: expectedCount ?? collected.size,
        pageCount: pageNumber,
        complete: true
      };
    }

    if (page.rawItemCount === 0) {
      throw new Error(`目录在第 ${pageNumber} 页提前返回空数据`);
    }
    if (page.invalidNext) throw new Error(`目录接口返回了无效的下一页地址：${offset}`);
    const fallbackOffset = offset + page.rawItemCount;
    const nextOffset = page.nextOffset ?? fallbackOffset;
    if (nextOffset <= offset) throw new Error(`目录分页没有继续前进：${offset}`);
    offset = nextOffset;
  }

  throw new Error(`目录超过 ${maxPages} 页，已停止以避免无限请求`);
}
