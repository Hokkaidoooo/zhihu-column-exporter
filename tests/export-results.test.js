import test from "node:test";
import assert from "node:assert/strict";
import { collectUnexportedArticles } from "../src/export-results.js";

const links = ["1", "2", "3"].map((sectionId) => ({ sectionId, title: `测试文章 ${sectionId}`, url: `https://zhuanlan.zhihu.com/p/${sectionId}` }));

test("停止后清单覆盖失败与尚未尝试的文章，顺序与目录一致", () => {
  const failure = { ...links[1], reason: "HTTP 403", accessDenied: true };
  const remaining = collectUnexportedArticles({ links, articles: [{ sectionId: "1" }], failures: [failure], reason: "用户停止导出" });
  assert.deepEqual(remaining.map((item) => item.sectionId), ["2", "3"]);
  assert.equal(remaining[0], failure);
  assert.equal(remaining[1].reason, "用户停止导出");
  assert.equal(remaining[1].accessDenied, false);
});

test("成功补回的文章不会残留在未完成清单中", () => {
  const remaining = collectUnexportedArticles({ links, articles: [{ sectionId: "1" }, { sectionId: "2" }], failures: [{ ...links[1], reason: "旧失败" }], reason: "任务中断" });
  assert.deepEqual(remaining.map((item) => item.sectionId), ["3"]);
});

test("全部成功时清单为空，输入不会被修改", () => {
  const failures = [{ ...links[1], reason: "旧失败" }];
  const original = structuredClone({ links, failures });
  const remaining = collectUnexportedArticles({ links, articles: links.map(({ sectionId }) => ({ sectionId })), failures, reason: "未完成" });
  assert.deepEqual(remaining, []);
  assert.deepEqual({ links, failures }, original);
});
