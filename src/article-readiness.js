const NOT_READY = "";

function articleFingerprint(result) {
  if (!result?.ok) return NOT_READY;
  return JSON.stringify([
    result.sectionId || "",
    result.title || "",
    result.markdown || "",
    result.html || "",
    (result.images || []).map(({ url }) => url)
  ]);
}

/**
 * Polls a fingerprint until it stops changing. Chrome throttles timers inside
 * hidden tabs to about one tick per second, so the caller that owns the clock
 * should be a visible page (the export tab) rather than the background article
 * tab being measured. Stability is accumulated from the requested interval, so
 * a throttled clock only ever waits longer than asked — never less.
 */
export async function settleFingerprint({
  sample,
  wait,
  attempts = 200,
  intervalMs = 100,
  stableSamples = 3,
  minimumStableMs = 300,
  emptyLimit = Infinity
}) {
  if (typeof sample !== "function" || typeof wait !== "function") {
    throw new TypeError("正文采样器和等待函数必须是函数");
  }
  if (!Number.isInteger(attempts) || attempts < 1
    || !Number.isInteger(stableSamples) || stableSamples < 1
    || !Number.isFinite(minimumStableMs) || minimumStableMs < 0) {
    throw new TypeError("正文等待次数必须是正整数");
  }

  let lastFingerprint = NOT_READY;
  let matchingSamples = 0;
  let stableDurationMs = 0;
  let samples = 0;
  let consecutiveEmpty = 0;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (attempt > 0) await wait(intervalMs);
    const fingerprint = String((await sample()) ?? NOT_READY);
    samples += 1;
    if (!fingerprint) {
      lastFingerprint = NOT_READY;
      matchingSamples = 0;
      stableDurationMs = 0;
      consecutiveEmpty += 1;
      // A page that never produces any body (a paywall stub, or a section that
      // simply is not there) would otherwise burn the whole attempt budget.
      if (consecutiveEmpty >= emptyLimit) break;
      continue;
    }

    consecutiveEmpty = 0;
    if (fingerprint === lastFingerprint) {
      matchingSamples += 1;
      stableDurationMs += intervalMs;
    } else {
      matchingSamples = 1;
      stableDurationMs = 0;
    }
    lastFingerprint = fingerprint;
    if (matchingSamples >= stableSamples && stableDurationMs >= minimumStableMs) {
      return { settled: true, fingerprint, samples };
    }
  }
  return { settled: false, fingerprint: lastFingerprint, samples };
}

export async function waitForArticleExtraction({
  extract,
  wait,
  probe = null,
  attempts = 30,
  intervalMs = 150,
  stableSamples = 3,
  minimumStableMs = 300,
  emptyLimit = Infinity
}) {
  if (typeof extract !== "function") throw new TypeError("正文提取器必须是函数");
  if (probe !== null && typeof probe !== "function") throw new TypeError("正文探针必须是函数");

  let result = null;
  // Without a probe every stability sample pays for a full Markdown
  // conversion; with one, the conversion runs once the DOM has settled.
  const sample = probe
    ? () => String(probe()?.fingerprint ?? NOT_READY)
    : () => {
      result = extract();
      return articleFingerprint(result);
    };

  const settle = await settleFingerprint({
    sample,
    wait,
    attempts,
    intervalMs,
    stableSamples,
    minimumStableMs,
    emptyLimit
  });
  if (probe) result = extract();
  if (settle.settled) return result;
  return result?.ok ? { ok: false, reason: "正文内容在等待期间仍在变化，请重试" } : result;
}

export function isMessageChannelClosed(error) {
  return /(message channel closed|receiving end does not exist|could not establish connection)/i
    .test(error?.message || String(error || ""));
}

export function messageChannelClosedError() {
  return new Error("文章页在正文提取期间发生了跳转，等待页面稳定后仍未返回结果");
}
