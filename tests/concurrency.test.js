import test from "node:test";
import assert from "node:assert/strict";
import { mapWithConcurrency } from "../src/concurrency.js";

test("失败后停止领取新任务，并等已启动任务收尾再报错", async () => {
  const started = [];
  let release;
  let finished = false;
  const hold = new Promise((resolve) => { release = resolve; });
  const operation = mapWithConcurrency([1, 2, 3, 4], 2, async (value) => {
    started.push(value);
    if (value === 1) throw new Error("synthetic failure");
    await hold;
    finished = true;
  });
  const failure = assert.rejects(operation, /synthetic failure/);
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(started, [1, 2]);
  release();
  await failure;
  assert.equal(finished, true);
});

test("并发处理保持输入顺序且不超过上限", async () => {
  let active = 0;
  let maximum = 0;
  const result = await mapWithConcurrency([1, 2, 3, 4, 5, 6, 7], 3, async (value) => {
    active += 1;
    maximum = Math.max(maximum, active);
    await new Promise((resolve) => setTimeout(resolve, (8 - value) * 2));
    active -= 1;
    return value * 10;
  });
  assert.equal(maximum, 3);
  assert.deepEqual(result, [10, 20, 30, 40, 50, 60, 70]);
});
