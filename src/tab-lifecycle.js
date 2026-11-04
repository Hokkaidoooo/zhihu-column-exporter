import { pageMatchesExpectation } from "./page-identity.js";

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
