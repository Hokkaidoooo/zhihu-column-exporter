import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import {
  articleApiMatchesPage,
  compareArticleApiWithPage,
  formatArticleMatchDiagnostics
} from "../src/cache-validation.js";

function htmlToText(html) {
  return new JSDOM(`<body>${html}</body>`).window.document.body.textContent;
}

function plainText(value) {
  return String(value);
}

function normalizedForSample(value) {
  return String(value).normalize("NFKC").replace(/[^\p{L}\p{N}\p{Sm}+\-*\/=<>^%|~&]+/gu, "");
}

function article(html) {
  return { ok: true, html };
}

const topics = [
  "进程调度与上下文切换", "虚拟存储和页面置换", "文件系统与索引节点", "设备驱动和中断处理",
  "阻塞调用与非阻塞调用", "网络协议和拥塞控制", "同步互斥与信号量", "磁盘调度和缓存策略"
];
const paragraphs = Array.from({ length: 72 }, (_, index) => {
  const number = index + 1;
  const topic = topics[index % topics.length];
  return `第${number}段讨论${topic}。先确认请求编号${1000 + number}的初始条件，再沿调用链检查状态转换，最后用边界样例${number * 7}验证结论。这个过程需要区分事实、假设和异常分支，避免把局部现象误认为完整结果。`;
});
const body = paragraphs.join("");

test("接口正文与正常文章页完全一致或仅有空白差异时通过", () => {
  const exact = compareArticleApiWithPage(article(`<p>${body}</p>`), article(`<p>${body}</p>`), htmlToText);
  assert.equal(exact.matches, true);
  assert.equal(exact.kind, "identical");
  assert.equal(exact.lengthRatio, 1);
  assert.equal(exact.apiCoverage, 1);
  assert.equal(exact.pageCoverage, 1);
  assert.equal(exact.missingSample, "");

  assert.equal(articleApiMatchesPage(
    article(`<p>${body}</p>`),
    article(`<p> ${body.split("").join(" \n ")} </p>`),
    htmlToText
  ), true);
});

test("页面插入 5% 到 15% 的动态提示仍通过", () => {
  for (const insertionRatio of [0.05, 0.15]) {
    const insertionLength = Math.floor(body.length * insertionRatio);
    const dynamicNotice = "页面阅读状态已同步，当前账号可以继续查看本节完整内容。".repeat(
      Math.ceil(insertionLength / 25)
    ).slice(0, insertionLength);
    const midpoint = Math.floor(body.length / 2);
    const pageBody = `${body.slice(0, midpoint)}${dynamicNotice}${body.slice(midpoint)}`;
    const result = compareArticleApiWithPage(article(body), article(pageBody), htmlToText);
    assert.equal(result.matches, true, `插入比例 ${insertionRatio} 不应误报`);
    assert.ok(result.apiCoverage > 0.95);
    assert.ok(result.pageCoverage > 0.8);
  }
});

test("全文多处分散的小差异仍通过", () => {
  const characters = [...body];
  for (let index = 49; index < characters.length; index += 50) characters[index] = "甲";
  const substituted = characters.join("");
  const inserted = [];
  for (let offset = 0; offset < body.length; offset += 50) {
    inserted.push(body.slice(offset, offset + 50), "提示文字甲");
  }

  const substitutionResult = compareArticleApiWithPage(article(body), article(substituted), plainText);
  const insertionResult = compareArticleApiWithPage(article(body), article(inserted.join("")), plainText);
  assert.equal(substitutionResult.matches, true);
  assert.equal(insertionResult.matches, true);
  assert.ok(substitutionResult.apiCoverage > 0.75);
  assert.ok(insertionResult.pageOrderCoverage > 0.65);
  assert.ok(insertionResult.endCoverage > 0.81);
});

