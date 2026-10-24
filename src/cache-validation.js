const MIN_TEXT_LENGTH = 400;
const MIN_LENGTH_RATIO = 0.8;
const MIN_CONTENT_COVERAGE = 0.7;
const MIN_ORDER_COVERAGE = 0.65;
const MIN_BOUNDARY_COVERAGE = 0.81;
const CONTENT_NGRAM_SIZE = 8;
const BOUNDARY_NGRAM_SIZE = 5;
const ANCHOR_STEP = 24;
const ANCHOR_POSITION_TOLERANCE = 0.08;
const MAX_ANCHOR_CANDIDATES = 32;
const RARE_ANCHOR_STEP = 12;
const MAX_RARE_SOURCE_OCCURRENCES = 2;
const MAX_RARE_TARGET_OCCURRENCES = 4;
const MIN_RARE_ANCHORS = 8;
const MIN_STRICT_PREFIX_TAIL = 64;
const CONTAINMENT_COVERAGE = 0.9;
const MISSING_SAMPLE_LENGTH = 60;

function browserHtmlToText(html) {
  if (typeof DOMParser !== "function") throw new Error("当前环境无法解析正文 HTML");
  const parsed = new DOMParser().parseFromString(`<body>${String(html || "")}</body>`, "text/html");
  return parsed.body?.textContent || "";
}

function comparableText(value) {
  return String(value || "")
    .normalize("NFKC")
    .replace(/\u2212/g, "-")
    .replace(/[^\p{L}\p{N}\p{Sm}+\-*\/=<>^%|~&]+/gu, "");
}

function countNgrams(text, gramSize) {
  const counts = new Map();
  for (let offset = 0; offset <= text.length - gramSize; offset += 1) {
    const gram = text.slice(offset, offset + gramSize);
    counts.set(gram, (counts.get(gram) || 0) + 1);
  }
  return counts;
}

function bidirectionalNgramCoverage(left, right, gramSize) {
  if (!left.length || !right.length) return { left: 0, right: 0 };
  if (left === right) return { left: 1, right: 1 };
  if (left.length < gramSize || right.length < gramSize) return { left: 0, right: 0 };

  const countedText = left.length <= right.length ? left : right;
  const scannedText = countedText === left ? right : left;
  const availableCounts = countNgrams(countedText, gramSize);
  let sharedGrams = 0;
  for (let offset = 0; offset <= scannedText.length - gramSize; offset += 1) {
    const gram = scannedText.slice(offset, offset + gramSize);
    const available = availableCounts.get(gram) || 0;
    if (!available) continue;
    sharedGrams += 1;
    if (available === 1) availableCounts.delete(gram);
    else availableCounts.set(gram, available - 1);
  }
  return {
    left: sharedGrams / (left.length - gramSize + 1),
    right: sharedGrams / (right.length - gramSize + 1)
  };
}

function lowerBound(values, target) {
  let low = 0;
  let high = values.length;
  while (low < high) {
    const middle = (low + high) >> 1;
    if (values[middle] < target) low = middle + 1;
    else high = middle;
  }
  return low;
}

function sampledAnchors(text, gramSize, step) {
  const anchors = [];
  const finalOffset = text.length - gramSize;
  for (let offset = 0; offset <= finalOffset; offset += step) {
    anchors.push({ gram: text.slice(offset, offset + gramSize), offset });
  }
  if (anchors.at(-1)?.offset !== finalOffset) {
    anchors.push({ gram: text.slice(finalOffset), offset: finalOffset });
  }
  return anchors;
}

function orderedAnchorCoverage(source, target, gramSize = CONTENT_NGRAM_SIZE, step = ANCHOR_STEP) {
  const anchors = sampledAnchors(source, gramSize, step);
  if (!anchors.length) return 0;

  const requiredGrams = new Set(anchors.map((anchor) => anchor.gram));
  const positionsByGram = new Map();
  for (let offset = 0; offset <= target.length - gramSize; offset += 1) {
    const gram = target.slice(offset, offset + gramSize);
    if (!requiredGrams.has(gram)) continue;
    const positions = positionsByGram.get(gram) || [];
    positions.push(offset);
    positionsByGram.set(gram, positions);
  }

  const sourceSpan = Math.max(1, source.length - gramSize);
  const targetSpan = Math.max(1, target.length - gramSize);
  const radius = Math.max(96, Math.floor(target.length * ANCHOR_POSITION_TOLERANCE));
  const increasingTails = [];
  for (const anchor of anchors) {
    const expectedPosition = (anchor.offset / sourceSpan) * targetSpan;
    const positions = positionsByGram.get(anchor.gram) || [];
    const rangeStart = lowerBound(positions, expectedPosition - radius);
    const rangeEnd = lowerBound(positions, expectedPosition + radius + 1);
    if (rangeStart === rangeEnd) continue;

    const nearest = lowerBound(positions, expectedPosition);
    let candidateStart = Math.max(rangeStart, nearest - Math.floor(MAX_ANCHOR_CANDIDATES / 2));
    let candidateEnd = Math.min(rangeEnd, candidateStart + MAX_ANCHOR_CANDIDATES);
    candidateStart = Math.max(rangeStart, candidateEnd - MAX_ANCHOR_CANDIDATES);
    for (let index = candidateEnd - 1; index >= candidateStart; index -= 1) {
      const position = positions[index];
      const tailIndex = lowerBound(increasingTails, position);
      increasingTails[tailIndex] = position;
    }
  }
  return increasingTails.length / anchors.length;
}

