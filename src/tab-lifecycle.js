import { pageMatchesExpectation } from "./page-identity.js";
import { throwIfAborted } from "./cancellation.js";
import { assertPageAccess } from "./site-access.js";

// Per worker and export attempt; zero disables automatic tab recreation.
export const PAGE_TAB_RECOVERY_LIMIT = 2;

export class PageTabUnavailableError extends Error {
  constructor(message, cause) {
    super(message, { cause });
    this.name = "PageTabUnavailableError";
  }
}

export function isMissingTabError(error, tabId) {
  const match = String(error?.message || error).match(/No tab with id:\s*(\d+)\.?/i);
  return Boolean(match && Number(match[1]) === tabId);
}

export async function createRecoverablePageTab({ openTab, closeTab, signal, onRecovered, recoveryLimit = PAGE_TAB_RECOVERY_LIMIT }) {
  if (!Number.isInteger(recoveryLimit) || recoveryLimit < 0) throw new TypeError("标签页恢复次数必须是非负整数");
  let tabId = null;
  let recoveries = 0;

  const open = async () => {
    throwIfAborted(signal);
    let createdId;
    try {
      createdId = await openTab();
    } catch (error) {
      throwIfAborted(signal);
      throw new PageTabUnavailableError(`无法创建正文读取标签页：${error.message || error}`, error);
    }
    tabId = createdId;
    if (signal?.aborted) {
      await closeTab(tabId);
      tabId = null;
      throwIfAborted(signal);
    }
  };

  await open();
  return {
    async read(operation) {
      for (;;) {
        throwIfAborted(signal);
        try {
          return await operation(tabId);
        } catch (error) {
          throwIfAborted(signal);
          if (!isMissingTabError(error, tabId)) throw error;
          const previousId = tabId;
          // Forget the dead tab before allocating its replacement, preserving
          // the worker limit and keeping stop/cleanup aware of the live ID.
          try {
            await closeTab(previousId);
          } catch (closeError) {
            throw new PageTabUnavailableError(`无法清理失效的正文标签页：${closeError.message || closeError}`, closeError);
          }
          tabId = null;
          if (recoveries >= recoveryLimit) {
            throw new PageTabUnavailableError("正文读取标签页反复关闭，已停止继续读取并保存已完成内容", error);
          }
          recoveries += 1;
          await open();
          onRecovered({ previousId, tabId, recoveries });
        }
      }
    },
    async close() {
      if (tabId === null) return;
      await closeTab(tabId);
      tabId = null;
    }
  };
}

/**
 * Waits until the tab settles on one URL. `requireComplete` defaults to false:
 * Chrome only reports `complete` after every subresource (including all the
 * article images) has loaded, but the paid body lands in the DOM long before
 * that, and callers re-check readiness against the content itself.
 */
export async function waitForStableTab({
  tabId,
  getTab,
  wait,
  now = Date.now,
  timeoutMs = 45000,
  stableMs = 300,
  pollMs = 100,
  requireComplete = false
}) {
  const deadline = now() + timeoutMs;
  let stableSince = null;
  let previousUrl = "";

  while (now() < deadline) {
    const tab = await getTab(tabId);
    const currentUrl = tab.url || "";
    assertPageAccess(currentUrl);
    const loaded = requireComplete ? tab.status === "complete" : Boolean(currentUrl);
    if (loaded && currentUrl === previousUrl) {
      if (stableSince === null) stableSince = now();
      if (now() - stableSince >= stableMs) return tab;
    } else {
      stableSince = null;
      previousUrl = currentUrl;
    }
    await wait(pollMs);
  }
  throw new Error("页面加载后未能稳定下来");
}

/**
 * Waits for the tab to actually be showing the expected article. Polling for a
 * URL match (instead of for a quiet period) avoids mistaking the URL the tab is
 * navigating away from for a settled page, which would trigger a needless
 * second navigation.
 */
export async function waitForExpectedTabUrl({
  tabId,
  expectedPage,
  getTab,
  wait,
  now = Date.now,
  timeoutMs = 20000,
  pollMs = 100
}) {
  const deadline = now() + timeoutMs;
  let lastUrl = "";
  while (now() < deadline) {
    const tab = await getTab(tabId);
    lastUrl = tab.url || "";
    assertPageAccess(lastUrl);
    if (lastUrl && pageMatchesExpectation(lastUrl, expectedPage)) return tab;
    await wait(pollMs);
  }
  return { id: tabId, url: lastUrl, matched: false };
}

export async function ensureExpectedTabPage({
  tabId,
  expectedPage,
  waitForStable,
  updateTab
}) {
  let tab = await waitForStable(tabId);
  if (pageMatchesExpectation(tab.url || "", expectedPage)) return tab;

  await updateTab(tabId, { url: expectedPage.url });
  tab = await waitForStable(tabId);
  if (!pageMatchesExpectation(tab.url || "", expectedPage)) {
    throw new Error("文章标签页跳转后未能恢复到目标页面");
  }
  return tab;
}
