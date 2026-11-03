import { createArchive } from "./archive.js";
import { saveBlob } from "./download.js";
import { archiveImages, createImageCache, localizeArticleImages } from "./images.js";
import { abortable, abortError, delay, throwIfAborted } from "./cancellation.js";
import { mapWithConcurrency } from "./concurrency.js";
import {
  AlertTriangle,
  BookDown,
  CheckCircle2,
  Download,
  FileArchive,
  LoaderCircle,
  RotateCcw,
  Square
} from "lucide";
import { createIcons } from "lucide";
import { retryOperation } from "./retry.js";
import { collectUnexportedArticles } from "./export-results.js";
import {
  escapeHtml,
  isZhihuUrl,
  padNumber,
  parsePaidColumnUrl,
  sanitizeFilename,
  uniqueBy
} from "./shared.js";
import {
  isMessageChannelClosed,
  messageChannelClosedError,
  settleFingerprint
} from "./article-readiness.js";
import { compareArticleApiWithPage } from "./cache-validation.js";
import {
  pageModeAnnouncement,
  pageModeStopMessage,
  pageModeTabCount,
  planArticleSource,
  remainingTimeText,
  shouldStopPageMode
} from "./export-plan.js";
import { assertExpectedArticleResult, expectedPageFromUrl, pageMatchesExpectation } from "./page-identity.js";
import { ensureExpectedTabPage, waitForExpectedTabUrl, waitForStableTab } from "./tab-lifecycle.js";

const PAGE_READY_ATTEMPTS = 200;
const PAGE_READY_INTERVAL_MS = 100;
const PAGE_READY_STABLE_MS = 300;
const PAGE_READY_EMPTY_LIMIT = 80;

const ui = {
  sourceBadge: document.querySelector("#source-badge"),
  columnTitle: document.querySelector("#column-title"),
  sourceUrl: document.querySelector("#source-url"),
  stateLabel: document.querySelector("#state-label"),
  currentItem: document.querySelector("#current-item"),
  progress: document.querySelector("#progress"),
  foundCount: document.querySelector("#found-count"),
  savedCount: document.querySelector("#saved-count"),
  failedCount: document.querySelector("#failed-count"),
  log: document.querySelector("#activity-log"),
  error: document.querySelector("#error-message"),
  start: document.querySelector("#start-button"),
  stop: document.querySelector("#stop-button"),
  retry: document.querySelector("#retry-button"),
  saveAgain: document.querySelector("#save-again-button"),
  markdown: document.querySelector("#format-markdown"),
  html: document.querySelector("#format-html"),
  images: document.querySelector("#include-images")
};

createIcons({
  icons: { AlertTriangle, BookDown, CheckCircle2, Download, FileArchive, LoaderCircle, RotateCcw, Square }
});

const query = new URLSearchParams(location.search);
const sourceTabId = query.has("tabId") ? Number(query.get("tabId")) : NaN;
let sourceTab = null;
const activeTempTabIds = new Set();
let lastArchive = null;
let saving = false;
const imageCache = createImageCache();
let session = freshSession();

async function closeTempTab(tabId) {
  if (!Number.isInteger(tabId)) return;
  try {
    await chrome.tabs.remove(tabId);
    activeTempTabIds.delete(tabId);
  } catch (error) {
    if (/No tab with id|Invalid tab ID|already closed/i.test(error.message || "")) {
      activeTempTabIds.delete(tabId);
      return;
    }
    throw new Error(`临时标签页关闭失败：${error.message || error}`);
  }
}

function freshSession() {
  return {
    running: false,
    controller: null,
    taskId: null,
    options: null,
    cancelled: false,
    columnId: null,
    columnTitle: "知乎付费专栏",
    sourceUrl: "",
    articles: [],
    failures: [],
    imageFailures: [],
    knownLinks: [],
    catalogComplete: null,
    expectedArticleCount: null,
    articleApiTabId: null,
    articleApiOrigin: null,
    articleSourceMode: null,
    completedIds: new Set()
  };
}

function setState(label, current = "") {
  ui.stateLabel.textContent = label;
  ui.currentItem.textContent = current;
}

function setError(message = "") {
  ui.error.hidden = !message;
  ui.error.textContent = message;
}

function setRunning(running) {
  session.running = running;
  ui.start.disabled = running;
  ui.stop.hidden = !running;
  ui.stop.disabled = false;
  for (const control of [ui.markdown, ui.html, ui.images]) control.disabled = running;
  ui.retry.disabled = running;
  ui.saveAgain.disabled = running;
  document.body.classList.toggle("is-running", running);
}

