import { Zip, ZipDeflate, ZipPassThrough, strToU8 } from "fflate";
import { delay } from "./cancellation.js";

const CHUNK_BYTES = 64 * 1024;

// One bounded compressor; compressed images pass through without extra workers.
// ZIP chunks become Blob parts, avoiding a second contiguous archive buffer.
export function createArchive({ yieldControl = () => delay(0) } = {}) {
  const parts = [];
  const paths = new Set();
  let failure = null;
  let finished = false;
  let tail = Promise.resolve();
  const archive = new Zip((error, bytes, final) => {
    if (error) { failure = error; return; }
    if (bytes.length) parts.push(bytes);
    if (final) finished = true;
  });

  const append = async (path, input, compress) => {
    if (failure) throw failure;
    if (finished) throw new Error("压缩包已经结束");
    if (paths.has(path)) throw new Error(`压缩包路径重复：${path}`);
    paths.add(path);
    const bytes = typeof input === "string" ? strToU8(input) : input;
    const entry = compress ? new ZipDeflate(path, { level: 6 }) : new ZipPassThrough(path);
    archive.add(entry);
    if (!bytes.length) entry.push(bytes, true);
    for (let offset = 0; offset < bytes.length; offset += CHUNK_BYTES) {
      entry.push(bytes.subarray(offset, offset + CHUNK_BYTES), offset + CHUNK_BYTES >= bytes.length);
      if (failure) throw failure;
      await yieldControl();
    }
  };

  return {
    add(path, bytes, { compress = true } = {}) {
      const result = tail.then(() => append(path, bytes, compress));
      tail = result;
      return result;
    },
    async finish() {
      await tail;
      archive.end();
      if (failure) throw failure;
      if (!finished) throw new Error("压缩包未能完成");
      const blob = new Blob(parts, { type: "application/zip" });
      parts.length = 0;
      return blob;
    },
    get count() { return paths.size; }
  };
}
