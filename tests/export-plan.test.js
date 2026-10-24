import test from "node:test";
import assert from "node:assert/strict";
import {
  MAX_CONSECUTIVE_PAGE_FAILURES,
  PAGE_MODE_MS_PER_ARTICLE,
  PAGE_MODE_TAB_COUNT,
  describeArticleMismatch,
  estimatePageModeDuration,
  formatDuration,
  pageModeAnnouncement,
  pageModeStopMessage,
  pageModeTabCount,
  planArticleSource,
  remainingTimeText,
  shouldStopPageMode
} from "../src/export-plan.js";

function comparison(overrides = {}) {
  return {
    matches: false,
    reason: "两份正文长度差异过大",
    kind: "apiTruncated",
    apiLength: 1041,
    pageLength: 3095,
    lengthRatio: 0.3363,
    apiCoverage: 1,
    pageCoverage: 0.3348,
    apiOrderCoverage: 0.1778,
    pageOrderCoverage: 0.0615,
    startCoverage: 0.9872,
    endCoverage: 0,
    missingSample: "页面独有的后续正文片段",
    ...overrides
  };
}

test("正文一致时选择登录态接口批量导出", () => {
  const plan = planArticleSource({
    comparison: comparison({ matches: true, kind: "acceptable", reason: "正文内容一致，仅存在可接受的展示差异" })
  });
  assert.equal(plan.mode, "api");
  assert.match(plan.headline, /已通过权限与正文一致性校验/);
  assert.match(plan.detail, /接口 1041 字/);
});

test("接口只返回试看正文时改用逐篇页面提取而不是停止", () => {
  const plan = planArticleSource({ comparison: comparison() });
  assert.equal(plan.mode, "page");
  assert.match(plan.headline, /只返回试看正文/);
  assert.match(plan.headline, /仅为页面正文的 34%/);
  assert.match(plan.headline, /已自动改用逐篇页面提取/);
  assert.match(plan.detail, /页面独有片段：页面独有的后续正文片段/);
  assert.doesNotMatch(plan.headline, /已停止/);
});

test("页面正文更短、内容不一致、过短和不可用都改用页面提取", () => {
  const kinds = ["pageTruncated", "different", "tooShort", "unavailable"];
  for (const kind of kinds) {
    const plan = planArticleSource({ comparison: comparison({ kind }) });
    assert.equal(plan.mode, "page", `${kind} 应改用页面提取`);
    assert.match(plan.headline, /已自动改用逐篇页面提取/);
  }
  assert.match(describeArticleMismatch(comparison({ kind: "pageTruncated" })), /页面 3095 字/);
  assert.match(describeArticleMismatch(comparison({ kind: "different" })), /不一致/);
  assert.match(describeArticleMismatch(comparison({ kind: "tooShort" })), /过短/);
  assert.match(
    describeArticleMismatch(comparison({ kind: "unavailable", reason: "接口或正常文章页未成功提取正文" })),
    /未成功提取正文/
  );
});

test("接口探针失败或缺少校验结果时也不会停止导出", () => {
  const probe = planArticleSource({ probeFailure: "文章接口返回 HTTP 403" });
  assert.equal(probe.mode, "page");
  assert.match(probe.headline, /文章接口返回 HTTP 403/);
  assert.match(probe.headline, /已自动改用逐篇页面提取/);

  const missing = planArticleSource({});
  assert.equal(missing.mode, "page");
  assert.match(missing.headline, /没有完成文章接口正文校验/);
});

test("时长文案覆盖秒、分钟和小时", () => {
  assert.equal(formatDuration(0), "1 秒");
  assert.equal(formatDuration(45000), "45 秒");
  assert.equal(formatDuration(90000), "2 分钟");
  assert.equal(formatDuration(45 * 60000), "45 分钟");
  assert.equal(formatDuration(60 * 60000), "1 小时");
  assert.equal(formatDuration(77 * 60000), "1 小时 17 分钟");
});

test("页面提取预估按并行标签页数缩短并在公告中说明", () => {
  assert.equal(estimatePageModeDuration(922, 4000, 1), 3688000);
  assert.equal(estimatePageModeDuration(922, 4000, 4), 922000);
  assert.equal(estimatePageModeDuration(0), 0);
  assert.equal(pageModeTabCount(922), PAGE_MODE_TAB_COUNT);
  assert.equal(pageModeTabCount(2), 2, "篇数少于并行上限时不应多开标签页");
  assert.equal(pageModeTabCount(0), 1);
  const announcement = pageModeAnnouncement(922, PAGE_MODE_MS_PER_ARTICLE);
  assert.match(announcement, /共 922 篇/);
  assert.match(announcement, /预计 10 分钟/);
  assert.match(announcement, /使用 4 个后台标签页并行/);
  assert.match(announcement, /可随时停止并保存已完成部分/);
  assert.equal(pageModeAnnouncement(0), "没有需要逐篇提取的文章");
});

test("剩余时间在样本足够后才给出", () => {
  assert.equal(remainingTimeText(10000, 2, 900), "");
  assert.equal(remainingTimeText(10000, 5, 0), "");
  assert.equal(remainingTimeText(15000, 3, 100), "预计还需 8 分钟");
});

test("连续失败达到上限才熔断，并说明已完成部分会保存", () => {
  assert.equal(shouldStopPageMode(MAX_CONSECUTIVE_PAGE_FAILURES - 1), false);
  assert.equal(shouldStopPageMode(MAX_CONSECUTIVE_PAGE_FAILURES), true);
  assert.equal(shouldStopPageMode(3, 3), true);
  assert.equal(shouldStopPageMode(2, 3), false);
  const message = pageModeStopMessage(10, 618);
  assert.match(message, /连续 10 篇页面提取失败/);
  assert.match(message, /已完成的 618 篇会保存/);
});