function updateMetrics(total = session.expectedArticleCount ?? session.knownLinks.length, done = session.articles.length + session.failures.length) {
  ui.foundCount.textContent = String(total);
  ui.savedCount.textContent = String(session.articles.length);
  ui.failedCount.textContent = String(session.failures.length);
  ui.progress.max = Math.max(total, 1);
  ui.progress.value = Math.min(done, Math.max(total, 1));
}

function addLog(message, tone = "neutral") {
  const item = document.createElement("li");
  item.className = `log-item log-${tone}`;
  item.textContent = message;
  ui.log.prepend(item);
  while (ui.log.children.length > 40) ui.log.lastElementChild.remove();
}

function trimTabTitle(value) {
  return String(value || "")
    .replace(/\s*[-–|]\s*知乎\s*$/, "")
    .trim();
}

async function initialize() {
  try {
    if (!Number.isInteger(sourceTabId) || sourceTabId <= 0) throw new Error("没有找到来源页面，请从知乎页面点击扩展图标打开");
    sourceTab = await chrome.tabs.get(sourceTabId);
    if (!isZhihuUrl(sourceTab.url || "")) {
      throw new Error("请先打开知乎付费专栏的目录页或任一章节页，再点击扩展图标");
    }
    const parsed = parsePaidColumnUrl(sourceTab.url || "");

    session.columnId = parsed?.columnId || null;
    session.columnTitle = trimTabTitle(sourceTab.title) || "知乎付费专栏";
    session.sourceUrl = sourceTab.url;
    ui.columnTitle.textContent = session.columnTitle;
    ui.sourceUrl.textContent = session.sourceUrl;
    ui.sourceUrl.href = session.sourceUrl;
    ui.sourceBadge.dataset.state = "ready";
    ui.sourceBadge.textContent = "页面已识别";
    ui.start.disabled = false;
    setState("准备就绪", "");
  } catch (error) {
    ui.sourceBadge.dataset.state = "error";
    ui.sourceBadge.textContent = "未识别页面";
    ui.columnTitle.textContent = "未读取到专栏";
    ui.start.disabled = true;
    setState("无法开始", "");
    setError(error.message || String(error));
  }
}

async function waitForTabStable(tabId, timeoutMs = 45000, stableMs = 300) {
  return waitForStableTab({
    tabId,
    getTab: (id) => chrome.tabs.get(id),
    wait: (milliseconds) => delay(milliseconds, session.controller?.signal),
    timeoutMs,
    stableMs
  });
}

async function ensureExpectedPage(tabId, expectedPage) {
  return ensureExpectedTabPage({
    tabId,
    expectedPage,
    waitForStable: waitForTabStable,
    updateTab: (id, update) => chrome.tabs.update(id, update)
  });
}

async function sendToTab(tabId, message, expectedPage) {
  const signal = session.controller?.signal;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    throwIfAborted(signal);
    try {
      return await abortable(chrome.tabs.sendMessage(tabId, { ...message, taskId: session.taskId }), signal);
    } catch (error) {
      throwIfAborted(signal);
      if (!isMessageChannelClosed(error)) throw error;
      if (attempt === 1) throw messageChannelClosedError();
      await ensureExpectedPage(tabId, expectedPage);
      await chrome.scripting.executeScript({ target: { tabId }, files: ["content.js"], injectImmediately: true });
    }
  }
}

async function sendToArticleApiTab(message) {
  throwIfAborted(session.controller?.signal);
  const tab = await chrome.tabs.get(session.articleApiTabId);
  const expectedPage = expectedPageFromUrl(session.sourceUrl);
  if (!pageMatchesExpectation(tab.url || "", expectedPage)) {
    throw new Error("专栏来源页已发生变化，登录态文章接口不可继续使用");
  }
  return sendToTab(tab.id, message, expectedPage);
}

async function visitPage(url, messageType) {
  throwIfAborted(session.controller?.signal);
  const tab = await chrome.tabs.create({ url, active: false });
  const expectedPage = expectedPageFromUrl(url);
  activeTempTabIds.add(tab.id);
  try {
    await ensureExpectedPage(tab.id, expectedPage);
    if (session.cancelled) throw new Error("导出已停止");
    if (messageType === "EXTRACT_ARTICLE") {
      return await extractSettledArticle(tab.id, { sectionId: expectedPage.sectionId }, expectedPage);
    }
    return await sendToTab(tab.id, { type: messageType }, expectedPage);
  } finally {
    await closeTempTab(tab.id);
  }
}