test("公式渲染文本与标点展示差异仍通过", () => {
  const apiFormula = "设递推式T(n)=2T(n/2)+n，由主定理可知时间复杂度为O(n log n)。".repeat(12);
  const pageFormula = "设递推式 T n 等于 2T n 除以 2 加 n，由主定理可知时间复杂度为 O n log n。".repeat(12);
  const midpoint = Math.floor(paragraphs.length / 2);
  const result = compareArticleApiWithPage(
    article(`<p>${paragraphs.slice(0, midpoint).join("")}</p><div>$$${apiFormula}$$</div><p>${paragraphs.slice(midpoint).join("")}</p>`),
    article(`<p>${paragraphs.slice(0, midpoint).join("").replaceAll("。", "； ")}</p><div>${pageFormula}</div><p>${paragraphs.slice(midpoint).join("").replaceAll("。", "； ")}</p>`),
    htmlToText
  );
  assert.equal(result.matches, true);
  assert.ok(result.apiCoverage >= 0.7);
  assert.ok(result.pageCoverage >= 0.7);
});

test("等价公式的空白与全角展示差异通过", () => {
  const apiFormula = "公式 x + 1 表示递增关系".repeat(100);
  const pageFormula = "公式 ｘ ＋ １ 表示递增关系".repeat(100);
  assert.equal(articleApiMatchesPage(article(apiFormula), article(pageFormula), plainText), true);
});

test("链接卡片和图片说明造成的少量文本差异仍通过", () => {
  const pageExtras = [
    "相关资料：操作系统设备管理补充阅读，打开链接查看原始内容。",
    "图一：字符设备、块设备与网络设备的数据流向示意。",
    "图片加载失败时可在原文章中查看高清版本。"
  ].join("");
  const result = compareArticleApiWithPage(
    article(`<section>${body}</section>`),
    article(`<section>${paragraphs.slice(0, 24).join("")}<aside>${pageExtras}</aside>${paragraphs.slice(24).join("")}</section>`),
    htmlToText
  );
  assert.equal(result.matches, true);
});

test("接口只返回全文前缀摘要时拒绝，并标记为接口试看", () => {
  const fullText = body.slice(0, 3113);
  const result = compareArticleApiWithPage(article(fullText.slice(0, 571)), article(fullText), htmlToText);
  assert.equal(result.matches, false);
  assert.equal(result.reason, "两份正文长度差异过大");
  assert.equal(result.kind, "apiTruncated");
  assert.ok(result.lengthRatio < 0.2);
  assert.ok(result.apiCoverage > 0.95);
  assert.ok(result.pageCoverage < 0.2);
  assert.ok(result.missingSample.length >= 8);
  assert.ok(normalizedForSample(fullText).includes(result.missingSample));
});

test("正常页面只显示接口正文的前缀摘要时拒绝，并标记为页面试看", () => {
  const fullText = body.slice(0, 3113);
  const result = compareArticleApiWithPage(article(fullText), article(fullText.slice(0, 571)), htmlToText);
  assert.equal(result.matches, false);
  assert.equal(result.reason, "两份正文长度差异过大");
  assert.equal(result.kind, "pageTruncated");
  assert.ok(result.apiCoverage < 0.2);
  assert.ok(result.pageCoverage > 0.95);
  assert.ok(result.missingSample.length >= 8);
});

test("81% 到 95% 的较长正文前缀仍不能冒充全文", () => {
  for (const ratio of [0.81, 0.85, 0.9, 0.95]) {
    const prefix = body.slice(0, Math.floor(body.length * ratio));
    const result = compareArticleApiWithPage(article(prefix), article(body), plainText);
    assert.equal(result.matches, false, `${ratio * 100}% 前缀不应通过`);
    assert.match(result.reason, /长度差异过大|只是另一份正文的前缀|开头或结尾不一致/);
    assert.ok(result.endCoverage < 0.81);
  }
});

test("重复正文中的较长前缀也不能冒充全文", () => {
  const repeatedFullText = "进程进入阻塞状态后由设备中断唤醒并重新参与调度".repeat(180);
  for (const ratio of [0.75, 0.81, 0.85, 0.9, 0.95]) {
    const repeatedSummary = repeatedFullText.slice(0, Math.floor(repeatedFullText.length * ratio));
    const result = compareArticleApiWithPage(article(repeatedSummary), article(repeatedFullText), htmlToText);
    assert.equal(result.matches, false, `高重复正文的 ${ratio * 100}% 前缀不应通过`);
    assert.ok(result.apiCoverage > 0.99);
    assert.ok(result.pageCoverage < 0.96);
  }
});

