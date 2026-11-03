import { abortable, throwIfAborted } from "./cancellation.js";

export const REQUEST_TIMEOUT_MS = 20000;

export function httpError(response) {
  const error = new Error(`HTTP ${response.status}`);
  error.status = response.status;
  error.retryable = response.status === 408 || response.status === 429 || response.status >= 500;
  const retryAfter = response.headers?.get?.("retry-after");
  if (retryAfter) {
    const seconds = Number(retryAfter);
    const milliseconds = Number.isFinite(seconds) ? seconds * 1000 : Date.parse(retryAfter) - Date.now();
    if (Number.isFinite(milliseconds)) error.retryAfterMs = Math.min(60000, Math.max(0, milliseconds));
  }
  return error;
}

// The deadline includes reading the response body, not just receiving headers.
export async function requestResource(url, { request = fetch, signal, timeoutMs = REQUEST_TIMEOUT_MS, read, ...options }) {
  throwIfAborted(signal);
  const controller = new AbortController();
  const cancel = () => controller.abort(signal.reason);
  signal?.addEventListener("abort", cancel, { once: true });
  const timeout = new Error(`请求超过 ${timeoutMs / 1000} 秒未完成`);
  timeout.retryable = true;
  const timer = timeoutMs > 0 ? setTimeout(() => controller.abort(timeout), timeoutMs) : null;
  try {
    return await abortable((async () => {
      let receivedResponse = false;
      try {
        const response = await request(url, { ...options, signal: controller.signal });
        receivedResponse = true;
        return await read(response);
      } catch (error) {
        if (controller.signal.aborted) throw controller.signal.reason;
        // Fetch uses TypeError for transport failures, including interrupted bodies.
        if ((!receivedResponse || error.name === "TypeError") && error.retryable === undefined) error.retryable = true;
        throw error;
      }
    })(), controller.signal);
  } finally {
    if (timer !== null) clearTimeout(timer);
    signal?.removeEventListener("abort", cancel);
  }
}
