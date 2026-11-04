import { canonicalSectionUrl, parsePaidColumnUrl, uniqueBy, exactNumericId, parseExactJsonNumbers } from "./shared.js";

const TITLE_SELECTORS = [
  "h1",
  '[class*="BookInfo-title"]',
  '[class*="Column-title"]',
  '[class*="PaidColumn"] [class*="title"]',
  "main h2"
];

const CONTENT_SELECTORS = [
  ".RichText",
  '[class~="RichText"]',
  '[class*="RichText"]',
  "article",
  '[class*="SectionContent"]',
  '[class*="section-content"]',
  '[class*="Content-content"]',
  "main"
];

const REMOVE_SELECTORS = [
  "script",
  "style",
  "noscript",
  "template",
  "button",
  "input",
  "textarea",
  "select",
  "iframe",
  "nav",
  "aside",
  "footer",
  '[role="navigation"]',
  '[class*="Comments-container"]',
  '[class*="Recommendations"]',
  '[class*="Reward"]',
  '[class*="ShareMenu"]',
  '[class*="Modal"]'
];

const ACCESS_LOCK_PATTERN = /(订阅后.{0,8}(阅读|解锁)|购买后.{0,8}阅读|立即订阅|登录后.{0,8}(查看|阅读)|试看已结束)/;

function cleanText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function usefulTitle(value) {
  const title = cleanText(value)
    .replace(/\s*[-–|]\s*知乎\s*$/, "")
    .replace(/^知乎\s*[-–|]\s*/, "");
  if (!title || title === "知乎" || title.length > 180) return "";
  return title;
}

export function detectPageTitle(document, fallback = "知乎付费专栏") {
  for (const selector of TITLE_SELECTORS) {
    for (const element of document.querySelectorAll(selector)) {
      const title = usefulTitle(element.textContent);
      if (title) return title;
    }
  }
  return usefulTitle(document.title) || fallback;
}

export function inferPaidColumnInfo(document, pageUrl) {
  const direct = parsePaidColumnUrl(pageUrl);
  if (direct?.columnId) return direct;

  for (const element of document.querySelectorAll('link[rel="canonical"][href],meta[property="og:url"][content],a[href]')) {
    const value = element.getAttribute("href") || element.getAttribute("content");
    if (!value) continue;
    let candidate;
    try {
      candidate = new URL(value, pageUrl).href;
    } catch {
      // Ignore malformed page-owned URLs.
      continue;
    }
    const parsed = parsePaidColumnUrl(candidate);
    if (!parsed) continue;
    if (direct?.sectionId && parsed.columnId) {
      return { columnId: parsed.columnId, sectionId: direct.sectionId, kind: "section" };
    }
    if (parsed.columnId) return parsed;
  }

  const markup = document.documentElement?.innerHTML?.replaceAll("\\/", "/") || "";
  const urlMatch = markup.match(/(?:https?:\/\/www\.zhihu\.com)?\/(?:xen\/market\/(?:remix\/)?|market\/)paid_column\/(\d+)(?:\/section\/(\d+))?/);
  if (urlMatch) {
    return {
      columnId: urlMatch[1],
      sectionId: urlMatch[2] || null,
      kind: urlMatch[2] ? "section" : "catalog"
    };
  }

  const columnMatch = markup.match(/["'](?:columnId|column_id|paidColumnId|paid_column_id)["']\s*:\s*["']?((?:c_)?\d+)/i);
  const sectionMatch = markup.match(/["'](?:sectionId|section_id)["']\s*:\s*["']?(\d+)/i);
  if (!columnMatch) return direct;
  const columnId = direct?.sectionId && !String(columnMatch[1]).startsWith("c_")
    ? `c_${columnMatch[1]}`
    : columnMatch[1];
  return {
    columnId,
    sectionId: direct?.sectionId || sectionMatch?.[1] || null,
    kind: direct?.sectionId || sectionMatch ? "section" : "catalog"
  };
}

function titleNear(element, sectionId) {
  const ownTitle = cleanText(element.getAttribute?.("title"));
  if (ownTitle) return ownTitle;

  const heading = element.querySelector?.("h2,h3,h4,[class*='title'],[class*='Title']");
  const headingText = cleanText(heading?.textContent);
  if (headingText) return headingText;

  const text = cleanText(element.textContent);
  if (text && text.length <= 180) return text;
  return `章节 ${sectionId}`;
}

function sectionFromDataset(element) {
  const raw = element.getAttribute("data-za-extra-module") || element.dataset?.zaExtraModule;
  if (!raw) return null;
  try {
    const data = parseExactJsonNumbers(raw);
    const id = data?.card?.content?.id ?? data?.content?.id ?? data?.section?.id;
    return exactNumericId(id);
  } catch {
    return null;
  }
}

