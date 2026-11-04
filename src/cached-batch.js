export function validateArticleBatchResponse(response, expectedSectionIds) {
  if (!response?.ok) throw new Error(response?.reason || "批量正文提取失败");
  if (!Array.isArray(response.articles)) throw new Error("批量正文结果格式无效");

  const expected = expectedSectionIds.map(String);
  const expectedSet = new Set(expected);
  const byId = new Map();
  for (const article of response.articles) {
    const sectionId = String(article?.sectionId || "");
    if (!expectedSet.has(sectionId)) throw new Error(`批量结果包含未请求的文章：${sectionId || "未知"}`);
    if (byId.has(sectionId)) throw new Error(`批量结果重复返回文章：${sectionId}`);
    byId.set(sectionId, article);
  }
  const missing = expected.filter((sectionId) => !byId.has(sectionId));
  if (missing.length) throw new Error(`批量结果缺少文章：${missing.join("、")}`);
  return expected.map((sectionId) => byId.get(sectionId));
}
