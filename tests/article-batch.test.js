import test from "node:test";
import assert from "node:assert/strict";
import { validateArticleBatchResponse } from "../src/cached-batch.js";

test("批次结果可乱序返回但按请求顺序恢复", () => {
  const result = validateArticleBatchResponse({
    ok: true,
    articles: [
      { ok: true, sectionId: "3" },
      { ok: true, sectionId: "1" },
      { ok: false, sectionId: "2", reason: "拒绝" }
    ]
  }, ["1", "2", "3"]);
  assert.deepEqual(result.map((item) => item.sectionId), ["1", "2", "3"]);
});

test("批次结果拒绝缺项、重复、额外 ID 和错误结构", () => {
  assert.throws(() => validateArticleBatchResponse({ ok: true, articles: [{ sectionId: "1" }] }, ["1", "2"]), /缺少文章/);
  assert.throws(() => validateArticleBatchResponse({ ok: true, articles: [{ sectionId: "1" }, { sectionId: "1" }] }, ["1"]), /重复返回/);
  assert.throws(() => validateArticleBatchResponse({ ok: true, articles: [{ sectionId: "2" }] }, ["1"]), /未请求/);
  assert.throws(() => validateArticleBatchResponse({ ok: true }, ["1"]), /格式无效/);
});
