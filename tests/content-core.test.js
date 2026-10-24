// 专栏与文章 ID 均为合成测试值，不对应用户的阅读记录。
import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import {
  detectPageTitle,
  extractArticleDocument,
  extractColumnLinks,
  inferPaidColumnInfo,
  probeArticleDocument,
  selectContentRoot
} from "../src/content-core.js";

const pageUrl = "https://www.zhihu.com/market/paid_column/100/section/201";

test("从链接、页面数据和当前章节发现目录", () => {
  const dom = new JSDOM(`<!doctype html><html><head><title>测试专栏 - 知乎</title></head><body>
    <a href="/market/paid_column/100/section/200"><h3>第一章</h3></a>
    <div class="ChapterItem-root" data-za-extra-module='{"card":{"content":{"id":"201"}}}'><div>第二章</div></div>
    <script>window.data={"url":"/market/paid_column/100/section/202"}</script>
  </body></html>`, { url: pageUrl });

  const links = extractColumnLinks(dom.window.document, pageUrl, "100");
  assert.deepEqual(links.map((item) => item.sectionId), ["200", "201", "202"]);
  assert.equal(links[0].title, "第一章");
  assert.equal(links[1].title, "第二章");
});

test("从未知知乎路由的 canonical 链接推断专栏与章节", () => {
  const unknownUrl = "https://www.zhihu.com/xen/market/ecom-page/reader-entry";
  const dom = new JSDOM(`<!doctype html><html><head>
    <link rel="canonical" href="/market/paid_column/100/section/201">
  </head><body></body></html>`, { url: unknownUrl });
  assert.deepEqual(inferPaidColumnInfo(dom.window.document, unknownUrl), {
    columnId: "100",
    sectionId: "201",
    kind: "section"
  });
});

test("从未知知乎路由的页面数据推断专栏", () => {
  const unknownUrl = "https://www.zhihu.com/xen/market/ecom-page/reader-entry";
  const dom = new JSDOM(`<!doctype html><html><body>
    <script>window.pageData={"columnId":"700","sectionId":"701"}</script>
  </body></html>`, { url: unknownUrl });
  assert.deepEqual(inferPaidColumnInfo(dom.window.document, unknownUrl), {
    columnId: "700",
    sectionId: "701",
    kind: "section"
  });
});

test("从 column 目录收集全部 zhuanlan 文章链接", () => {
  const columnUrl = "https://www.zhihu.com/column/c_9000000000000000001";
  const dom = new JSDOM(`<!doctype html><html><head><title>目标专栏 - 知乎</title></head><body>
    <a href="https://zhuanlan.zhihu.com/p/800"><h2>文章一</h2></a>
    <a href="/p/801"><h2>文章二</h2></a>
    <a href="/question/123">无关问题</a>
  </body></html>`, { url: columnUrl });
  const links = extractColumnLinks(dom.window.document, columnUrl);
  assert.deepEqual(links, [
    { sectionId: "800", url: "https://zhuanlan.zhihu.com/p/800", title: "文章一" },
    { sectionId: "801", url: "https://zhuanlan.zhihu.com/p/801", title: "文章二" }
  ]);
});

test("标准专栏文章页推断所属专栏且忽略推荐文章", () => {
  const articleUrl = "https://zhuanlan.zhihu.com/p/800";
  const dom = new JSDOM(`<!doctype html><html><head><title>文章一 - 知乎</title></head><body>
    <a href="https://www.zhihu.com/column/c_9000000000000000001">目标专栏</a>
    <a href="https://zhuanlan.zhihu.com/p/999">推荐文章</a>
  </body></html>`, { url: articleUrl });
  assert.deepEqual(inferPaidColumnInfo(dom.window.document, articleUrl), {
    columnId: "c_9000000000000000001",
    sectionId: "800",
    kind: "section"
  });
  assert.deepEqual(extractColumnLinks(dom.window.document, articleUrl), [
    { sectionId: "800", url: "https://zhuanlan.zhihu.com/p/800", title: "文章一" }
  ]);
});

test("正文候选优先选择 RichText 而非整页 main", () => {
  const dom = new JSDOM(`<!doctype html><body><main>导航内容<div class="RichText">${"正文段落".repeat(50)}</div></main></body>`);
  assert.equal(selectContentRoot(dom.window.document).className, "RichText");
});

test("清理正文、替换图片并保留目录发现结果", () => {
  const body = "这是用于验证正文提取的内容。".repeat(45);
  const dom = new JSDOM(`<!doctype html><html><head><title>第二章 - 知乎</title></head><body>
    <a href="/market/paid_column/100/section/200">第一章</a>
    <article class="RichText"><p>${body}</p><span class="ztext-math" data-tex="x^2+y^2">渲染公式</span>
      <img data-original="https://pic1.zhimg.com/a.webp" alt="插图">
      <script>window.secret = true</script><a href="/question/1">相关链接</a></article>
  </body></html>`, { url: pageUrl });

  const result = extractArticleDocument(dom.window.document, pageUrl, (root) => root.textContent);
  assert.equal(result.ok, true);
  assert.equal(result.title, "第二章");
  assert.equal(result.images.length, 1);
  assert.match(result.html, /__ZHIHU_EXPORT_IMAGE_0__/);
  assert.doesNotMatch(result.html, /<script/);
  assert.match(result.html, /https:\/\/www\.zhihu\.com\/question\/1/);
  assert.match(result.html, /\$x\^2\+y\^2\$/);
  assert.deepEqual(result.discovered.map((item) => item.sectionId), ["200", "201"]);
});