export function extractColumnLinks(document, pageUrl, expectedColumnId = null) {
  const pageInfo = inferPaidColumnInfo(document, pageUrl);
  const columnId = expectedColumnId || pageInfo?.columnId;
  if (!columnId) return [];

  const standardColumn = /^c_\d+$/.test(columnId);
  if (standardColumn && pageInfo?.kind === "section" && pageInfo.sectionId) {
    return [{
      sectionId: pageInfo.sectionId,
      url: canonicalSectionUrl(columnId, pageInfo.sectionId),
      title: detectPageTitle(document)
    }];
  }

  const links = [];
  const add = (sectionId, title, orderHint = links.length) => {
    if (!/^\d+$/.test(String(sectionId || ""))) return;
    links.push({
      sectionId: String(sectionId),
      url: canonicalSectionUrl(columnId, sectionId),
      title: cleanText(title) || `章节 ${sectionId}`,
      orderHint
    });
  };

  for (const anchor of document.querySelectorAll("a[href]")) {
    let parsed;
    try {
      parsed = parsePaidColumnUrl(new URL(anchor.getAttribute("href"), pageUrl).href);
    } catch {
      continue;
    }
    const belongsToColumn = parsed?.columnId === columnId
      || (standardColumn && parsed?.sectionId && !parsed.columnId);
    if (belongsToColumn && parsed.sectionId) {
      add(parsed.sectionId, titleNear(anchor, parsed.sectionId));
    }
  }

  if (!standardColumn) {
    for (const element of document.querySelectorAll("[data-za-extra-module]")) {
      const sectionId = sectionFromDataset(element);
      if (sectionId) add(sectionId, titleNear(element, sectionId));
    }

    const markup = document.documentElement?.innerHTML?.replaceAll("\\/", "/") || "";
    const sectionPattern = new RegExp(`/market/paid_column/${columnId}/section/(\\d+)`, "g");
    for (const match of markup.matchAll(sectionPattern)) add(match[1], `章节 ${match[1]}`);
  }

  if (pageInfo?.columnId === columnId && pageInfo.sectionId && !links.some((item) => item.sectionId === pageInfo.sectionId)) {
    add(pageInfo.sectionId, detectPageTitle(document));
  }

  return uniqueBy(links, (item) => item.sectionId)
    .sort((a, b) => a.orderHint - b.orderHint)
    .map(({ orderHint, ...item }) => item);
}

function scoreContent(element) {
  const textLength = cleanText(element.textContent).length;
  if (textLength < 80) return -1;
  const className = String(element.className || "");
  let score = textLength + element.querySelectorAll("p").length * 80 + element.querySelectorAll("img").length * 180;
  if (/RichText/i.test(className)) score += 100000;
  if (element.tagName === "ARTICLE") score += 80000;
  if (element.tagName === "MAIN") score += 1000;
  return score;
}

export function selectContentRoot(document) {
  let best = null;
  let bestScore = -1;
  for (const element of document.querySelectorAll(CONTENT_SELECTORS.join(","))) {
    const score = scoreContent(element);
    if (score > bestScore) { best = element; bestScore = score; }
  }
  return best;
}

function bestImageSource(image, pageUrl) {
  const source = image.getAttribute("data-original")
    || image.getAttribute("data-actualsrc")
    || image.getAttribute("data-src")
    || image.currentSrc
    || image.getAttribute("src");
  if (!source || source.startsWith("blob:")) return null;
  try {
    return new URL(source, pageUrl).href;
  } catch {
    return source.startsWith("data:image/") ? source : null;
  }
}

function absolutizeLink(anchor, pageUrl) {
  const href = anchor.getAttribute("href");
  if (!href || href.startsWith("#")) return;
  try {
    const url = new URL(href, pageUrl);
    if (!["https:", "http:", "mailto:"].includes(url.protocol)) {
      anchor.removeAttribute("href");
      return;
    }
    anchor.setAttribute("href", url.href);
  } catch {
    anchor.removeAttribute("href");
  }
}

function stripAttributes(root) {
  for (const element of [root, ...root.querySelectorAll("*")]) {
    for (const attribute of [...element.attributes]) {
      const keep = ["href", "src", "alt", "title", "id", "colspan", "rowspan"].includes(attribute.name);
      if (!keep) element.removeAttribute(attribute.name);
    }
  }
}

