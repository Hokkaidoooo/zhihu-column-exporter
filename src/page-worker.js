export const PAGE_TAB_RECOVERY_LIMIT = 2;

export class PageTabRecoveryError extends Error {}

export function isMissingTabError(error, tabId) {
  const match = /^No tab with id:\s*(\d+)\.?$/.exec(String(error?.message || error).trim());
  return Boolean(match) && Number(match[1]) === tabId;
}

// Each worker owns one current tab. Recovery replaces that tab, never the worker.
export async function createPageWorker({ tabs, isStopped, onRecovery, recoveryLimit = PAGE_TAB_RECOVERY_LIMIT }) {
  if (!Number.isInteger(recoveryLimit) || recoveryLimit < 0) throw new TypeError("recoveryLimit 必须是非负整数");
  let tabId = null;
  let recoveries = 0;

  async function close() {
    if (tabId === null) return;
    const closingId = tabId;
    await tabs.close(closingId);
    if (tabId === closingId) tabId = null;
  }

  async function open() {
    if (isStopped()) throw new Error("导出已停止");
    tabId = await tabs.create();
    if (!isStopped()) return;
    // Cancellation may happen while Chrome is still creating the new tab.
    await close();
    throw new Error("导出已停止");
  }

  async function recover(error) {
    const previousId = tabId;
    tabId = null;
    tabs.forget(previousId);
    if (recoveries >= recoveryLimit) {
      throw new PageTabRecoveryError(`读取标签页已失效，达到本轮恢复上限（每路 ${recoveryLimit} 次），已停止读取；可保存结果后重试未完成`, { cause: error });
    }
    recoveries += 1;
    try {
      await open();
    } catch (createError) {
      if (isStopped()) throw createError;
      throw new PageTabRecoveryError(`无法重建读取标签页，已停止读取：${createError.message || createError}`, { cause: createError });
    }
    onRecovery({ previousId, tabId, attempt: recoveries, limit: recoveryLimit });
  }

  async function run(operation) {
    while (!isStopped()) {
      try {
        return await operation(tabId);
      } catch (error) {
        if (isStopped() || !isMissingTabError(error, tabId)) throw error;
        await recover(error);
      }
    }
    throw new Error("导出已停止");
  }

  await open();
  return { run, close };
}