test("识别未显示完整正文的权限状态", () => {
  const dom = new JSDOM(`<!doctype html><html><head><title>受限章节 - 知乎</title></head><body>
    <main><p>试看内容很短。</p><button>订阅后解锁阅读</button></main>
  </body></html>`, { url: pageUrl });
  const result = extractArticleDocument(dom.window.document, pageUrl, (root) => root.textContent);
  assert.equal(result.ok, false);
  assert.equal(result.accessDenied, true);
});

test("超过旧阈值的试看摘要只要仍显示订阅控件就不能当全文", () => {
  const preview = "这是超过四百字但仍然只是试看摘要的内容。".repeat(35);
  const dom = new JSDOM(`<!doctype html><html><head><title>受限章节 - 知乎</title></head><body>
    <article class="RichText"><p>${preview}</p></article><button>立即订阅</button>
  </body></html>`, { url: pageUrl });
  const result = extractArticleDocument(dom.window.document, pageUrl, (root) => root.textContent);
  assert.equal(result.ok, false);
  assert.equal(result.accessDenied, true);
});

test("提取干净的页面标题", () => {
  const dom = new JSDOM("<!doctype html><html><head><title>专栏名称 - 知乎</title></head><body></body></html>");
  assert.equal(detectPageTitle(dom.window.document), "专栏名称");
});

test("离线正文去除可执行链接并保留安全链接和可见文字", () => {
  const unsafe = ["javascript:alert(1)", "  JaVaScRiPt:alert(1)", "java\nscript:alert(1)", "data:text/html,unsafe", "file:///example.txt"];
  const dom = new JSDOM(`<!doctype html><html><head><title>测试文章</title></head><body><article class="RichText">
    <p>${"合成测试正文。".repeat(100)}</p>
    ${unsafe.map((href) => `<a href="${href}">危险链接文字</a>`).join("")}
    <a href="/question/1">网页</a><a href="mailto:writer@example.org">邮件</a><a href="#part">页内</a>
    <iframe src="javascript:alert(1)"></iframe>
  </article></body></html>`, { url: pageUrl });
  const result = extractArticleDocument(dom.window.document, pageUrl, (root) => root.textContent);
  const document = new JSDOM(result.html).window.document;
  const links = [...document.querySelectorAll("a")];
  for (const anchor of links.filter((item) => /危险|媒体/.test(item.textContent))) assert.equal(anchor.hasAttribute("href"), false);
  assert.equal(links.find((item) => item.textContent === "网页").getAttribute("href"), "https://www.zhihu.com/question/1");
  assert.equal(links.find((item) => item.textContent === "邮件").getAttribute("href"), "mailto:writer@example.org");
  assert.equal(links.find((item) => item.textContent === "页内").getAttribute("href"), "#part");
});

test("廉价探针随正文增长改变指纹，稳定后不再变化", () => {
  const dom = new JSDOM(`<!doctype html><html><head><title>章节 - 知乎</title></head><body>
    <article class="RichText"><p>${"正文内容。".repeat(200)}</p></article>
  </body></html>`, { url: pageUrl });
  const document = dom.window.document;

  const first = probeArticleDocument(document, pageUrl);
  assert.equal(first.ok, true);
  assert.equal(first.sectionId, "201");
  assert.equal(probeArticleDocument(document, pageUrl).fingerprint, first.fingerprint);

  const grown = document.createElement("p");
  grown.textContent = "后续加载出来的正文。".repeat(50);
  document.querySelector("article").append(grown);
  assert.notEqual(probeArticleDocument(document, pageUrl).fingerprint, first.fingerprint);
});

test("廉价探针在懒加载图片地址落定前保持变化", () => {
  const dom = new JSDOM(`<!doctype html><html><head><title>章节 - 知乎</title></head><body>
    <article class="RichText"><p>${"正文内容。".repeat(200)}</p><img src="data:image/gif;base64,R0lGOD"></article>
  </body></html>`, { url: pageUrl });
  const document = dom.window.document;
  const before = probeArticleDocument(document, pageUrl).fingerprint;
  document.querySelector("img").setAttribute("data-original", "https://pic1.zhimg.com/v2-abcdef.jpg");
  assert.notEqual(probeArticleDocument(document, pageUrl).fingerprint, before);
});

test("廉价探针把权限占位视为未就绪，与完整提取判定一致", () => {
  const preview = "这是超过四百字但仍然只是试看摘要的内容。".repeat(35);
  const dom = new JSDOM(`<!doctype html><html><head><title>受限章节 - 知乎</title></head><body>
    <article class="RichText"><p>${preview}</p></article><button>立即订阅</button>
  </body></html>`, { url: pageUrl });
  const document = dom.window.document;
  assert.equal(probeArticleDocument(document, pageUrl).ok, false);
  assert.equal(extractArticleDocument(document, pageUrl, (root) => root.textContent).accessDenied, true);
});
