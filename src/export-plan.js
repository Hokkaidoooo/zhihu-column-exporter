import { formatArticleMatchDiagnostics } from "./cache-validation.js";

export const PAGE_MODE_MS_PER_ARTICLE = 2600;
export const PAGE_MODE_TAB_COUNT = 4;
export const MAX_CONSECUTIVE_PAGE_FAILURES = 10;
const MIN_SAMPLES_FOR_ESTIMATE = 3;
const PAGE_MODE_SUFFIX = "已自动改用逐篇页面提取";

export function pageModeTabCount(count, limit = PAGE_MODE_TAB_COUNT) {
  const total = Math.max(0, Math.floor(Number(count) || 0));
  const cap = Math.max(1, Math.floor(Number(limit) || PAGE_MODE_TAB_COUNT));
  return Math.max(1, Math.min(cap, total));
}

export function formatDuration(milliseconds) {
  const totalSeconds = Math.max(0, Number(milliseconds) || 0) / 1000;
  if (totalSeconds < 60) return `${Math.max(1, Math.round(totalSeconds))} 秒`;
  const totalMinutes = Math.round(totalSeconds / 60);
  if (totalMinutes < 60) return `${Math.max(1, totalMinutes)} 分钟`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes ? `${hours} 小时 ${minutes} 分钟` : `${hours} 小时`;
}

export function estimatePageModeDuration(count, msPerArticle = PAGE_MODE_MS_PER_ARTICLE, tabCount = PAGE_MODE_TAB_COUNT) {
  const total = Math.max(0, Math.floor(Number(count) || 0));
  const perArticle = Math.max(0, Number(msPerArticle) || 0);
  return Math.round((total * perArticle) / pageModeTabCount(total, tabCount));
}

export function remainingTimeText(elapsedMs, processed, remaining) {
  const done = Math.floor(Number(processed) || 0);
  const left = Math.floor(Number(remaining) || 0);
  if (done < MIN_SAMPLES_FOR_ESTIMATE || left <= 0) return "";
  const perArticle = (Number(elapsedMs) || 0) / done;
  if (!Number.isFinite(perArticle) || perArticle <= 0) return "";
  return `预计还需 ${formatDuration(perArticle * left)}`;
}

export function pageModeAnnouncement(count, msPerArticle = PAGE_MODE_MS_PER_ARTICLE, tabCount = PAGE_MODE_TAB_COUNT) {
  const total = Math.max(0, Math.floor(Number(count) || 0));
  if (!total) return "没有需要逐篇提取的文章";
  const tabs = pageModeTabCount(total, tabCount);
  const duration = formatDuration(estimatePageModeDuration(total, msPerArticle, tabs));
  return `开始逐篇页面提取，共 ${total} 篇，预计 ${duration}；全程使用 ${tabs} 个后台标签页并行，可随时停止并保存已完成部分`;
}

export function describeArticleMismatch(comparison) {
  const kind = String(comparison?.kind || "different");
  const apiLength = Number(comparison?.apiLength || 0);
  const pageLength = Number(comparison?.pageLength || 0);
  if (kind === "apiTruncated") {
    const percent = pageLength ? Math.round((apiLength / pageLength) * 100) : 0;
    return `知乎文章接口只返回试看正文，仅为页面正文的 ${percent}%（接口 ${apiLength} 字，页面 ${pageLength} 字）`;
  }
  if (kind === "pageTruncated") {
    return `正常文章页当前显示的正文比接口更短（页面 ${pageLength} 字，接口 ${apiLength} 字）`;
  }
  if (kind === "tooShort") {
    return `接口与页面正文都过短，无法确认完整性（接口 ${apiLength} 字，页面 ${pageLength} 字）`;
  }
  if (kind === "unavailable") {
    return String(comparison?.reason || "接口或正常文章页没有提取到正文");
  }
  return `文章接口正文与正常文章页不一致：${comparison?.reason || "内容不同"}`;
}

function mismatchDetail(comparison) {
  const diagnostics = formatArticleMatchDiagnostics(comparison);
  const sample = String(comparison?.missingSample || "");
  return sample ? `${diagnostics}；页面独有片段：${sample}` : diagnostics;
}

export function planArticleSource({ probeFailure = "", comparison = null } = {}) {
  if (probeFailure) {
    return {
      mode: "page",
      headline: `登录态文章接口不可用：${probeFailure}；${PAGE_MODE_SUFFIX}`,
      detail: ""
    };
  }
  if (!comparison) {
    return {
      mode: "page",
      headline: `没有完成文章接口正文校验；${PAGE_MODE_SUFFIX}`,
      detail: ""
    };
  }
  if (comparison.matches) {
    return {
      mode: "api",
      headline: "登录态文章接口已通过权限与正文一致性校验",
      detail: formatArticleMatchDiagnostics(comparison)
    };
  }
  return {
    mode: "page",
    headline: `${describeArticleMismatch(comparison)}；${PAGE_MODE_SUFFIX}`,
    detail: mismatchDetail(comparison)
  };
}

export function shouldStopPageMode(consecutiveFailures, limit = MAX_CONSECUTIVE_PAGE_FAILURES) {
  const failures = Math.floor(Number(consecutiveFailures) || 0);
  const threshold = Math.max(1, Math.floor(Number(limit) || MAX_CONSECUTIVE_PAGE_FAILURES));
  return failures >= threshold;
}

export function pageModeStopMessage(consecutiveFailures, savedCount) {
  return `连续 ${Math.floor(Number(consecutiveFailures) || 0)} 篇页面提取失败，已停止以避免继续无效请求；已完成的 ${Math.floor(Number(savedCount) || 0)} 篇会保存到压缩包`;
}
