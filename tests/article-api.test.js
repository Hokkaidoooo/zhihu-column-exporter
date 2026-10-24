// 专栏与文章 ID 均为合成测试值，不对应用户的阅读记录。
import test from "node:test";
import assert from "node:assert/strict";
import { normalizeColumnArticleItem, sectionIdFromArticleItem } from "../src/article-api.js";

test("优先从文章 URL 保留超出安全整数范围的精确 ID", () => {
  const item = {
    id: 1000000000000000100,
    url: "https://zhuanlan.zhihu.com/p/1000000000000000123",
    title: "文章",
    content: "<p>正文</p>"
  };
  assert.equal(sectionIdFromArticleItem(item), "1000000000000000123");
});

test("没有精确 URL 时拒绝已失真的大整数 ID", () => {
  assert.equal(sectionIdFromArticleItem({ id: 1000000000000000100 }), null);
  assert.equal(sectionIdFromArticleItem({ id: "1000000000000000123" }), "1000000000000000123");
});

test("目录标准正文保留截断提示但不把它当授权状态", () => {
  const result = normalizeColumnArticleItem({
    url: "https://zhuanlan.zhihu.com/p/1000000000000000123",
    title: "文章",
    content: "<p>标准正文</p>",
    content_need_truncated: true
  }, "c_9000000000000000001");
  assert.equal(result.ok, true);
  assert.equal(result.content, "<p>标准正文</p>");
  assert.equal(result.requiresAccessValidation, true);
});

test("始终忽略 paid_info.content 并生成精确规范链接", () => {
  const result = normalizeColumnArticleItem({
    url: "https://zhuanlan.zhihu.com/p/1000000000000000123",
    title: "  完整文章  ",
    content: "<p>标准正文</p>",
    content_need_truncated: true,
    paid_info: { content: "<p>不得采用的付费字段</p>" }
  }, "c_9000000000000000001");
  assert.equal(result.ok, true);
  assert.equal(result.sectionId, "1000000000000000123");
  assert.equal(result.url, "https://zhuanlan.zhihu.com/p/1000000000000000123");
  assert.equal(result.title, "完整文章");
  assert.equal(result.content, "<p>标准正文</p>");
});

test("即使 paid_info.content 非空也拒绝缺少标准正文的记录", () => {
  const result = normalizeColumnArticleItem({
    url: "https://zhuanlan.zhihu.com/p/1000000000000000123",
    paid_info: { content: "<p>不得采用的付费字段</p>" }
  }, "c_9000000000000000001");
  assert.equal(result.ok, false);
  assert.match(result.reason, /标准正文/);
});

test("非截断标志同样只作为内容元数据", () => {
  const result = normalizeColumnArticleItem({
    url: "https://zhuanlan.zhihu.com/p/1000000000000000123",
    content: "<p>正文</p>",
    content_need_truncated: false
  }, "c_9000000000000000001");
  assert.equal(result.ok, true);
  assert.equal(result.requiresAccessValidation, false);
});
