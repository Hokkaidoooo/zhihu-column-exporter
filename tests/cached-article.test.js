// 专栏与文章 ID 均为合成测试值，不对应用户的阅读记录。
import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { extractColumnArticleItem } from "../src/cached-article.js";

test("登录态文章详情复用现有清洗链路并保留精确文章身份", () => {
  const dom = new JSDOM("<!doctype html><html><body></body></html>");
  const body = "这是批量 API 返回的完整正文。".repeat(35);
  const result = extractColumnArticleItem({
    id: 1000000000000000100,
    url: "https://zhuanlan.zhihu.com/p/1000000000000000123",
    title: "批量正文",
    content_need_truncated: true,
    content: `<p>${body}</p><span data-tex="x^2">公式</span><img data-original="https://pic1.zhimg.com/a.webp"><script>bad()</script>`,
    paid_info: {
      content: "<p>不得采用</p>"
    }
  }, "c_9000000000000000001", dom.window.document, (root) => root.textContent);

  assert.equal(result.ok, true);
  assert.equal(result.sectionId, "1000000000000000123");
  assert.equal(result.columnId, "c_9000000000000000001");
  assert.equal(result.url, "https://zhuanlan.zhihu.com/p/1000000000000000123");
  assert.equal(result.title, "批量正文");
  assert.equal(result.requiresAccessValidation, true);
  assert.equal(result.images.length, 1);
  assert.match(result.html, /__ZHIHU_EXPORT_IMAGE_0__/);
  assert.match(result.html, /\$x\^2\$/);
  assert.doesNotMatch(result.html, /<script/);
});
