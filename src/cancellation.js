export function abortError(message = "用户停止导出") {
  const error = new Error(message);
  error.name = "AbortError";
  return error;
}

export function throwIfAborted(signal) {
  if (signal?.aborted) throw signal.reason || abortError();
}

export function abortable(operation, signal) {
  if (!signal) return operation;
  return new Promise((resolve, reject) => {
    const onAbort = () => { signal.removeEventListener("abort", onAbort); reject(signal.reason || abortError()); };
    signal.addEventListener("abort", onAbort, { once: true });
    Promise.resolve(operation).then(resolve, reject).finally(() => signal.removeEventListener("abort", onAbort));
    if (signal.aborted) onAbort();
  });
}

export function delay(milliseconds, signal) {
  throwIfAborted(signal);
  return new Promise((resolve, reject) => {
    const finish = () => { signal?.removeEventListener("abort", onAbort); resolve(); };
    const timer = setTimeout(finish, milliseconds);
    const onAbort = () => {
      clearTimeout(timer);
      signal.removeEventListener("abort", onAbort);
      reject(signal.reason || abortError());
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}