function addKnownLinks(links) {
  const merged = uniqueBy([...session.knownLinks, ...(links || [])], (item) => item.sectionId);
  session.knownLinks = merged;
  updateMetrics();
}

function nextQueue() {
  return session.knownLinks.filter((link) => !session.completedIds.has(link.sectionId));
}

async function discoverCatalog() {
  setState("正在读取目录", "等待知乎加载完整章节列表");
  const candidateUrls = [];
  if (/^c_\d+$/.test(String(session.columnId || ""))) {
    candidateUrls.push(`https://www.zhihu.com/column/${session.columnId}`);
  }
  candidateUrls.push(session.sourceUrl);

  let result = null;
  let retainedApiTabId = null;
  let lastError = null;
  for (const candidateUrl of uniqueBy(candidateUrls, (url) => url)) {
    throwIfAborted(session.controller?.signal);
    try {
      const expectedPage = expectedPageFromUrl(candidateUrl);
      const currentSourceTab = await chrome.tabs.get(sourceTabId);
      const useSourceTab = pageMatchesExpectation(currentSourceTab.url || "", expectedPage);
      result = await retryOperation(async () => {
        const discovery = useSourceTab
          ? await (async () => {
            await ensureExpectedPage(sourceTabId, expectedPage);
            return sendToTab(sourceTabId, { type: "DISCOVER_COLUMN" }, expectedPage);
          })()
          : await visitPage(candidateUrl, "DISCOVER_COLUMN");
        if (!discovery?.ok) throw new Error(discovery?.reason || "未能读取专栏目录");
        if (discovery.catalogComplete === false) {
          throw new Error(discovery.discoveryError || "目录接口未返回完整结果");
        }
        return discovery;
      }, {
        attempts: 2,
        signal: session.controller?.signal,
        shouldRetry: (error) => !session.cancelled && (error.retryable === true || isMessageChannelClosed(error)),
        onRetry: ({ error, nextAttempt }) => {
          addLog(`目录读取失败：${error.message || error}；正在自动重试 ${nextAttempt} / 2`, "neutral");
        }
      });
      if (useSourceTab && result.articleApiAvailable === true) retainedApiTabId = sourceTabId;
      break;
    } catch (error) {
      lastError = error;
    }
  }
  if (!result) throw lastError || new Error("未能读取专栏目录");
  session.columnId = result.columnId;
  session.columnTitle = trimTabTitle(result.columnTitle) || session.columnTitle;
  session.catalogComplete = result.catalogComplete;
  session.expectedArticleCount = Number.isSafeInteger(result.expectedCount) ? result.expectedCount : null;
  session.articleApiTabId = retainedApiTabId;
  session.articleApiOrigin = null;
  session.articleSourceMode = null;
  ui.columnTitle.textContent = session.columnTitle;
  addKnownLinks(result.links);

  if (result.catalogComplete === false) {
    const detail = result.discoveryError ? `：${result.discoveryError}` : "";
    throw new Error(`未能读取完整专栏目录${detail}`);
  }

  if (!session.knownLinks.length && result.sectionId) {
    addKnownLinks([{
      sectionId: result.sectionId,
      title: trimTabTitle(sourceTab.title) || `章节 ${result.sectionId}`,
      url: session.sourceUrl
    }]);
  }
  if (!session.knownLinks.length) {
    throw new Error("页面中没有发现章节。请打开该专栏的任一正文页，再点击扩展图标");
  }
  addLog(`已发现 ${session.knownLinks.length} 篇章节`, "success");
  if (session.articleApiTabId) addLog("已准备登录态正文接口，开始前将校验账号权限与正文完整性", "success");
}

async function navigateToArticle(tabId, link) {
  const expectedPage = expectedPageFromUrl(link.url);
  await chrome.tabs.update(tabId, { url: expectedPage.url });
  const tab = await waitForExpectedTabUrl({
    tabId,
    expectedPage,
    getTab: (id) => chrome.tabs.get(id),
    wait: (milliseconds) => delay(milliseconds, session.controller?.signal)
  });
  if (tab?.matched === false) {
    // Fall back to the slower recovery path, which re-navigates once more and
    // reports a precise error if the tab still refuses to land on the article.
    await ensureExpectedPage(tabId, expectedPage);
  }
  return expectedPage;
}

/**
 * Drives the readiness poll from this (visible) export page: a background tab's
 * own timers are throttled to roughly one tick per second, so asking the
 * content script to wait costs seconds per article.
 */