test("正文段落倒序和同长前缀填充均拒绝", () => {
  const reversed = [...paragraphs].reverse().join("");
  const prefix = body.slice(0, Math.floor(body.length * 0.75));
  const paddedPrefix = prefix.repeat(2).slice(0, body.length);
  const reversedResult = compareArticleApiWithPage(article(body), article(reversed), plainText);
  const paddedResult = compareArticleApiWithPage(article(body), article(paddedPrefix), plainText);
  assert.equal(reversedResult.matches, false);
  assert.equal(reversedResult.reason, "两份正文的内容顺序不一致");
  assert.ok(reversedResult.apiOrderCoverage < 0.65);
  assert.equal(paddedResult.matches, false);
  assert.ok(paddedResult.endCoverage < 0.81);
});

test("带编号的高重复段落倒序仍被低频顺序锚点拒绝", () => {
  const repeatedParagraphs = Array.from({ length: 80 }, (_, index) => (
    `第${index + 1}段固定说明设备接口进入等待状态后由中断处理程序唤醒，请求编号${90000 + index}，随后恢复同一套调度检查流程。`
  ));
  const original = repeatedParagraphs.join("");
  const reversed = [...repeatedParagraphs].reverse().join("");
  const result = compareArticleApiWithPage(article(original), article(reversed), plainText);
  assert.equal(result.matches, false);
  assert.equal(result.reason, "两份正文的内容顺序不一致");
  assert.ok(result.apiOrderCoverage < 0.65);
  assert.ok(result.pageOrderCoverage < 0.65);
});

test("数学运算符的实质差异不能被规范化掉", () => {
  const plus = "公式x+1表示递增关系".repeat(100);
  const minus = "公式x-1表示递增关系".repeat(100);
  const result = compareArticleApiWithPage(article(plus), article(minus), plainText);
  assert.equal(result.matches, false);
  assert.equal(result.reason, "两份正文的双向内容覆盖不足");
});

test("长度接近但内容无关的正文不能通过", () => {
  const unrelatedSeed = "天地玄黄宇宙洪荒日月盈昃辰宿列张寒来暑往秋收冬藏闰余成岁律吕调阳";
  const unrelated = unrelatedSeed.repeat(Math.ceil(body.length / unrelatedSeed.length)).slice(0, body.length);
  const result = compareArticleApiWithPage(article(body), article(unrelated), htmlToText);
  assert.equal(result.matches, false);
  assert.equal(result.reason, "两份正文的双向内容覆盖不足");
  assert.equal(result.kind, "different");
  assert.ok(result.apiCoverage < 0.1);
  assert.ok(result.pageCoverage < 0.1);
});

test("两边正文均须达到最低长度", () => {
  const result = compareArticleApiWithPage(article("短".repeat(399)), article(body), htmlToText);
  assert.equal(result.matches, false);
  assert.match(result.reason, /正文过短/);
  assert.equal(result.kind, "tooShort");
  assert.equal(result.apiLength, 399);
  assert.equal(result.apiCoverage, 0);
});

test("接口或页面未提取到正文时标记为不可用", () => {
  const result = compareArticleApiWithPage({ ok: false }, article(body), htmlToText);
  assert.equal(result.matches, false);
  assert.equal(result.kind, "unavailable");
  assert.equal(result.apiLength, 0);
  assert.equal(result.pageLength, 0);
});

test("失败诊断包含稳定的长度和双向覆盖指标", () => {
  const result = compareArticleApiWithPage(article(body), article("完全无关的页面正文内容".repeat(260)), htmlToText);
  const diagnostics = formatArticleMatchDiagnostics(result);
  assert.deepEqual(Object.keys(result), [
    "matches", "reason", "kind", "apiLength", "pageLength", "lengthRatio", "apiCoverage", "pageCoverage",
    "apiOrderCoverage", "pageOrderCoverage", "startCoverage", "endCoverage", "missingSample"
  ]);
  assert.match(
    diagnostics,
    /^接口 \d+ 字，页面 \d+ 字，长度比 \d+\.\d{2}%，内容覆盖 \d+\.\d{2}%\/\d+\.\d{2}%，顺序覆盖 \d+\.\d{2}%\/\d+\.\d{2}%，首尾覆盖 \d+\.\d{2}%\/\d+\.\d{2}%$/
  );
});
