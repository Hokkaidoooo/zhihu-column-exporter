import test from "node:test";
import assert from "node:assert/strict";
import { ensureExpectedTabPage, waitForExpectedTabUrl, waitForStableTab } from "../src/tab-lifecycle.js";
import { expectedPageFromUrl } from "../src/page-identity.js";

test("标签页从加载中进入 URL 连续稳定后返回", async () => {
  let time = 0;
  const states = [
    { status: "loading", url: "https://zhuanlan.zhihu.com/p/1" },
    { status: "complete", url: "https://zhuanlan.zhihu.com/p/1" },
    { status: "complete", url: "https://zhuanlan.zhihu.com/p/1" },
    { status: "complete", url: "https://zhuanlan.zhihu.com/p/1" },
    { status: "complete", url: "https://zhuanlan.zhihu.com/p/1" }
  ];
  let reads = 0;
  const result = await waitForStableTab({
    tabId: 1,
    getTab: async () => states[Math.min(reads++, states.length - 1)],
    wait: async (milliseconds) => { time += milliseconds; },
    now: () => time,
    timeoutMs: 2000,
    stableMs: 400,
    pollMs: 200,
    requireComplete: true
  });
  assert.equal(result.status, "complete");
  assert.equal(reads, 4);
});

test("默认不等待全部子资源加载完成", async () => {
  let time = 0;
  let reads = 0;
  const result = await waitForStableTab({
    tabId: 1,
    // Zhihu keeps the tab in `loading` until every image lands; the body is
    // already there, so the default wait must not block on `complete`.
    getTab: async () => {
      reads += 1;
      return { status: "loading", url: "https://zhuanlan.zhihu.com/p/1" };
    },
    wait: async (milliseconds) => { time += milliseconds; },
    now: () => time,
    timeoutMs: 2000,
    stableMs: 200,
    pollMs: 100
  });
  assert.equal(result.url, "https://zhuanlan.zhihu.com/p/1");
  assert.equal(reads, 4);
});

test("URL 在加载期间变化会重新计算稳定窗口", async () => {
  let time = 0;
  const states = [
    { status: "complete", url: "https://zhuanlan.zhihu.com/p/1" },
    { status: "loading", url: "https://www.zhihu.com/p/1" },
    { status: "complete", url: "https://www.zhihu.com/p/1" },
    { status: "complete", url: "https://www.zhihu.com/p/1" },
    { status: "complete", url: "https://www.zhihu.com/p/1" }
  ];
  let reads = 0;
  const result = await waitForStableTab({
    tabId: 1,
    getTab: async () => states[Math.min(reads++, states.length - 1)],
    wait: async (milliseconds) => { time += milliseconds; },
    now: () => time,
    timeoutMs: 2000,
    stableMs: 400,
    pollMs: 200,
    requireComplete: true
  });
  assert.equal(result.url, "https://www.zhihu.com/p/1");
  assert.equal(reads, 5);
});

test("标签页无法稳定时触发硬超时", async () => {
  let time = 0;
  await assert.rejects(
    waitForStableTab({
      tabId: 1,
      getTab: async () => ({ status: "loading", url: "https://zhuanlan.zhihu.com/p/1" }),
      wait: async (milliseconds) => { time += milliseconds; },
      now: () => time,
      timeoutMs: 600,
      stableMs: 400,
      pollMs: 200,
      requireComplete: true
    }),
    /未能稳定下来/
  );
});

test("等待目标文章 URL 时忽略跳转前的旧地址", async () => {
  let time = 0;
  const expectedPage = expectedPageFromUrl("https://zhuanlan.zhihu.com/p/100");
  const states = [
    { status: "complete", url: "https://zhuanlan.zhihu.com/p/99" },
    { status: "loading", url: "https://zhuanlan.zhihu.com/p/99" },
    { status: "loading", url: "https://zhuanlan.zhihu.com/p/100" }
  ];
  let reads = 0;
  const tab = await waitForExpectedTabUrl({
    tabId: 1,
    expectedPage,
    getTab: async () => states[Math.min(reads++, states.length - 1)],
    wait: async (milliseconds) => { time += milliseconds; },
    now: () => time,
    timeoutMs: 2000,
    pollMs: 100
  });
  assert.equal(tab.url, "https://zhuanlan.zhihu.com/p/100");
  assert.equal(reads, 3);
});

test("等待目标文章 URL 超时后报告未匹配而不是抛错", async () => {
  let time = 0;
  const expectedPage = expectedPageFromUrl("https://zhuanlan.zhihu.com/p/100");
  const tab = await waitForExpectedTabUrl({
    tabId: 1,
    expectedPage,
    getTab: async () => ({ status: "complete", url: "https://www.zhihu.com/signin" }),
    wait: async (milliseconds) => { time += milliseconds; },
    now: () => time,
    timeoutMs: 300,
    pollMs: 100
  });
  assert.equal(tab.matched, false);
  assert.equal(tab.url, "https://www.zhihu.com/signin");
});

test("错误文章 URL 会恢复为目标 URL 后再继续", async () => {
  const expectedPage = expectedPageFromUrl("https://zhuanlan.zhihu.com/p/100");
  const tabs = [
    { status: "complete", url: "https://zhuanlan.zhihu.com/p/200" },
    { status: "complete", url: "https://zhuanlan.zhihu.com/p/100" }
  ];
  const updates = [];
  const result = await ensureExpectedTabPage({
    tabId: 1,
    expectedPage,
    waitForStable: async () => tabs.shift(),
    updateTab: async (tabId, update) => { updates.push({ tabId, update }); }
  });
  assert.equal(result.url, expectedPage.url);
  assert.deepEqual(updates, [{ tabId: 1, update: { url: expectedPage.url } }]);
});

test("恢复后仍不是目标文章时拒绝继续", async () => {
  const expectedPage = expectedPageFromUrl("https://zhuanlan.zhihu.com/p/100");
  await assert.rejects(
    ensureExpectedTabPage({
      tabId: 1,
      expectedPage,
      waitForStable: async () => ({ status: "complete", url: "https://zhuanlan.zhihu.com/p/200" }),
      updateTab: async () => {}
    }),
    /未能恢复到目标页面/
  );
});