async function extractSettledArticle(tabId, link, expectedPage) {
  let lastSectionId = "";
  const settle = await settleFingerprint({
    sample: async () => {
      if (session.cancelled) throw new Error("导出已停止");
      const probe = await sendToTab(tabId, { type: "PROBE_ARTICLE" }, expectedPage);
      lastSectionId = String(probe?.sectionId || "");
      if (lastSectionId && lastSectionId !== String(link.sectionId)) return "";
      return String(probe?.fingerprint || "");
    },
    wait: (milliseconds) => delay(milliseconds, session.controller?.signal),
    attempts: PAGE_READY_ATTEMPTS,
    intervalMs: PAGE_READY_INTERVAL_MS,
    stableSamples: 3,
    minimumStableMs: PAGE_READY_STABLE_MS,
    emptyLimit: PAGE_READY_EMPTY_LIMIT
  });
  if (!settle.settled && !settle.fingerprint) {
    await ensureExpectedPage(tabId, expectedPage);
  }
  return assertExpectedArticleResult(
    await sendToTab(tabId, { type: "EXTRACT_ARTICLE", settled: settle.settled, fingerprint: settle.fingerprint }, expectedPage),
    link.sectionId,
    session.columnId
  );
}

async function extractOneArticle(tabId, link) {
  return retryOperation(async () => {
    if (session.cancelled) throw new Error("导出已停止");
    const expectedPage = await navigateToArticle(tabId, link);
    const result = await extractSettledArticle(tabId, link, expectedPage);
    if (!result?.ok && !result?.accessDenied) {
      throw new Error(result?.reason || "正文提取失败");
    }
    return result;
  }, {
    attempts: 3,
    signal: session.controller?.signal,
    shouldRetry: () => !session.cancelled,
    onRetry: ({ error, nextAttempt }) => {
      addLog(`${link.title}：${error.message}，正在自动重试 ${nextAttempt} / 3`, "neutral");
    }
  });
}

async function processPageQueue(queue, includeDiscovered = true) {
  const claimedIds = new Set();
  const scope = () => (includeDiscovered ? nextQueue() : queue)
    .filter((link) => !session.completedIds.has(link.sectionId));
  const pending = () => scope().filter((link) => !claimedIds.has(link.sectionId));
  const initial = scope();
  if (!initial.length || session.cancelled) return;

  const startedAt = Date.now();
  let processed = 0;
  let consecutiveFailures = 0;
  let stopReason = null;
  const tabCount = pageModeTabCount(initial.length);
  addLog(pageModeAnnouncement(initial.length), "neutral");

  const takeNext = () => {
    const next = pending()[0];
    if (next) claimedIds.add(next.sectionId);
    return next;
  };

  const runWorker = async (tabId) => {
    for (let link = takeNext(); link; link = takeNext()) {
      if (session.cancelled || stopReason) return;

      const position = session.completedIds.size + 1;
      const total = Math.max(session.expectedArticleCount ?? session.knownLinks.length, position);
      const eta = remainingTimeText(Date.now() - startedAt, processed, scope().length);
      setState("正在逐篇提取正文", `${position} / ${total} · ${link.title}${eta ? ` · ${eta}` : ""}`);

      try {
        const article = await extractOneArticle(tabId, link);
        if (!article?.ok) {
          recordFailure(link, article?.reason || "正文提取失败", Boolean(article?.accessDenied));
          consecutiveFailures += 1;
          if (article?.accessDenied && session.articles.length === 0) {
            stopReason = new Error("当前 Chrome 会话没有显示完整正文。请确认这个浏览器配置已登录并已订阅该专栏");
            return;
          }
        } else {
          storeSuccessfulArticle(link, article);
          addKnownLinks(article.discovered);
          consecutiveFailures = 0;
        }
      } catch (error) {
        if (session.cancelled) return;
        if (/当前 Chrome 会话没有显示完整正文/.test(error.message || "")) {
          stopReason = error;
          return;
        }
        recordFailure(link, error.message || String(error));
        consecutiveFailures += 1;
      }
      processed += 1;
      updateMetrics();
      if (shouldStopPageMode(consecutiveFailures)) {
        stopReason = new Error(pageModeStopMessage(consecutiveFailures, session.articles.length));
        return;
      }
    }
  };

  const tabs = [];
  try {
    for (let index = 0; index < tabCount; index += 1) {
      if (session.cancelled) break;
      const tab = await chrome.tabs.create({ url: "about:blank", active: false });
      activeTempTabIds.add(tab.id);
      tabs.push(tab.id);
    }
    await Promise.all(tabs.map((tabId) => runWorker(tabId)));
  } finally {
    await Promise.all(tabs.map((tabId) => closeTempTab(tabId)));
  }
  if (stopReason) throw stopReason;
}

