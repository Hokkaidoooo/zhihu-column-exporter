import test from "node:test";
import assert from "node:assert/strict";
import { createPageWorker, isMissingTabError, PageTabRecoveryError } from "../src/page-worker.js";

test("只识别指向当前工作页的 No tab 错误", () => {
  assert.equal(isMissingTabError(new Error("No tab with id: 42."), 42), true);
  assert.equal(isMissingTabError(new Error("No tab with id: 42"), 42), true);
  for (const message of ["No tab with id: 43.", "Failed to fetch", "HTTP 403", "The message port closed before a response was received.", "Unrelated: No tab with id: 42."]) {
    assert.equal(isMissingTabError(new Error(message), 42), false);
  }
});

test("关闭自动恢复后保留错误且不新建替代页", async () => {
  const events = [];
  const worker = await createPageWorker({
    tabs: {
      create: async () => { events.push("create"); return 42; },
      close: async (id) => { events.push(`close:${id}`); },
      forget: (id) => { events.push(`forget:${id}`); }
    },
    isStopped: () => false,
    onRecovery: () => assert.fail("恢复已关闭"),
    recoveryLimit: 0
  });
  await assert.rejects(worker.run(async () => { throw new Error("No tab with id: 42."); }), (error) => {
    assert.ok(error instanceof PageTabRecoveryError);
    assert.match(error.message, /恢复上限/);
    return true;
  });
  await worker.close();
  assert.deepEqual(events, ["create", "forget:42"]);
});

test("其他标签页错误原样上报，不替换仍存在的工作页", async () => {
  let creates = 0;
  const worker = await createPageWorker({
    tabs: {
      create: async () => { creates += 1; return 42; },
      close: async (id) => assert.equal(id, 42),
      forget: () => assert.fail("不能放弃有效工作页")
    },
    isStopped: () => false,
    onRecovery: () => assert.fail("不能重建")
  });
  const failure = new Error("No tab with id: 999.");
  await assert.rejects(worker.run(async () => { throw failure; }), (error) => error === failure);
  assert.equal(await worker.run(async (id) => id), 42);
  assert.equal(creates, 1);
  await worker.close();
});