function rareOrderedAnchorCoverage(source, target, gramSize = CONTENT_NGRAM_SIZE) {
  const sourceCounts = countNgrams(source, gramSize);
  const anchors = [];
  let lastOffset = -RARE_ANCHOR_STEP;
  for (let offset = 0; offset <= source.length - gramSize; offset += 1) {
    if (offset - lastOffset < RARE_ANCHOR_STEP) continue;
    const gram = source.slice(offset, offset + gramSize);
    if ((sourceCounts.get(gram) || 0) > MAX_RARE_SOURCE_OCCURRENCES) continue;
    anchors.push(gram);
    lastOffset = offset;
  }
  sourceCounts.clear();
  if (anchors.length < MIN_RARE_ANCHORS) return null;

  const requiredGrams = new Set(anchors);
  const positionsByGram = new Map();
  for (let offset = 0; offset <= target.length - gramSize; offset += 1) {
    const gram = target.slice(offset, offset + gramSize);
    if (!requiredGrams.has(gram)) continue;
    const positions = positionsByGram.get(gram) || [];
    if (positions.length <= MAX_RARE_TARGET_OCCURRENCES) positions.push(offset);
    positionsByGram.set(gram, positions);
  }

  const increasingTails = [];
  for (const gram of anchors) {
    const positions = positionsByGram.get(gram) || [];
    if (positions.length > MAX_RARE_TARGET_OCCURRENCES) continue;
    for (let index = positions.length - 1; index >= 0; index -= 1) {
      const position = positions[index];
      const tailIndex = lowerBound(increasingTails, position);
      increasingTails[tailIndex] = position;
    }
  }
  return increasingTails.length / anchors.length;
}

function combinedOrderCoverage(source, target) {
  const positionalCoverage = orderedAnchorCoverage(source, target);
  const rareCoverage = rareOrderedAnchorCoverage(source, target);
  return rareCoverage === null ? positionalCoverage : Math.min(positionalCoverage, rareCoverage);
}

function boundaryCoverage(left, right) {
  const minimumLength = Math.min(left.length, right.length);
  const windowSize = Math.min(512, Math.max(160, Math.floor(minimumLength * 0.1)));
  const head = bidirectionalNgramCoverage(
    left.slice(0, windowSize),
    right.slice(0, windowSize),
    BOUNDARY_NGRAM_SIZE
  );
  const tail = bidirectionalNgramCoverage(
    left.slice(-windowSize),
    right.slice(-windowSize),
    BOUNDARY_NGRAM_SIZE
  );
  return {
    start: Math.min(head.left, head.right),
    end: Math.min(tail.left, tail.right)
  };
}

function firstUncoveredOffset(source, reference, gramSize) {
  if (source.length < gramSize || reference.length < gramSize) return 0;
  const referenceGrams = new Set();
  for (let offset = 0; offset <= reference.length - gramSize; offset += 1) {
    referenceGrams.add(reference.slice(offset, offset + gramSize));
  }
  for (let offset = 0; offset <= source.length - gramSize; offset += 1) {
    if (!referenceGrams.has(source.slice(offset, offset + gramSize))) return offset;
  }
  return -1;
}

function missingContentSample(longer, shorter) {
  const offset = firstUncoveredOffset(longer, shorter, CONTENT_NGRAM_SIZE);
  if (offset < 0) return "";
  return longer.slice(offset, offset + MISSING_SAMPLE_LENGTH);
}

function classifyMismatch({ apiLength, pageLength, apiCoverage, pageCoverage }) {
  if (apiLength < pageLength && apiCoverage >= CONTAINMENT_COVERAGE) return "apiTruncated";
  if (pageLength < apiLength && pageCoverage >= CONTAINMENT_COVERAGE) return "pageTruncated";
  return "different";
}

function roundedRatio(value) {
  return Math.round(value * 10000) / 10000;
}

function resultWithMetrics(matches, reason, metrics = {}) {
  return {
    matches,
    reason,
    kind: String(metrics.kind || (matches ? "acceptable" : "different")),
    apiLength: Number(metrics.apiLength || 0),
    pageLength: Number(metrics.pageLength || 0),
    lengthRatio: roundedRatio(metrics.lengthRatio || 0),
    apiCoverage: roundedRatio(metrics.apiCoverage || 0),
    pageCoverage: roundedRatio(metrics.pageCoverage || 0),
    apiOrderCoverage: roundedRatio(metrics.apiOrderCoverage || 0),
    pageOrderCoverage: roundedRatio(metrics.pageOrderCoverage || 0),
    startCoverage: roundedRatio(metrics.startCoverage || 0),
    endCoverage: roundedRatio(metrics.endCoverage || 0),
    missingSample: String(metrics.missingSample || "")
  };
}

