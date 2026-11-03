import TurndownService from "turndown";
import { gfm } from "turndown-plugin-gfm";
import { fetchArticleDetail } from "./article-detail-api.js";
import { waitForArticleExtraction } from "./article-readiness.js";
import { extractColumnArticleItem } from "./cached-article.js";
import { fetchAllColumnArticles } from "./catalog-api.js";
import { delay, abortError, throwIfAborted } from "./cancellation.js";
import { requestResource, httpError } from "./request.js";
import { detectPageTitle, extractArticleDocument, extractColumnLinks, inferPaidColumnInfo, probeArticleDocument } from "./content-core.js";
import { retryOperation } from "./retry.js";


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

async function clickMatchingButtons(pattern, signal) {
  const candidates = [...document.querySelectorAll("button,[role='button']")]
    .filter(visible)
    .filter((element) => pattern.test((element.textContent || "").trim()));
  for (const element of candidates.slice(0, 4)) {
    throwIfAborted(signal);
    element.click();
    await delay(250, signal);
  }
}

async function scrollElement(element, maximumSteps = 18, onStep = null, delayMs = 220, signal) {
  let unchanged = 0;
  let previousHeight = 0;
  for (let step = 0; step < maximumSteps && unchanged < 5; step += 1) {
    const height = element === document.scrollingElement ? document.documentElement.scrollHeight : element.scrollHeight;
    if (height === previousHeight) unchanged += 1;
    else unchanged = 0;
    previousHeight = height;
    element.scrollTo?.({ top: height, behavior: "instant" });
    await delay(delayMs, signal);
    if (onStep) await onStep();
  }
}

async function preparePage(mode, onStep = null, signal) {
  if (mode === "discover") {
    await clickMatchingButtons(/^(目录|全部章节|全部文章|查看全部|查看更多|加载更多|展开目录)$/, signal);
  }

  const scrollables = [...document.querySelectorAll("main,aside,div,section")]
    .filter((element) => visible(element) && element.clientHeight > 180 && element.scrollHeight > element.clientHeight * 1.3)
    .filter((element) => element.querySelector('[class*="ChapterItem"],a[href*="/market/paid_column/"],a[href*="zhuanlan.zhihu.com/p/"],a[href^="/p/"]'))
    .slice(0, 3);

  const delayMs = mode === "discover" ? 420 : 220;
  for (const element of scrollables) await scrollElement(element, 24, onStep, delayMs, signal);
  await scrollElement(document.scrollingElement || document.documentElement, mode === "discover" ? 36 : 14, onStep, delayMs, signal);
  await delay(500, signal);
}

