// Subscribe before starting: a small Blob download can finish before its ID is returned.
export async function saveBlob(blob, fileName, downloads, urlApi = URL) {
  const objectUrl = urlApi.createObjectURL(blob);
  let downloadId = null;
  const early = new Map();
  let finish;
  const completion = new Promise((resolve) => { finish = resolve; });
  const inspect = (item) => {
    if (item.state === "complete") finish();
    if (item.state === "interrupted") finish(new Error(`文件保存中断：${item.error || "浏览器未完成下载"}`));
  };
  const onChanged = (change) => {
    const item = { state: change.state?.current, error: change.error?.current };
    if (downloadId === null) { early.set(change.id, item); return; }
    if (change.id === downloadId) inspect(item);
  };
  downloads.onChanged.addListener(onChanged);
  try {
    downloadId = await downloads.download({ url: objectUrl, filename: fileName, saveAs: true });
    const items = await downloads.search({ id: downloadId });
    if (!items.length) throw new Error("浏览器未返回文件保存状态");
    inspect(items[0]);
    if (early.has(downloadId)) inspect(early.get(downloadId));
    const error = await completion;
    if (error) throw error;
    return downloadId;
  } finally {
    downloads.onChanged.removeListener(onChanged);
    urlApi.revokeObjectURL(objectUrl);
  }
}