export function compareArticleApiWithPage(apiArticle, pageArticle, htmlToText = browserHtmlToText) {
  if (!apiArticle?.ok || !pageArticle?.ok) {
    return resultWithMetrics(false, "接口或正常文章页未成功提取正文", { kind: "unavailable" });
  }

  const apiText = comparableText(htmlToText(apiArticle.html));
  const pageText = comparableText(htmlToText(pageArticle.html));
  const apiLength = apiText.length;
  const pageLength = pageText.length;
  const longerLength = Math.max(apiLength, pageLength);
  const lengthRatio = longerLength ? Math.min(apiLength, pageLength) / longerLength : 0;
  const baseMetrics = { apiLength, pageLength, lengthRatio };

  if (apiLength < MIN_TEXT_LENGTH || pageLength < MIN_TEXT_LENGTH) {
    return resultWithMetrics(false, `正文过短，规范化后至少需要 ${MIN_TEXT_LENGTH} 字`, {
      ...baseMetrics,
      kind: "tooShort"
    });
  }
  if (apiText === pageText) {
    return resultWithMetrics(true, "正文完全一致", {
      ...baseMetrics,
      kind: "identical",
      apiCoverage: 1,
      pageCoverage: 1,
      apiOrderCoverage: 1,
      pageOrderCoverage: 1,
      startCoverage: 1,
      endCoverage: 1
    });
  }

  const contentCoverage = bidirectionalNgramCoverage(apiText, pageText, CONTENT_NGRAM_SIZE);
  const boundary = boundaryCoverage(apiText, pageText);
  const strictPrefixTail = apiText.startsWith(pageText) || pageText.startsWith(apiText)
    ? Math.abs(apiLength - pageLength)
    : 0;
  const metrics = {
    ...baseMetrics,
    kind: classifyMismatch({
      apiLength,
      pageLength,
      apiCoverage: contentCoverage.left,
      pageCoverage: contentCoverage.right
    }),
    apiCoverage: contentCoverage.left,
    pageCoverage: contentCoverage.right,
    apiOrderCoverage: combinedOrderCoverage(apiText, pageText),
    pageOrderCoverage: combinedOrderCoverage(pageText, apiText),
    startCoverage: boundary.start,
    endCoverage: boundary.end,
    missingSample: apiLength >= pageLength
      ? missingContentSample(apiText, pageText)
      : missingContentSample(pageText, apiText)
  };

  if (lengthRatio < MIN_LENGTH_RATIO) {
    return resultWithMetrics(false, "两份正文长度差异过大", metrics);
  }
  if (strictPrefixTail >= MIN_STRICT_PREFIX_TAIL) {
    return resultWithMetrics(false, "一份正文只是另一份正文的前缀", metrics);
  }
  if (contentCoverage.left < MIN_CONTENT_COVERAGE || contentCoverage.right < MIN_CONTENT_COVERAGE) {
    return resultWithMetrics(false, "两份正文的双向内容覆盖不足", metrics);
  }
  if (metrics.apiOrderCoverage < MIN_ORDER_COVERAGE || metrics.pageOrderCoverage < MIN_ORDER_COVERAGE) {
    return resultWithMetrics(false, "两份正文的内容顺序不一致", metrics);
  }
  if (boundary.start < MIN_BOUNDARY_COVERAGE || boundary.end < MIN_BOUNDARY_COVERAGE) {
    return resultWithMetrics(false, "两份正文的开头或结尾不一致", metrics);
  }
  return resultWithMetrics(true, "正文内容一致，仅存在可接受的展示差异", { ...metrics, kind: "acceptable" });
}

export function formatArticleMatchDiagnostics(result) {
  const percentage = (value) => `${(Number(value || 0) * 100).toFixed(2)}%`;
  return [
    `接口 ${Number(result?.apiLength || 0)} 字`,
    `页面 ${Number(result?.pageLength || 0)} 字`,
    `长度比 ${percentage(result?.lengthRatio)}`,
    `内容覆盖 ${percentage(result?.apiCoverage)}/${percentage(result?.pageCoverage)}`,
    `顺序覆盖 ${percentage(result?.apiOrderCoverage)}/${percentage(result?.pageOrderCoverage)}`,
    `首尾覆盖 ${percentage(result?.startCoverage)}/${percentage(result?.endCoverage)}`
  ].join("，");
}

export function articleApiMatchesPage(apiArticle, pageArticle, htmlToText = browserHtmlToText) {
  return compareArticleApiWithPage(apiArticle, pageArticle, htmlToText).matches;
}
