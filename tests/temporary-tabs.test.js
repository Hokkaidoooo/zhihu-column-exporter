import test from "node:test";
import assert from "node:assert/strict";
import { createTemporaryTabs } from "../src/temporary-tabs.js";

function fixture({ limit = 4, create = null, remove = null } = {}) {
  const live = new Set();
  const removals = [];
  const replacements = [];
  const failures = [];
  let nextId = 10;
  let replace;
  const pool = createTemporaryTabs({
    limit,
    tabs: {
      onReplaced: { addListener: (listener) => { replace = listener; } },
      create: create || (async () => { const id = nextId++; live.add(id); return { id }; }),
      remove: async (id) => { removals.push(id); await remove?.(id); live.delete(id); }
    },
    onReplaced: (event) => replacements.push(event),
    onCloseError: (error) => failures.push(error)
  });
  return { pool, live, removals, replacements, failures, replace: (...args) => replace(...args) };
}

test("四个页面的名额已占用时不调用第五次创建", async () => {
  const f = fixture();
  const pages = await Promise.all(Array.from({ length: 4 }, () => f.pool.create()));
  await assert.rejects(f.pool.create(), /不能超过 4 页/);
  assert.equal(f.live.size, 4);
  await pages[0].close();
  await f.pool.create();
  assert.equal(f.live.size, 4);
  await f.pool.closeAll();
  assert.equal(f.live.size, 0);
});

test("尚未返回的创建请求也预占四页名额", async () => {
  const pending = [];
  const f = fixture({ create: () => new Promise((resolve) => pending.push(resolve)) });
  const pages = Array.from({ length: 4 }, () => f.pool.create());
  await assert.rejects(f.pool.create(), /不能超过 4 页/);
  assert.equal(pending.length, 4);
  pending.forEach((resolve, index) => resolve({ id: index + 10 }));
  await Promise.all(pages);
  await f.pool.closeAll();
  assert.deepEqual(f.removals, [10, 11, 12, 13]);
});

test("创建尚未返回时连续更换 ID，最终关闭最新页面", async () => {
  let finishCreate;
  const f = fixture({ create: () => new Promise((resolve) => { finishCreate = resolve; }) });
  const pending = f.pool.create();
  f.replace(11, 10);
  f.replace(12, 11);
  finishCreate({ id: 10 });
  const page = await pending;
  assert.equal(page.id, 12);
  await page.close();
  assert.deepEqual(f.removals, [12]);
  assert.deepEqual(f.replacements, [{ previousId: 10, tabId: 12 }]);
});

test("非本任务的标签页更换 ID 不被接管或关闭", async () => {
  const f = fixture();
  const page = await f.pool.create();
  f.replace(900, 899);
  assert.equal(page.id, 10);
  await f.pool.closeAll();
  assert.deepEqual(f.removals, [10]);
  assert.deepEqual(f.replacements, []);
});

test("停止与正常收尾同时关闭同一页只发出一次关闭请求", async () => {
  let finishRemove;
  const f = fixture({ remove: () => new Promise((resolve) => { finishRemove = resolve; }) });
  const page = await f.pool.create();
  const closing = f.pool.closeAll();
  const duplicate = page.close();
  assert.deepEqual(f.removals, [10]);
  finishRemove();
  await Promise.all([closing, duplicate]);
  assert.equal(f.live.size, 0);
});

test("关闭失败时保留所有权和占用名额，后续可继续回收", async () => {
  let fail = true;
  const error = new Error("合成测试：关闭被拒绝");
  const f = fixture({ limit: 1, remove: async () => { if (fail) throw error; } });
  await f.pool.create();
  await assert.rejects(f.pool.closeAll(), /关闭被拒绝/);
  await assert.rejects(f.pool.create(), /不能超过 1 页/);
  assert.deepEqual(f.failures, [error]);
  assert.equal(f.live.size, 1);
  fail = false;
  await f.pool.closeAll();
  assert.equal(f.live.size, 0);
  await f.pool.create();
  assert.equal(f.live.size, 1);
});

test("关闭时其他 ID 的 No tab 错误不能伪装成本页回收成功", async () => {
  const f = fixture({ remove: async () => { throw new Error("No tab with id: 999."); } });
  const page = await f.pool.create();
  await assert.rejects(page.close(), /No tab with id: 999/);
  assert.equal(f.live.size, 1);
  assert.equal(f.failures.length, 1);
});

test("一个页关闭失败后仍等待其余页完成回收才报错", async () => {
  let finishRemove;
  let settled = false;
  const f = fixture({ remove: async (id) => {
    if (id === 10) throw new Error("合成测试：关闭失败");
    await new Promise((resolve) => { finishRemove = resolve; });
  } });
  await f.pool.create();
  await f.pool.create();
  const closed = f.pool.closeAll().finally(() => { settled = true; });
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(settled, false);
  finishRemove();
  await assert.rejects(closed, /关闭失败/);
  assert.deepEqual([...f.live], [10]);
});