export function sanitizeArticleRoot(root, pageUrl) {
  const clone = root.cloneNode(true);
  clone.querySelectorAll("[data-tex]").forEach((element) => {
    const tex = cleanText(element.getAttribute("data-tex"));
    if (!tex) return;
    const isBlock = element.tagName === "DIV" || /display|block/i.test(String(element.className || ""));
    const replacement = clone.ownerDocument.createElement(isBlock ? "div" : "span");
    replacement.textContent = isBlock ? `$$\n${tex}\n$$` : `$${tex}$`;
    element.replaceWith(replacement);
  });
  clone.querySelectorAll("iframe[src],video,audio").forEach((element) => {
    const source = element.getAttribute("src") || element.querySelector("source[src]")?.getAttribute("src");
    if (!source) return;
    let href;
    try {
      href = new URL(source, pageUrl).href;
    } catch {
      return;
    }
    const paragraph = clone.ownerDocument.createElement("p");
    const anchor = clone.ownerDocument.createElement("a");
    anchor.href = href;
    anchor.textContent = "查看原始媒体内容";
    paragraph.append(anchor);
    element.replaceWith(paragraph);
  });
  clone.querySelectorAll(REMOVE_SELECTORS.join(",")).forEach((node) => node.remove());
  clone.querySelectorAll("source").forEach((node) => node.remove());
  clone.querySelectorAll("svg").forEach((node) => node.remove());
  clone.querySelectorAll("a[href]").forEach((anchor) => absolutizeLink(anchor, pageUrl));

  const images = [];
  clone.querySelectorAll("img").forEach((image, index) => {
    const url = bestImageSource(image, pageUrl);
    if (!url) {
      image.remove();
      return;
    }
    const placeholder = `__ZHIHU_EXPORT_IMAGE_${index}__`;
    images.push({ placeholder, url, alt: cleanText(image.getAttribute("alt")) });
    image.setAttribute("src", placeholder);
    image.removeAttribute("srcset");
    image.removeAttribute("data-original");
    image.removeAttribute("data-actualsrc");
    image.removeAttribute("data-src");
  });

  stripAttributes(clone);
  return { root: clone, images };
}

function hasLockControl(document) {
  return [...document.querySelectorAll("button,a,[role='button']")]
    .some((element) => ACCESS_LOCK_PATTERN.test(cleanText(element.textContent)));
}

export function probeArticleDocument(document, pageUrl) {
  const pageInfo = inferPaidColumnInfo(document, pageUrl);
  if (!pageInfo?.sectionId) return { ok: false };

  const root = selectContentRoot(document);
  if (!root) return { ok: false };

  // A paywall stub is a legitimately stable DOM, so treat it as "not ready"
  // using exactly the extractor's condition: otherwise the cheap fingerprint
  // could settle on the teaser before Zhihu swaps in the purchased body.
  const bodyText = cleanText(document.body?.textContent);
  const text = cleanText(root.textContent);
  const textLength = text.length;
  if (ACCESS_LOCK_PATTERN.test(bodyText) && (hasLockControl(document) || textLength < 2000)) {
    return { ok: false };
  }

  // Only cheap DOM signals: enough to notice the paid body still growing or
  // lazy image sources still resolving, without running the full conversion.
  const images = root.querySelectorAll("img");
  const imageSources = [...images].map((image) => bestImageSource(image, pageUrl) || "");
  const formulas = [...root.querySelectorAll("[data-tex]")].map((element) => element.getAttribute("data-tex"));
  return {
    ok: true,
    sectionId: pageInfo.sectionId,
    fingerprint: [
      pageInfo.sectionId,
      textLength,
      root.querySelectorAll("p").length,
      images.length,
      fingerprintText(JSON.stringify([text, imageSources, formulas]))
    ].join(":")
  };
}

function fingerprintText(text) {
  let first = 2166136261;
  let second = 5381;
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    first = Math.imul(first ^ code, 16777619);
    second = Math.imul(second, 33) ^ code;
  }
  return `${first >>> 0}-${second >>> 0}`;
}

export function extractArticleDocument(document, pageUrl, toMarkdown) {
  const pageInfo = inferPaidColumnInfo(document, pageUrl);
  if (!pageInfo?.sectionId) {
    return { ok: false, reason: "当前页面不是付费专栏章节页" };
  }

  const discovered = extractColumnLinks(document, pageUrl, pageInfo.columnId);
  const root = selectContentRoot(document);
  const bodyText = cleanText(document.body?.textContent);
  if (!root) {
    return { ok: false, accessDenied: ACCESS_LOCK_PATTERN.test(bodyText), reason: "没有找到章节正文", discovered };
  }

  const textLength = cleanText(root.textContent).length;
  const explicitLockControl = hasLockControl(document);
  if (ACCESS_LOCK_PATTERN.test(bodyText) && (explicitLockControl || textLength < 2000)) {
    return { ok: false, accessDenied: true, reason: "当前浏览器会话没有显示完整正文", discovered };
  }

  const { root: cleanRoot, images } = sanitizeArticleRoot(root, pageUrl);
  const title = detectPageTitle(document, `章节 ${pageInfo.sectionId}`);
  const html = cleanRoot.innerHTML.trim();
  const markdown = toMarkdown(cleanRoot).trim();
  if (markdown.length < 80) {
    return { ok: false, accessDenied: ACCESS_LOCK_PATTERN.test(bodyText), reason: "提取到的正文过短", discovered };
  }

  return {
    ok: true,
    columnId: pageInfo.columnId,
    sectionId: pageInfo.sectionId,
    title,
    url: pageInfo.columnId
      ? canonicalSectionUrl(pageInfo.columnId, pageInfo.sectionId)
      : new URL(pageUrl).href,
    html,
    markdown,
    images,
    discovered
  };
}
