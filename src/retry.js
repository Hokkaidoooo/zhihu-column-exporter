export async function retryOperation(operation, options = {}) {
  const {
    attempts = 3,
    delays = [1500, 3500],
    shouldRetry = () => true,
    onRetry = () => {},
    wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))
  } = options;

  if (!Number.isInteger(attempts) || attempts < 1) throw new TypeError("attempts 必须是正整数");

  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await operation(attempt);
    } catch (error) {
      lastError = error;
      if (attempt >= attempts || !shouldRetry(error, attempt)) throw error;
      const delayMs = delays[Math.min(attempt - 1, delays.length - 1)] ?? 0;
      await onRetry({ error, attempt, nextAttempt: attempt + 1, delayMs });
      if (delayMs > 0) await wait(delayMs);
    }
  }
  throw lastError;
}
