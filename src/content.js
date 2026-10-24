import TurndownService from "turndown";
import { gfm } from "turndown-plugin-gfm";
import { fetchArticleDetail } from "./article-detail-api.js";
import { waitForArticleExtraction } from "./article-readiness.js";
import { extractColumnArticleItem } from "./cached-article.js";
import { fetchAllColumnArticles } from "./catalog-api.js";
import { mapWithConcurrency } from "./concurrency.js";
import { detectPageTitle, extractArticleDocument, extractColumnLinks, inferPaidColumnInfo, probeArticleDocument } from "./content-core.js";
import { retryOperation } from "./retry.js";
import { sleep } from "./shared.js";

const turndown = new TurndownService({
  headingStyle: "atx",
  bulletListMarker: "-",
  codeBlockStyle: "fenced",
  emDelimiter: "*"
});
turndown.use(gfm);

function visible(element) {
  const rect = element.getBoundingClientRect();
  const style = getComputedStyle(element);
  return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
}

async function clickMatchingButtons(pattern) {
  const candidates = [...document.querySelectorAll("button,[role='button']")]
    .filter(visible)
    .filter((element) => pattern.test((element.textContent || "").trim()));
  for (const element of candidates.slice(0, 4)) {
    element.click();
    await sleep(250);
  }
}

async function scrollElement(element, maximumSteps = 18, onStep = null, delayMs = 220) {
  let unchanged = 0;
  let previousHeight = 0;
  for (let step = 0; step < maximumSteps && unchanged < 5; step += 1) {
    const height = element === document.scrollingElement ? document.documentElement.scrollHeight : element.scrollHeight;
    if (height === previousHeight) unchanged += 1;
    else unchanged = 0;
    previousHeight = height;
    element.scrollTo?.({ top: height, behavior: "instant" });
    await sleep(delayMs);
    if (onStep) await onStep();
  }
}

async function preparePage(mode, onStep = null) {
  if (mode === "discover") {
    await clickMatchingButtons(/^(目录|全部章节|全部文章|查看全部|查看更多|加载更多|展开目录)$/);
  }

  const scrollables = [...document.querySelectorAll("main,aside,div,section")]
    .filter((element) => visible(element) && element.clientHeight > 180 && element.scrollHeight > element.clientHeight * 1.3)
    .filter((element) => element.querySelector('[class*="ChapterItem"],a[href*="/market/paid_column/"],a[href*="zhuanlan.zhihu.com/p/"],a[href^="/p/"]'))
    .slice(0, 3);

  const delayMs = mode === "discover" ? 420 : 220;
  for (const element of scrollables) await scrollElement(element, 24, onStep, delayMs);
  await scrollElement(document.scrollingElement || document.documentElement, mode === "discover" ? 36 : 14, onStep, delayMs);
  await sleep(500);
}

async function discoverPage() {
  let pageInfo = inferPaidColumnInfo(document, location.href);
  const collected = new Map();
  const collect = async () => {
    pageInfo = pageInfo || inferPaidColumnInfo(document, location.href);
    if (!pageInfo?.columnId) return;
    for (const link of extractColumnLinks(document, location.href, pageInfo.columnId)) {
      if (!collected.has(link.sectionId)) collected.set(link.sectionId, link);
    }
    await clickMatchingButtons(/^(查看更多|加载更多)$/);
  };

  let catalogComplete = null;
  let expectedCount = null;
  let discoveryError = "";
  if (/^c_\d+$/.test(String(pageInfo?.columnId || ""))) {
    try {
      const apiResult = await fetchAllColumnArticles({
        columnId: pageInfo.columnId,
        apiOrigin: location.hostname === "zhuanlan.zhihu.com"
          ? "https://zhuanlan.zhihu.com"
          : "https://www.zhihu.com",
        requestPage: async (url) => retryOperation(async () => {
          const response = await fetch(url, {
            credentials: "include",
            cache: "no-store",
            headers: { Accept: "application/json" }
          });
          if (!response.ok) throw new Error(`目录接口返回 HTTP ${response.status}`);
          const payload = await response.json();
          if (payload?.error) throw new Error(payload.error.message || "目录接口拒绝访问");
          return payload;
        }, { attempts: 3, delays: [500, 1400] }),
        onPage: async () => sleep(80)
      });
      for (const link of apiResult.links) collected.set(link.sectionId, link);
      catalogComplete = apiResult.complete;
      expectedCount = apiResult.expectedCount;
    } catch (error) {
      catalogComplete = false;
      discoveryError = error?.message || String(error);
    }
  }

  if (catalogComplete) {
    return {
      ok: true,
      columnId: pageInfo.columnId,
      sectionId: pageInfo.sectionId,
      columnTitle: detectPageTitle(document),
      pageUrl: location.href,
      links: [...collected.values()],
      catalogComplete,
      expectedCount,
      discoveryError,
      articleApiAvailable: true
    };
  }

  await collect();
  await preparePage("discover", collect);
  await collect();
  if (!pageInfo) return { ok: false, reason: "当前页面中没有发现付费专栏目录或章节信息" };
  const links = [...collected.values()];
  return {
    ok: true,
    columnId: pageInfo.columnId,
    sectionId: pageInfo.sectionId,
    columnTitle: detectPageTitle(document),
    pageUrl: location.href,
    links,
    catalogComplete,
    expectedCount,
    discoveryError,
    articleApiAvailable: false
  };
}

