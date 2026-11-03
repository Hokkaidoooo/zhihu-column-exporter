export async function mapWithConcurrency(items, concurrency, operation) {
  if (!Number.isInteger(concurrency) || concurrency < 1) throw new TypeError("并发数必须是正整数");
  if (typeof operation !== "function") throw new TypeError("并发任务必须是函数");

  const results = new Array(items.length);
  let cursor = 0;
  let failure = null;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (cursor < items.length && !failure) {
      const index = cursor;
      cursor += 1;
      try {
        results[index] = await operation(items[index], index);
      } catch (error) {
        failure = error;
      }
    }
  });
  await Promise.all(workers);
  if (failure) throw failure;
  return results;
}
