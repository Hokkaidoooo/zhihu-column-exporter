import test from "node:test";
import assert from "node:assert/strict";
import { saveBlob } from "../src/download.js";

function fixture({ start, search } = {}) {
  const listeners = new Set();
  const revoked = [];
  const emit = (item) => { for (const listener of listeners) listener(item); };
  const downloads = {
    onChanged: { addListener: (fn) => listeners.add(fn), removeListener: (fn) => listeners.delete(fn) },
    download: async () => { await start?.(emit); return 7; },
    search: search || (async () => [{ id: 7, state: "in_progress" }])
  };
  const urls = { createObjectURL: () => "blob:synthetic", revokeObjectURL: (url) => revoked.push(url) };
  return { downloads, urls, listeners, revoked, emit };
}

test("下载 ID 返回前的完成事件不会丢失，监听和 Blob 链接随后释放", async () => {
  const f = fixture({ start: async (emit) => emit({ id: 7, state: { current: "complete" } }) });
  assert.equal(await saveBlob(new Blob(["synthetic"]), "example.zip", f.downloads, f.urls), 7);
  assert.equal(f.listeners.size, 0);
  assert.deepEqual(f.revoked, ["blob:synthetic"]);
});

test("其他下载完成不能提前结束本次保存，等待目标完成后才释放 Blob", async () => {
  let searched;
  const ready = new Promise((resolve) => { searched = resolve; });
  const f = fixture({ search: async () => { searched(); return [{ id: 7, state: "in_progress" }]; } });
  let complete = false;
  const saving = saveBlob(new Blob(), "example.zip", f.downloads, f.urls).then(() => { complete = true; });
  await ready;
  f.emit({ id: 8, state: { current: "complete" } });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(complete, false);
  assert.equal(f.revoked.length, 0);
  f.emit({ id: 7, state: { current: "complete" } });
  await saving;
  assert.equal(f.listeners.size, 0);
  assert.equal(f.revoked.length, 1);
});

test("保存状态查询失败仍明确失败，并释放监听和 Blob 链接", async () => {
  const f = fixture({ search: async () => { throw new Error("synthetic search failure"); } });
  await assert.rejects(saveBlob(new Blob(), "example.zip", f.downloads, f.urls), /search failure/);
  assert.equal(f.listeners.size, 0);
  assert.equal(f.revoked.length, 1);
});