function recordFailure(link, reason, accessDenied = false) {
  if (session.completedIds.has(link.sectionId)) return;
  session.failures.push({
    sectionId: link.sectionId,
    title: link.title,
    url: link.url,
    reason,
    accessDenied
  });
  session.completedIds.add(link.sectionId);
  addLog(`${link.title}：${reason}`, "error");
}

function storeSuccessfulArticle(link, article) {
  assertExpectedArticleResult(article, link.sectionId, session.columnId);
  if (!article?.ok) throw new Error(article?.reason || "正文提取失败");
  session.articles.push(article);
  session.completedIds.add(link.sectionId);
  addLog(article.title, "success");
}

async function probeArticleApiAccess(probeLink) {
  const probe = await retryOperation(async () => {
    const result = await sendToArticleApiTab({
      type: "PROBE_ARTICLE_API",
      columnId: session.columnId,
      sectionId: probeLink.sectionId
    });
    if (!result?.ok) {
      const error = new Error(result?.reason || "登录态文章接口不可用");
      error.accessDenied = Boolean(result?.accessDenied);
      error.truncated = Boolean(result?.truncated);
      throw error;
    }
    return result;
  }, {
    attempts: 2,
    signal: session.controller?.signal,
    shouldRetry: (error) => !session.cancelled && !error.accessDenied && !error.truncated,
    onRetry: ({ error }) => addLog(`文章接口校验失败：${error.message}；正在重试`, "neutral")
  });
  if (!probe.anonymousDenied) throw new Error("无法证明文章接口只向当前登录会话返回正文");
  return probe;
}

async function readProbePage(probeLink) {
  return retryOperation(async () => {
    const result = assertExpectedArticleResult(
      await visitPage(probeLink.url, "EXTRACT_ARTICLE"),
      probeLink.sectionId,
      session.columnId
    );
    if (!result?.ok) {
      const error = new Error(result?.reason || "正常文章页没有返回完整正文");
      error.accessDenied = Boolean(result?.accessDenied);
      throw error;
    }
    return result;
  }, {
    attempts: 2,
    signal: session.controller?.signal,
    shouldRetry: (error) => !session.cancelled && !error.accessDenied
  });
}

async function decideArticleSource(queue) {
  const probeLink = queue.find((link) => link.requiresAccessProbe) || queue[0];
  if (!probeLink) return planArticleSource({ probeFailure: "没有可用于权限校验的文章" });

  setState("正在校验阅读权限", probeLink.title);
  let probe = null;
  try {
    probe = await probeArticleApiAccess(probeLink);
  } catch (error) {
    return planArticleSource({ probeFailure: error.message || String(error) });
  }

  let apiArticle = null;
  let pageArticle = null;
  try {
    apiArticle = assertExpectedArticleResult(probe.article, probeLink.sectionId, session.columnId);
    pageArticle = await readProbePage(probeLink);
  } catch (error) {
    return planArticleSource({ probeFailure: error.message || String(error) });
  }

  const plan = planArticleSource({ comparison: compareArticleApiWithPage(apiArticle, pageArticle) });
  storeSuccessfulArticle(probeLink, plan.mode === "api" ? apiArticle : pageArticle);
  updateMetrics();
  return { ...plan, apiOrigin: probe.apiOrigin };
}