async function discoverPage(signal) {
  let pageInfo = inferPaidColumnInfo(document, location.href);
  const collected = new Map();
  const collect = async () => {
    pageInfo = pageInfo || inferPaidColumnInfo(document, location.href);
    if (!pageInfo?.columnId) return;
    for (const link of extractColumnLinks(document, location.href, pageInfo.columnId)) {
      if (!collected.has(link.sectionId)) collected.set(link.sectionId, link);
    }
    await clickMatchingButtons(/^(查看更多|加载更多)$/, signal);
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
        requestPage: (url) => retryOperation(() => requestResource(url, {
          signal,
          credentials: "include",
          cache: "no-store",
          headers: { Accept: "application/json" },
          read: async (response) => {
            if (!response.ok) throw httpError(response);
            const payload = await response.json();
            if (payload?.error) throw new Error(payload.error.message || "目录接口拒绝访问");
            return payload;
          }
        }), { attempts: 3, delays: [500, 1400], signal, shouldRetry: (error) => error.retryable === true })
      });
      for (const link of apiResult.links) collected.set(link.sectionId, link);
      catalogComplete = apiResult.complete;
      expectedCount = apiResult.expectedCount;
    } catch (error) {
      throwIfAborted(signal);
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

  if (catalogComplete === false) return { ok: false, catalogComplete, reason: discoveryError };
  await collect();
  await preparePage("discover", collect, signal);
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

async function extractPage(message = {}, signal) {
  const extract = () => extractArticleDocument(document, location.href, (root) => turndown.turndown(root));
  // The export page polls PROBE_ARTICLE on its own unthrottled clock and only
  // then asks for the conversion; a hidden tab's timers run at ~1 tick/second,
  // so waiting in here would cost seconds per article.
  if (message.settled === true) {
    if (message.fingerprint !== probeArticleDocument(document, location.href).fingerprint) {
      return { ok: false, reason: "正文在稳定校验后发生变化，请重试" };
    }
    return extract();
  }
  return waitForArticleExtraction({
    probe: () => probeArticleDocument(document, location.href),
    extract,
    wait: (milliseconds) => delay(milliseconds, signal),
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

async function authenticatedArticleDetail(sectionId, columnId, apiOrigin = location.origin, signal) {
  let lastResult = null;
  try {
    return await retryOperation(async () => {
      const result = await fetchArticleDetail({
        sectionId,
        columnId,
        apiOrigin,
        signal,
        credentials: "include"
      });
      lastResult = result;
      if (result.retryable) {
        const error = new Error(result.reason || "文章接口暂时不可用");
        error.articleResult = result;
        error.retryAfterMs = result.retryAfterMs;
        throw error;
      }
      return result;
    }, { attempts: 2, delays: [700], signal });
  } catch (error) {
    throwIfAborted(signal);
    return error?.articleResult || lastResult || {
      ok: false,
      sectionId,
      reason: error?.message || String(error)
    };
  }
}

async function extractApiArticleById(sectionId, columnId, apiOrigin, signal) {
  const detail = await authenticatedArticleDetail(sectionId, columnId, apiOrigin, signal);
  if (!detail.ok) return { ...detail, sectionId };
  try {
    return extractApiArticle(detail, columnId);
  } catch (error) {
    return { ok: false, sectionId, reason: error?.message || String(error) };
  }
}

async function probeArticleApi(message, signal) {
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
      signal,
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

    const authenticated = await authenticatedArticleDetail(sectionId, columnId, apiOrigin, signal);
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

async function extractApiArticleRequest(message, signal) {
  const columnId = String(message.columnId || "");
  const sectionId = String(message.sectionId || "");
  const apiOrigin = String(message.apiOrigin || location.origin);
  if (!/^c_\d+$/.test(columnId) || !/^\d+$/.test(sectionId)) return { ok: false, reason: "正文参数无效" };
  return extractApiArticleById(sectionId, columnId, apiOrigin, signal);
}

const operations = new Map();

async function runOperation(message) {
  if (!message.taskId) throw new Error("导出请求缺少任务身份，请重新打开导出页");
  const controller = new AbortController();
  const active = operations.get(message.taskId) || new Set();
  active.add(controller);
  operations.set(message.taskId, active);
  try {
    if (message.type === "DISCOVER_COLUMN") return await discoverPage(controller.signal);
    if (message.type === "PROBE_ARTICLE_API") return await probeArticleApi(message, controller.signal);
    if (message.type === "EXTRACT_API_ARTICLE") return await extractApiArticleRequest(message, controller.signal);
    return await extractPage(message, controller.signal);
  } finally {
    active.delete(controller);
    if (!active.size) operations.delete(message.taskId);
  }
}

// Recovery injection and the declared content script may meet on the same page.
// Keep a single listener and a single cancellation registry per document.
if (!globalThis.__zhihuExporterInstalled) {
  globalThis.__zhihuExporterInstalled = true;
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === "CANCEL_OPERATION") {
      for (const controller of operations.get(message.taskId) || []) controller.abort(abortError());
      sendResponse({ ok: true });
      return false;
    }
    if (message?.type === "PROBE_ARTICLE") { sendResponse(probePage()); return false; }
    if (!["DISCOVER_COLUMN", "EXTRACT_ARTICLE", "PROBE_ARTICLE_API", "EXTRACT_API_ARTICLE"].includes(message?.type)) return false;
    runOperation(message).then(sendResponse).catch((error) => sendResponse({ ok: false, reason: error.message || String(error) }));
    return true;
  });
}
