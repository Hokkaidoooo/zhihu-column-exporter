// 专栏与文章 ID 均为合成测试值，不对应用户的阅读记录。
import test from "node:test";
import assert from "node:assert/strict";
import {
  articleDetailApiUrl,
  fetchArticleDetail,
  normalizeArticleDetailPayload
} from "../src/article-detail-api.js";

const columnId = "c_9000000000000000001";
const sectionId = "1000000000000000123";

function response({ status = 200, contentType = "application/json", payload = {} } = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name) => name.toLowerCase() === "content-type" ? contentType : null },
    json: async () => payload
  };
}

test("文章详情端点只接受知乎同源地址和精确字符串 ID", () => {
  assert.equal(
    articleDetailApiUrl(sectionId, "https://www.zhihu.com"),
    `https://www.zhihu.com/api/v4/articles/${sectionId}?include=title%2Ccontent%2Cexcerpt%2Ccontent_need_truncated%2Curl`
  );
  assert.equal(
    articleDetailApiUrl(sectionId, "https://zhuanlan.zhihu.com"),
    `https://zhuanlan.zhihu.com/api/articles/${sectionId}`
  );
  assert.throws(() => articleDetailApiUrl("20x", "https://www.zhihu.com"));
  assert.throws(() => articleDetailApiUrl(sectionId, "https://example.com"));
});

test("详情响应以请求 URL 绑定精确 ID 且只采用顶层 content", () => {
  const result = normalizeArticleDetailPayload({
    id: 1000000000000000100,
    url: `https://zhuanlan.zhihu.com/p/${sectionId}`,
    title: "文章",
    content: "<p>登录态正文</p>",
    paid_info: { content: "<p>不得采用</p>" }
  }, columnId, sectionId);
  assert.equal(result.ok, true);
  assert.equal(result.sectionId, sectionId);
  assert.equal(result.content, "<p>登录态正文</p>");
});

test("详情响应中的精确 URL 身份不匹配时拒绝", () => {
  const result = normalizeArticleDetailPayload({
    url: "https://zhuanlan.zhihu.com/p/1000000000000001675",
    content: "<p>错误文章</p>"
  }, columnId, sectionId);
  assert.equal(result.ok, false);
  assert.match(result.reason, /身份不匹配/);
});

test("200 响应中的订阅占位不能当作正文", () => {
  const result = normalizeArticleDetailPayload({
    url: `https://zhuanlan.zhihu.com/p/${sectionId}`,
    content: "<p>试看已结束，请立即订阅。</p>"
  }, columnId, sectionId);
  assert.equal(result.ok, false);
  assert.equal(result.accessDenied, true);
});

test("知乎标记为截断的试看正文直接拒绝且不可重试", () => {
  const result = normalizeArticleDetailPayload({
    url: `https://zhuanlan.zhihu.com/p/${sectionId}`,
    title: "文章",
    content: "<p>这是付费专栏的试看片段，正文只返回了开头一部分。</p>",
    content_need_truncated: true
  }, columnId, sectionId);
  assert.equal(result.ok, false);
  assert.equal(result.truncated, true);
  assert.equal(result.accessDenied, undefined);
  assert.equal(result.retryable, undefined);
  assert.match(result.reason, /截断|试看/);
});

test("未标记截断的完整正文不会带出截断标记", () => {
  const result = normalizeArticleDetailPayload({
    url: `https://zhuanlan.zhihu.com/p/${sectionId}`,
    title: "文章",
    content: "<p>完整正文</p>",
    content_need_truncated: false
  }, columnId, sectionId);
  assert.equal(result.ok, true);
  assert.equal(result.requiresAccessValidation, false);
});

test("401 和 403 直接归类为拒绝且不解析响应体", async () => {
  let parsed = false;
  const result = await fetchArticleDetail({
    sectionId,
    columnId,
    apiOrigin: "https://www.zhihu.com",
    request: async () => ({
      ...response({ status: 403 }),
      json: async () => {
        parsed = true;
        return {};
      }
    })
  });
  assert.equal(result.ok, false);
  assert.equal(result.accessDenied, true);
  assert.equal(result.retryable, undefined);
  assert.equal(parsed, false);
});

test("429、5xx 和网络错误标记为可重试", async () => {
  const tooMany = await fetchArticleDetail({
    sectionId,
    columnId,
    apiOrigin: "https://www.zhihu.com",
    request: async () => response({ status: 429 })
  });
  const unavailable = await fetchArticleDetail({
    sectionId,
    columnId,
    apiOrigin: "https://www.zhihu.com",
    request: async () => response({ status: 503 })
  });
  const network = await fetchArticleDetail({
    sectionId,
    columnId,
    apiOrigin: "https://www.zhihu.com",
    request: async () => { throw new Error("offline"); }
  });
  assert.equal(tooMany.retryable, true);
  assert.equal(unavailable.retryable, true);
  assert.equal(network.retryable, true);
});

test("200 HTML 和错误 JSON 不能伪装成正文", async () => {
  const html = await fetchArticleDetail({
    sectionId,
    columnId,
    apiOrigin: "https://www.zhihu.com",
    request: async () => response({ contentType: "text/html" })
  });
  const apiError = await fetchArticleDetail({
    sectionId,
    columnId,
    apiOrigin: "https://www.zhihu.com",
    request: async () => response({ payload: { error: { message: "拒绝" } } })
  });
  assert.match(html.reason, /没有返回 JSON/);
  assert.match(apiError.reason, /拒绝/);
});

test("请求明确传递 include 或 omit，不读取 Cookie 值", async () => {
  const seen = [];
  for (const credentials of ["include", "omit"]) {
    await fetchArticleDetail({
      sectionId,
      columnId,
      apiOrigin: "https://www.zhihu.com",
      credentials,
      request: async (_url, options) => {
        seen.push(options);
        return response({ status: 403 });
      }
    });
  }
  assert.deepEqual(seen.map((item) => item.credentials), ["include", "omit"]);
  assert.equal(seen.some((item) => "cookie" in item.headers), false);
});