async function processArticleApiQueue(queue) {
  if (session.articleSourceMode === "page") return processPageQueue(queue);
  if (session.articleSourceMode !== "api") {
    const plan = await decideArticleSource(queue);
    addLog(plan.headline, plan.mode === "api" ? "success" : "neutral");
    if (plan.detail) addLog(plan.detail, "neutral");
    session.articleSourceMode = plan.mode;
    if (plan.mode !== "api") return processPageQueue(queue);
    session.articleApiOrigin = plan.apiOrigin;
  }

  const pending = queue.filter((link) => !session.completedIds.has(link.sectionId));
  const pageFallback = [];
  let sourceFailure = null;
  await mapWithConcurrency(pending, 4, async (link) => {
    if (session.cancelled) return;
    if (sourceFailure) { pageFallback.push(link); return; }
    setState("正在读取正文", `${session.articles.length} / ${session.expectedArticleCount ?? session.knownLinks.length} · ${link.title}`);
    try {
      const article = await sendToArticleApiTab({
        type: "EXTRACT_API_ARTICLE",
        columnId: session.columnId,
        apiOrigin: session.articleApiOrigin,
        sectionId: link.sectionId
      });
      if (!article?.ok) {
        addLog(`${link.title}：${article?.reason || "文章接口没有返回正文"}，将改用正常页面读取`, "neutral");
        pageFallback.push(link);
        if (article?.status === 429 || article?.accessDenied) sourceFailure = article.reason;
        return;
      }
      storeSuccessfulArticle(link, article);
      updateMetrics();
    } catch (error) {
      if (session.cancelled) return;
      sourceFailure = error.message || String(error);
      pageFallback.push(link);
    }
  });
  if (session.cancelled || !pageFallback.length) return;
  if (sourceFailure) session.articleSourceMode = "page";
  addLog(`${pageFallback.length} 篇接口正文不可用，改用逐篇页面提取${sourceFailure ? `：${sourceFailure}` : ""}`, "neutral");
  const fallbackIds = new Set(pageFallback.map((link) => link.sectionId));
  await processPageQueue(pending.filter((link) => fallbackIds.has(link.sectionId)), false);
}

async function processQueue(queue) {
  if (session.articleApiTabId && /^c_\d+$/.test(String(session.columnId || ""))) {
    return processArticleApiQueue(queue);
  }
  return processPageQueue(queue);
}

const readerCss = `
:root { color-scheme: light; font-family: system-ui, "Microsoft YaHei", sans-serif; color: #202522; background: #f5f7f5; }
* { box-sizing: border-box; }
body { margin: 0; }
main { width: min(760px, calc(100% - 32px)); margin: 0 auto; padding: 44px 0 80px; }
header { margin-bottom: 34px; border-bottom: 1px solid #dfe4df; padding-bottom: 22px; }
h1 { margin: 0 0 12px; font-size: clamp(28px, 5vw, 42px); line-height: 1.2; letter-spacing: 0; }
h2, h3, h4 { margin: 1.8em 0 .7em; line-height: 1.35; letter-spacing: 0; }
p, li { font-size: 17px; line-height: 1.9; }
a { color: #17663f; text-underline-offset: 3px; }
.source { color: #657169; font-size: 14px; overflow-wrap: anywhere; }
img { display: block; max-width: 100%; height: auto; margin: 26px auto; }
blockquote { margin: 24px 0; padding: 2px 0 2px 18px; border-left: 3px solid #2f7d55; color: #4f5c54; }
pre { overflow: auto; padding: 16px; background: #e9eeea; border-radius: 6px; }
code { font-family: Consolas, monospace; }
table { width: 100%; border-collapse: collapse; overflow: auto; }
td, th { padding: 9px; border: 1px solid #ccd5ce; text-align: left; }
.index-list { list-style: none; padding: 0; margin: 28px 0; border-top: 1px solid #dfe4df; }
.index-list li { border-bottom: 1px solid #dfe4df; }
.index-list a { display: block; padding: 15px 2px; color: inherit; text-decoration: none; }
.index-list a:hover { color: #17663f; }
`;

function articleHtml(article, body, index, total) {
  return `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(article.title)}</title><link rel="stylesheet" href="../reader.css"></head>
<body><main><header><div class="source">${index} / ${total}</div><h1>${escapeHtml(article.title)}</h1>
<a class="source" href="${escapeHtml(article.url)}">查看知乎原文</a></header><article>${body}</article></main></body></html>`;
}

