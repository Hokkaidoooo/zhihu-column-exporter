import { requestResource, httpError } from "./request.js";
import { retryOperation } from "./retry.js";
import { throwIfAborted } from "./cancellation.js";
import { mapWithConcurrency } from "./concurrency.js";
import { escapeHtml, padNumber } from "./shared.js";

export const IMAGE_CONCURRENCY = 4;
export const IMAGE_CACHE_BYTES = 16 * 1024 * 1024;
export const LOCALIZE_SVG_IMAGES = true;

export function createImageCache(maxBytes = IMAGE_CACHE_BYTES) {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 0) throw new TypeError("图片缓存容量必须是非负安全整数");
  const entries = new Map();
  let size = 0;
  return {
    get(url) {
      const entry = entries.get(url);
      if (entry) { entries.delete(url); entries.set(url, entry); }
      return entry;
    },
    set(url, entry) {
      if (entries.has(url)) { size -= entries.get(url).bytes.length; entries.delete(url); }
      if (entry.bytes.length > maxBytes || maxBytes === 0) return;
      while (size + entry.bytes.length > maxBytes) {
        const oldest = entries.keys().next().value;
        size -= entries.get(oldest).bytes.length;
        entries.delete(oldest);
      }
      entries.set(url, entry);
      size += entry.bytes.length;
    },
    get bytes() { return size; }
  };
}

function startsWith(bytes, values) {
  return values.every((value, index) => bytes[index] === value);
}

export function imageType(bytes, contentType) {
  const mime = String(contentType || "").split(";")[0].trim().toLowerCase();
  if (mime && !mime.startsWith("image/") && mime !== "application/octet-stream") {
    throw new Error(`图片请求返回了 ${mime}，不是图片`);
  }
  if (startsWith(bytes, [137, 80, 78, 71, 13, 10, 26, 10])) return { extension: "png", mime: "image/png" };
  if (startsWith(bytes, [255, 216, 255])) return { extension: "jpg", mime: "image/jpeg" };
  const head = String.fromCharCode(...bytes.subarray(0, 32));
  if (/^GIF8[79]a/.test(head)) return { extension: "gif", mime: "image/gif" };
  if (head.startsWith("RIFF") && head.slice(8, 12) === "WEBP") return { extension: "webp", mime: "image/webp" };
  if (head.slice(4, 8) === "ftyp" && /avif|avis/.test(head.slice(8))) return { extension: "avif", mime: "image/avif" };
  if (mime === "image/svg+xml") return { extension: "svg", mime };
  throw new Error("图片数据格式无效或不受支持");
}

function validateSvg(bytes) {
  const document = new DOMParser().parseFromString(new TextDecoder().decode(bytes), "image/svg+xml");
  const root = document.documentElement;
  if (root.localName !== "svg" || document.querySelector("parsererror")) throw new Error("SVG 图片无法解析");
  if (document.doctype || [...document.childNodes].some((node) => node.nodeType === 7)) {
    throw new Error("SVG 包含文档声明或处理指令，未保存为本地图片");
  }
  for (const element of [root, ...root.querySelectorAll("*")]) {
    if (element.namespaceURI !== "http://www.w3.org/2000/svg"
      || /^(script|foreignobject|iframe|object|embed|style|a|set|animate.*|discard)$/i.test(element.localName)) {
      throw new Error("SVG 包含活动内容，未保存为本地图片");
    }
    for (const attribute of element.attributes) {
      const externalCssUrl = [...attribute.value.matchAll(/url\(\s*([^)]*)\)/gi)]
        .some((match) => !match[1].replace(/^["']|["']$/g, "").trim().startsWith("#"));
      if (/^on|^xml:base$/i.test(attribute.name) || (/href$|^src$/i.test(attribute.name) && !attribute.value.startsWith("#"))
        || externalCssUrl || /[@\\]/.test(attribute.value)) {
        throw new Error("SVG 包含活动内容或外部资源，未保存为本地图片");
      }
    }
  }
}

export async function validateImage(bytes, contentType, decode = globalThis.createImageBitmap) {
  const type = imageType(bytes, contentType);
  if (type.extension === "svg") {
    if (!LOCALIZE_SVG_IMAGES) throw new Error("已关闭 SVG 本地保存，保留原图地址");
    validateSvg(bytes);
  }
  else {
    try {
      const bitmap = await decode(new Blob([bytes], { type: type.mime }), { resizeWidth: 1, resizeHeight: 1 });
      bitmap.close();
    } catch (error) {
      throw new Error(`图片数据无法解码：${error.message || error}`);
    }
  }
  return type;
}

export async function downloadImage(url, { signal, request = fetch, validate = validateImage } = {}) {
  const parsed = new URL(url);
  if (!["https:", "http:"].includes(parsed.protocol) && !/^data:image\//i.test(url)) throw new Error("图片地址协议不受支持");
  return retryOperation(() => requestResource(url, {
    request,
    signal,
    credentials: "include",
    read: async (response) => {
      if (!response.ok) throw httpError(response);
      const bytes = new Uint8Array(await response.arrayBuffer());
      const type = await validate(bytes, response.headers.get("content-type"));
      return { bytes, ...type };
    }
  }), { attempts: 3, delays: [700, 1800], signal, shouldRetry: (error) => error.retryable === true });
}

// URLs, not article positions, own downloads. Only small path/result metadata
// remains after each resource has been appended to the archive.
export async function archiveImages(articles, archive, { signal, cache, onProgress = () => {}, download = downloadImage } = {}) {
  const tasks = new Map();
  articles.forEach((article, articleIndex) => {
    (article.images || []).forEach((image, imageIndex) => {
      if (!tasks.has(image.url)) tasks.set(image.url, {
        url: image.url,
        prefix: `assets/${padNumber(articleIndex + 1)}/${padNumber(imageIndex + 1, 2)}`
      });
    });
  });
  const results = new Map();
  let done = 0;
  await mapWithConcurrency([...tasks.values()], IMAGE_CONCURRENCY, async (task) => {
    let resource;
    try {
      resource = cache?.get(task.url);
      if (!resource) {
        throwIfAborted(signal);
        resource = await download(task.url, { signal });
        cache?.set(task.url, resource);
      }
    } catch (error) {
      results.set(task.url, { ok: false, reason: error.message || String(error) });
      onProgress(++done, tasks.size);
      return;
    }
    const path = `${task.prefix}.${resource.extension}`;
    await archive.add(path, resource.bytes, { compress: resource.extension === "svg" });
    results.set(task.url, { ok: true, path });
    onProgress(++done, tasks.size);
  });
  return results;
}

export function localizeArticleImages(article, results = null) {
  const byPlaceholder = new Map((article.images || []).map((image) => [image.placeholder, image]));
  const failures = [];
  for (const image of article.images || []) {
    if (!results) continue;
    const result = results.get(image.url);
    if (!result) throw new Error("图片下载结果缺失");
    if (!result.ok) failures.push({ sectionId: article.sectionId, title: article.title, url: image.url, reason: result.reason });
  }
  const replace = (body, html) => String(body).replace(/__ZHIHU_EXPORT_IMAGE_[A-Za-z0-9_]+__/g, (placeholder) => {
    const image = byPlaceholder.get(placeholder);
    if (!image) return placeholder;
    const result = results?.get(image.url);
    const path = result?.ok ? `../${result.path}` : image.url;
    return html ? escapeHtml(path) : path.replace(/[\s()<>]/g, (character) =>
      character === "(" ? "%28" : character === ")" ? "%29" : encodeURIComponent(character));
  });
  return { markdown: replace(article.markdown, false), html: replace(article.html, true), failures };
}
