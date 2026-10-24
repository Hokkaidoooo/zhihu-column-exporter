// 专栏与文章 ID 均为合成测试值，不对应用户的阅读记录。
import test from "node:test";
import assert from "node:assert/strict";
import {
  assertExpectedArticleResult,
  expectedPageFromUrl,
  pageMatchesExpectation
} from "../src/page-identity.js";

test("文章身份允许同 ID 的知乎主域与专栏域切换", () => {
  const expected = expectedPageFromUrl("https://zhuanlan.zhihu.com/p/1000000000000001288");
  assert.equal(pageMatchesExpectation("https://www.zhihu.com/p/1000000000000001288", expected), true);
  assert.equal(pageMatchesExpectation("https://zhuanlan.zhihu.com/p/1000000000000000100", expected), false);
});

test("专栏目录身份只接受原专栏 ID", () => {
  const expected = expectedPageFromUrl("https://www.zhihu.com/column/c_9000000000000000001");
  assert.equal(pageMatchesExpectation("https://www.zhihu.com/column/c_9000000000000000001/", expected), true);
  assert.equal(pageMatchesExpectation("https://www.zhihu.com/column/c_123", expected), false);
});

test("旧式章节地址同时校验专栏 ID 与章节 ID", () => {
  const expected = expectedPageFromUrl("https://www.zhihu.com/market/paid_column/100/section/200");
  assert.equal(pageMatchesExpectation("https://www.zhihu.com/market/paid_column/100/section/200", expected), true);
  assert.equal(pageMatchesExpectation("https://www.zhihu.com/market/paid_column/999/section/200", expected), false);
});

test("成功正文必须与队列文章 ID 一致", () => {
  assert.equal(assertExpectedArticleResult({ ok: true, sectionId: "100" }, "100").sectionId, "100");
  assert.throws(
    () => assertExpectedArticleResult({ ok: true, sectionId: "200" }, "100"),
    /正文身份不匹配/
  );
  assert.doesNotThrow(() => assertExpectedArticleResult({ ok: false, reason: "加载失败" }, "100"));
});

test("权限探针可同时强校验专栏身份", () => {
  assert.doesNotThrow(() => assertExpectedArticleResult({ ok: true, sectionId: "100", columnId: "c_1" }, "100", "c_1"));
  assert.throws(
    () => assertExpectedArticleResult({ ok: true, sectionId: "100", columnId: "c_2" }, "100", "c_1"),
    /正文专栏不匹配/
  );
});