function indexHtml(columnTitle, entries, exportedAt) {
  const items = entries.map((entry) => `<li><a href="html/${encodeURIComponent(entry.fileName)}.html">${escapeHtml(entry.title)}</a></li>`).join("\n");
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(columnTitle)}</title><link rel="stylesheet" href="reader.css"></head><body><main><header>
<div class="source">导出于 ${escapeHtml(exportedAt)}</div><h1>${escapeHtml(columnTitle)}</h1>
<a class="source" href="${escapeHtml(session.sourceUrl)}">查看知乎专栏</a></header><ol class="index-list">${items}</ol></main></body></html>`;
}

async function buildArchive(partial = false) {
  if (!session.articles.length) throw new Error("没有可保存的正文");
  setState("正在整理文件", "正在下载正文图片");
  const options = session.options;
  const archive = createArchive();
  if (options.html) await archive.add("reader.css", readerCss);
  const entries = [];
  const articleById = new Map(session.articles.map((article) => [article.sectionId, article]));
  const ordered = session.knownLinks.map((link) => articleById.get(link.sectionId)).filter(Boolean);
  const imageResults = options.images ? await archiveImages(ordered, archive, {
    signal: session.controller.signal,
    cache: imageCache,
    onProgress: (done, total) => {
      if (!session.cancelled) setState("正在下载图片", `${done} / ${total} 张`);
    }
  }) : null;
  const imageCount = imageResults ? [...imageResults.values()].filter((result) => result.ok).length : 0;

  for (let index = 0; index < ordered.length; index += 1) {
    const article = ordered[index];
    const number = index + 1;
    setState("正在整理文件", `${number} / ${ordered.length} · ${article.title}`);
    const localized = localizeArticleImages(article, imageResults);
    session.imageFailures.push(...localized.failures);
    for (const failure of localized.failures) addLog(`${article.title}：图片未下载（${failure.reason}），此图片仍需联网查看`, "error");
    const fileName = `${padNumber(number)}-${sanitizeFilename(article.title, `章节-${article.sectionId}`, 70)}`;
    entries.push({ ...article, fileName });

    if (options.markdown) {
      const markdown = `# ${article.title}\n\n> 原文：${article.url}\n\n${localized.markdown}\n`;
      await archive.add(`articles/${fileName}.md`, markdown);
    }
    if (options.html) {
      await archive.add(`html/${fileName}.html`, articleHtml(article, localized.html, number, ordered.length));
    }
  }

  const exportedAt = new Intl.DateTimeFormat("zh-CN", { dateStyle: "long", timeStyle: "medium" }).format(new Date());
  const successfulIds = new Set(entries.map((entry) => entry.sectionId));
  ui.stop.disabled = true;
  const expectedArticleCount = session.expectedArticleCount;
  const complete = !partial && !session.cancelled
    && session.failures.length === 0
    && session.catalogComplete === true
    && session.knownLinks.length > 0
    && successfulIds.size === session.knownLinks.length
    && session.knownLinks.length === expectedArticleCount
    && session.imageFailures.length === 0;
  const readmeLines = [
    `# ${session.columnTitle}`,
    "",
    `- 导出时间：${exportedAt}`,
    `- 文章来源：${session.sourceUrl}`,
    `- 成功章节：${entries.length}`,
    `- 发现章节：${session.knownLinks.length}`,
    `- 目录应有章节：${expectedArticleCount ?? "尚未确认"}`,
    `- 未完成章节：${session.failures.length}`,
    `- 全量完成：${complete ? "是" : "否"}`,
    `- 本地图片：${imageCount}`,
    `- 图片下载失败：${session.imageFailures.length}`,
    "",
    "## 目录",
    "",
    ...entries.map((entry, index) => {
      const target = options.markdown
        ? `articles/${encodeURIComponent(entry.fileName)}.md`
        : `html/${encodeURIComponent(entry.fileName)}.html`;
      return `${index + 1}. [${entry.title}](${target})`;
    })
  ];
  if (session.catalogComplete !== true) readmeLines.splice(11, 0, "- 目录完整性尚未确认，本包仅包含当前已发现的文章。");
  await archive.add("README.md", readmeLines.join("\n"));
  if (options.html) await archive.add("index.html", indexHtml(session.columnTitle, entries, exportedAt));

  const exportInfo = {
    title: session.columnTitle,
    source: session.sourceUrl,
    exportedAt: new Date().toISOString(),
    complete,
    partial: !complete,
    expectedArticleCount,
    discoveredArticleCount: session.knownLinks.length,
    catalogComplete: session.catalogComplete,
    articleCount: entries.length,
    failureCount: session.failures.length,
    imageFailureCount: session.imageFailures.length,
    imageCount,
    articles: entries.map(({ title, url, sectionId }) => ({ title, url, sectionId })),
    failures: session.failures,
    imageFailures: session.imageFailures
  };
  await archive.add("export-info.json", JSON.stringify(exportInfo, null, 2));
  if (session.failures.length) {
    await archive.add("未导出章节.txt", session.failures.map((item) => `${item.title}\n${item.url}\n原因：${item.reason}`).join("\n\n"));
  }
  if (session.imageFailures.length) {
    await archive.add("未下载图片.txt", [
      "以下图片下载失败，正文中保留了原始图片地址，需要联网查看。可在导出页点击“重试未完成”重新下载。",
      ...session.imageFailures.map((item) => `${item.title}\n${item.url}\n原因：${item.reason}`)
    ].join("\n\n"));
  }

  setState("正在生成压缩包", `${archive.count} 个文件`);
  const blob = await archive.finish();
  lastArchive = {
    blob,
    fileName: `${sanitizeFilename(session.columnTitle, "知乎付费专栏", 60)}-${complete ? "" : "部分导出-"}${new Date().toISOString().slice(0, 10)}.zip`
  };
  return { articleCount: entries.length, imageCount, complete };
}