async function extractPage(message = {}) {
  const extract = () => extractArticleDocument(document, location.href, (root) => turndown.turndown(root));
  // The export page polls PROBE_ARTICLE on its own unthrottled clock and only
  // then asks for the conversion; a hidden tab's timers run at ~1 tick/second,
  // so waiting in here would cost seconds per article.
  if (message.settled === true) return extract();
  return waitForArticleExtraction({
    probe: () => probeArticleDocument(document, location.href),
    extract,
    wait: sleep,
    emptyLimit: 12
  });
}

function probePage() {
  const probe = probeArticleDocument(document, location.href);
  return {
    ok: true,
    sectionId: probe.ok ? probe.sectionId : "",
    fingerprint: probe.ok ? probe.fingerprint : ""
  };
}

function extractApiArticle(item, columnId) {
  return extractColumnArticleItem(item, columnId, document, (root) => turndown.turndown(root));
}

async function authenticatedArticleDetail(sectionId, columnId, apiOrigin = location.origin) {
  let lastResult = null;
  try {
    return await retryOperation(async () => {
      const result = await fetchArticleDetail({
        sectionId,
        columnId,
        apiOrigin,
        credentials: "include"
      });
      lastResult = result;
      if (result.retryable) {
        const error = new Error(result.reason || "文章接口暂时不可用");
        error.articleResult = result;
        throw error;
      }
      return result;
    }, { attempts: 2, delays: [700] });
  } catch (error) {
    return error?.articleResult || lastResult || {
      ok: false,
      sectionId,
      reason: error?.message || String(error)
    };
  }
}

async function extractApiArticleById(sectionId, columnId, apiOrigin) {
  const detail = await authenticatedArticleDetail(sectionId, columnId, apiOrigin);
  if (!detail.ok) return { ...detail, sectionId };
  try {
    return extractApiArticle(detail, columnId);
  } catch (error) {
    return { ok: false, sectionId, reason: error?.message || String(error) };
  }
}

async function probeArticleApi(message) {
  const columnId = String(message.columnId || "");
  const sectionId = String(message.sectionId || "");
  if (!/^c_\d+$/.test(columnId) || !/^\d+$/.test(sectionId)) {
    return { ok: false, reason: "文章接口探针参数无效" };
  }

  const alternateOrigin = location.origin === "https://www.zhihu.com"
    ? "https://zhuanlan.zhihu.com"
    : "https://www.zhihu.com";
  const failures = [];
  let accessDeniedOnly = true;
  let truncatedOnly = true;
  const noteFailure = (apiOrigin, result) => {
    if (!result?.accessDenied) accessDeniedOnly = false;
    if (!result?.truncated) truncatedOnly = false;
    failures.push(`${new URL(apiOrigin).hostname}：${result?.reason || "文章接口不可用"}`);
  };
  for (const apiOrigin of [location.origin, alternateOrigin]) {
    const anonymous = await fetchArticleDetail({
      sectionId,
      columnId,
      apiOrigin,
      credentials: "omit"
    });
    if (anonymous.retryable) {
      noteFailure(apiOrigin, { reason: anonymous.reason });
      continue;
    }
    if (!anonymous.accessDenied) {
      noteFailure(apiOrigin, { reason: "匿名请求未被拒绝" });
      continue;
    }

    const authenticated = await authenticatedArticleDetail(sectionId, columnId, apiOrigin);
    if (!authenticated.ok) {
      noteFailure(apiOrigin, authenticated);
      continue;
    }
    const article = extractApiArticle(authenticated, columnId);
    if (!article.ok) {
      noteFailure(apiOrigin, article);
      continue;
    }
    return {
      ok: true,
      anonymousDenied: anonymous.accessDenied === true,
      apiOrigin,
      article
    };
  }
  return {
    ok: false,
    accessDenied: accessDeniedOnly && failures.length > 0,
    truncated: truncatedOnly && failures.length > 0,
    reason: failures.join("；") || "登录态文章接口不可用"
  };
}

async function extractApiArticles(message) {
  const columnId = String(message.columnId || "");
  const apiOrigin = String(message.apiOrigin || location.origin);
  const sectionIds = Array.isArray(message.sectionIds) ? message.sectionIds.map(String) : [];
  if (!/^c_\d+$/.test(columnId)
    || !sectionIds.length
    || sectionIds.length > 20
    || sectionIds.some((id) => !/^\d+$/.test(id))) {
    return { ok: false, reason: "正文批次参数无效" };
  }

  const articles = await mapWithConcurrency(
    sectionIds,
    4,
    (sectionId) => extractApiArticleById(sectionId, columnId, apiOrigin)
  );
  return { ok: true, articles };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || ![
    "PING",
    "DISCOVER_COLUMN",
    "PROBE_ARTICLE",
    "EXTRACT_ARTICLE",
    "PROBE_ARTICLE_API",
    "EXTRACT_API_ARTICLES"
  ].includes(message.type)) return false;
  if (message.type === "PING") {
    sendResponse({ ok: true });
    return false;
  }
  if (message.type === "PROBE_ARTICLE") {
    sendResponse(probePage());
    return false;
  }

  const operation = message.type === "DISCOVER_COLUMN"
    ? discoverPage()
    : message.type === "PROBE_ARTICLE_API"
      ? probeArticleApi(message)
      : message.type === "EXTRACT_API_ARTICLES"
        ? extractApiArticles(message)
        : extractPage(message);
  operation
    .then(sendResponse)
    .catch((error) => sendResponse({ ok: false, reason: error?.message || String(error) }));
  return true;
});
