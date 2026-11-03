import { delay, throwIfAborted } from "./cancellation.js";

export async function retryOperation(operation, options = {}) {
  const {
    attempts = 3,
    delays = [1500, 3500],
    shouldRetry = () => true,
    onRetry = () => {},
    wait = delay,
    signal
  } = options;

  if (!Number.isInteger(attempts) || attempts < 1) throw new TypeError("attempts 必须是正整数");

  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    throwIfAborted(signal);
    try {
      return await operation(attempt);
    } catch (error) {
      lastError = error;
      throwIfAborted(signal);
      if (error?.name === "AbortError" || attempt >= attempts || !shouldRetry(error, attempt)) throw error;
      const delayMs = Math.max(error?.retryAfterMs || 0, delays[Math.min(attempt - 1, delays.length - 1)] ?? 0);
      await onRetry({ error, attempt, nextAttempt: attempt + 1, delayMs });
      if (delayMs > 0) await wait(delayMs, signal);
    }
  }
  throw lastError;
}