async function saveArchive() {
  if (!lastArchive || saving) return;
  saving = true;
  ui.saveAgain.disabled = true;
  ui.start.disabled = true;
  ui.retry.disabled = true;
  setState("正在保存文件", "等待浏览器确认写入完成");
  try {
    await saveBlob(lastArchive.blob, lastArchive.fileName, chrome.downloads);
  } finally {
    saving = false;
    ui.saveAgain.disabled = session.running;
    ui.start.disabled = session.running;
    ui.retry.disabled = session.running;
  }
}

async function finishExport(partial = false) {
  const summary = await buildArchive(partial);
  await saveArchive();
  const resultText = `${summary.articleCount} / ${session.expectedArticleCount ?? session.knownLinks.length} 篇文章 · ${summary.imageCount} 张本地图片`;
  setState(summary.complete ? "全部导出完成" : "已保存部分结果", resultText);
  addLog(summary.complete ? "全量压缩包已保存" : `仍有 ${session.failures.length} 篇文章、${session.imageFailures.length} 张图片未完成${session.catalogComplete !== true ? "；目录总量尚未确认" : ""}`, summary.complete ? "success" : "error");
}

async function runExportAttempt() {
  let processingError = null;
  try {
    if (!session.knownLinks.length || session.catalogComplete !== true) await discoverCatalog();
    await processQueue(nextQueue());
  } catch (error) {
    processingError = error;
    setError(error.message || String(error));
  }
  session.failures = collectUnexportedArticles({
    links: session.knownLinks,
    articles: session.articles,
    failures: session.failures,
    reason: session.cancelled ? "用户停止导出，尚未完成" : processingError?.message || "本次导出未处理完成"
  });
  try {
    if (!session.articles.length) throw new Error("没有成功导出任何章节");
    await finishExport(session.cancelled || Boolean(processingError));
  } catch (archiveError) {
    const message = archiveError.message || String(archiveError);
    setError(processingError ? `${processingError.message || processingError}；结果保存失败：${message}` : message);
    setState(session.cancelled ? "已停止" : "导出未完成", "");
  } finally {
    setRunning(false);
    updateMetrics();
    ui.saveAgain.hidden = !lastArchive;
    ui.retry.hidden = session.failures.length === 0 && session.imageFailures.length === 0;
  }
}

async function startExport() {
  if (session.running || saving) return;
  if (!ui.markdown.checked && !ui.html.checked) {
    setError("请至少选择一种正文格式");
    return;
  }
  setError("");
  setRunning(true);
  session.cancelled = false;
  session.controller = new AbortController();
  session.taskId = crypto.randomUUID();
  session.options = Object.freeze({ markdown: ui.markdown.checked, html: ui.html.checked, images: ui.images.checked });
  session.completedIds = new Set(session.articles.map((article) => article.sectionId));
  session.failures = [];
  session.imageFailures = [];
  ui.retry.hidden = true;
  ui.saveAgain.hidden = true;
  lastArchive = null;
  await runExportAttempt();
}

async function stopExport() {
  if (!session.running || ui.stop.disabled) return;
  session.cancelled = true;
  session.controller.abort(abortError());
  ui.stop.disabled = true;
  setState("正在停止", "停止新请求，正在保存已完成内容");
  const temporaryIds = [...activeTempTabIds];
  const taskId = session.taskId;
  const ids = new Set([sourceTabId, ...temporaryIds]);
  await Promise.all([...ids].map(async (tabId) => {
    try {
      await chrome.tabs.sendMessage(tabId, { type: "CANCEL_OPERATION", taskId });
    } catch (error) {
      if (!isMessageChannelClosed(error) && !/No tab|closed/i.test(error.message || "")) addLog(`停止页面请求失败：${error.message || error}`, "error");
    }
  }));
  await Promise.all(temporaryIds.map((tabId) => closeTempTab(tabId)));
}

ui.start.addEventListener("click", startExport);
ui.stop.addEventListener("click", () => stopExport().catch((error) => setError(error.message || String(error))));
ui.retry.addEventListener("click", startExport);
ui.saveAgain.addEventListener("click", () => {
  setError("");
  saveArchive().then(() => setState("压缩包已保存")).catch((error) => { setError(`保存失败：${error.message || error}`); setState("保存未完成"); });
});
initialize();
