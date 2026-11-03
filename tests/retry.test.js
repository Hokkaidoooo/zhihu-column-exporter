import test from "node:test";
import assert from "node:assert/strict";
import { retryOperation } from "../src/retry.js";

test("限流等待遵守 Retry-After，停止可立刻取消等待且不重发", async () => {
  const waits = [];
  let calls = 0;
  await retryOperation(async () => {
    if (++calls === 1) throw Object.assign(new Error("limited"), { retryAfterMs: 900 });
  }, { delays: [1], wait: async (ms) => waits.push(ms) });
  assert.deepEqual(waits, [900]);
  const controller = new AbortController();
  let notify;
  const waiting = new Promise((resolve) => { notify = resolve; });
  calls = 0;
  const pending = retryOperation(async () => { calls++; throw new Error("network"); }, {
    signal: controller.signal, delays: [10000], onRetry: notify
  });
  const rejection = assert.rejects(pending, { name: "AbortError" });
  await waiting;
  controller.abort();
  await rejection;
  assert.equal(calls, 1);
});

test("临时失败后自动重试并返回成功结果", async () => {
  let calls = 0;
  const retries = [];
  const result = await retryOperation(async () => {
    calls += 1;
    if (calls < 3) throw new Error(`失败 ${calls}`);
    return "成功";
  }, {
    attempts: 3,
    delays: [10, 20],
    wait: async (delay) => retries.push(delay)
  });

  assert.equal(result, "成功");
  assert.equal(calls, 3);
  assert.deepEqual(retries, [10, 20]);
});

test("达到最大次数后保留最后一次错误", async () => {
  let calls = 0;
  await assert.rejects(
    retryOperation(async () => {
      calls += 1;
      throw new Error(`最终失败 ${calls}`);
    }, { attempts: 3, delays: [0], wait: async () => {} }),
    /最终失败 3/
  );
  assert.equal(calls, 3);
});

test("不可重试错误立即停止", async () => {
  let calls = 0;
  await assert.rejects(
    retryOperation(async () => {
      calls += 1;
      const error = new Error("权限不足");
      error.fatal = true;
      throw error;
    }, { attempts: 3, shouldRetry: (error) => !error.fatal }),
    /权限不足/
  );
  assert.equal(calls, 1);
});
