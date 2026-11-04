import { isMissingTabError } from "./page-worker.js";

// A handle owns the page, even when Chrome replaces its tab ID during navigation.
export function createTemporaryTabs({ tabs, limit, onReplaced, onCloseError }) {
  if (!Number.isInteger(limit) || limit < 1) throw new TypeError("limit 必须是正整数");
  const owned = new Set();
  const pendingReplacements = new Map();
  let creating = 0;

  tabs.onReplaced.addListener((addedId, removedId) => {
    for (const entry of owned) {
      if (entry.id !== removedId) continue;
      entry.id = addedId;
      onReplaced({ previousId: removedId, tabId: addedId });
      return;
    }
    // A replacement event can arrive before tabs.create resolves with the old ID.
    if (creating) pendingReplacements.set(removedId, addedId);
  });

  function track(id) {
    const entry = { id };
    let closing = null;
    async function remove() {
      while (owned.has(entry)) {
        const closingId = entry.id;
        try {
          await tabs.remove(closingId);
        } catch (error) {
          if (!isMissingTabError(error, closingId)) {
            onCloseError(error);
            throw error;
          }
        }
        if (entry.id === closingId) owned.delete(entry);
      }
    }
    entry.close = () => {
      if (!closing) closing = remove().finally(() => { closing = null; });
      return closing;
    };
    owned.add(entry);
    return { get id() { return entry.id; }, close: entry.close };
  }

  async function create(url = "about:blank") {
    if (owned.size + creating >= limit) throw new Error(`读取标签页尚未回收，不能超过 ${limit} 页`);
    creating += 1;
    try {
      const tab = await tabs.create({ url, active: false });
      let id = tab.id;
      while (pendingReplacements.has(id)) id = pendingReplacements.get(id);
      const handle = track(id);
      if (id !== tab.id) onReplaced({ previousId: tab.id, tabId: id });
      return handle;
    } finally {
      creating -= 1;
      if (!creating) pendingReplacements.clear();
    }
  }

  async function closeAll() {
    const results = await Promise.allSettled([...owned].map((entry) => entry.close()));
    const failures = results.filter((result) => result.status === "rejected").map((result) => result.reason);
    if (failures.length) throw new AggregateError(failures, `读取标签页回收失败：${failures.map((error) => error.message || error).join("；")}`);
  }

  return { create, closeAll };
}
