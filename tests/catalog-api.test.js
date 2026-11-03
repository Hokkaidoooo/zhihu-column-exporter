// 专栏与文章 ID 均为合成测试值，不对应用户的阅读记录。
import test from "node:test";
import assert from "node:assert/strict";
import {
  columnArticlesApiUrl,
  fetchAllColumnArticles,
  parseColumnArticlesPage
} from "../src/catalog-api.js";

function makeArticles(count) {
  return Array.from({ length: count }, (_, index) => ({
    id: String(200000 + index),
    title: `第 ${index + 1} 篇`
  }));
}

test("缺失总数不冒充零，显式末页仍可确认完整目录", async () => {
  for (const total of [undefined, null, "", false]) {
    const page = parseColumnArticlesPage({ data: makeArticles(1), paging: { totals: total } }, "c_123");
    assert.equal(page.total, null);
  }
  const offsets = [];
  const articles = makeArticles(2);
  const result = await fetchAllColumnArticles({ columnId: "c_123", requestPage: async (_url, { offset }) => {
    offsets.push(offset);
    return { data: [articles[offset]], paging: { totals: null, is_end: offset === 1 } };
  } });
  assert.deepEqual(offsets, [0, 1]);
  assert.equal(result.expectedCount, 2);
  assert.equal(result.complete, true);
});

test("目录缺少文章数组或含失真身份时显式拒绝，不跳过后报告完整", () => {
  assert.throws(() => parseColumnArticlesPage({ paging: { is_end: true } }, "c_123"), /文章数组/);
  assert.throws(() => parseColumnArticlesPage({ data: [{ id: 1000000000000000123 }], paging: { is_end: true } }, "c_123"), /精确文章身份/);
});

function pagedRequest(articles, pageSize = 20, overlap = 0, columnId = "c_123") {
  return async (_url, { offset }) => {
    const start = Math.max(0, offset - (offset ? overlap : 0));
    const data = articles.slice(start, offset + pageSize);
    const nextOffset = Math.min(offset + pageSize, articles.length);
    return {
      data,
      paging: {
        totals: articles.length,
        is_end: nextOffset >= articles.length,
        next: nextOffset >= articles.length
          ? ""
          : `http://www.zhihu.com/api/v4/columns/${columnId}/articles?limit=${pageSize}&offset=${nextOffset}`
      }
    };
  };
}

test("无需页面滚动即可分页发现 327 篇并保持顺序", async () => {
  const articles = makeArticles(327);
  const offsets = [];
  const result = await fetchAllColumnArticles({
    columnId: "c_123",
    requestPage: async (url, context) => {
      offsets.push(context.offset);
      return pagedRequest(articles)(url, context);
    }
  });

  assert.equal(result.complete, true);
  assert.equal(result.expectedCount, 327);
  assert.equal(result.links.length, 327);
  assert.deepEqual(result.links.map((item) => item.sectionId), articles.map((item) => item.id));
  assert.equal(offsets.length, 17);
  assert.equal(offsets.at(-1), 320);
});

test("支持超过旧版 600 上限的 922 篇目录", async () => {
  const articles = makeArticles(922);
  const result = await fetchAllColumnArticles({
    columnId: "c_9000000000000000001",
    requestPage: pagedRequest(articles, 20, 0, "c_9000000000000000001")
  });
  assert.equal(result.links.length, 922);
  assert.equal(new Set(result.links.map((item) => item.sectionId)).size, 922);
  assert.equal(result.pageCount, 47);
});

test("分页边界有重复文章时稳定去重", async () => {
  const articles = makeArticles(37);
  const result = await fetchAllColumnArticles({
    columnId: "c_123",
    requestPage: pagedRequest(articles, 10, 2)
  });
  assert.equal(result.links.length, 37);
  assert.deepEqual(result.links.map((item) => item.sectionId), articles.map((item) => item.id));
});

test("未到结尾却返回空页时拒绝伪装成全量完成", async () => {
  await assert.rejects(
    fetchAllColumnArticles({
      columnId: "c_123",
      requestPage: async () => ({
        data: [],
        paging: { totals: 327, is_end: false, next: "http://www.zhihu.com/api/v4/columns/c_123/articles?limit=20&offset=20" }
      })
    }),
    /提前返回空数据/
  );
});

test("只采用知乎目录接口的安全 offset，不直接跟随 http next", () => {
  const page = parseColumnArticlesPage({
    data: [{ id: "456", title: "文章" }],
    paging: {
      totals: 2,
      is_end: false,
      next: "http://www.zhihu.com/api/v4/columns/c_123/articles?limit=20&offset=20"
    }
  }, "c_123", 0);
  assert.equal(page.nextOffset, 20);
  assert.equal(page.links[0].url, "https://zhuanlan.zhihu.com/p/456");
  assert.equal(columnArticlesApiUrl("c_123", 20), "https://www.zhihu.com/api/v4/columns/c_123/articles?limit=20&offset=20");
  assert.equal(
    columnArticlesApiUrl("c_123", 20, 20, "https://zhuanlan.zhihu.com"),
    "https://zhuanlan.zhihu.com/api/columns/c_123/articles?limit=20&offset=20"
  );
});

test("目录解析使用 URL 中的精确 19 位文章 ID", () => {
  const page = parseColumnArticlesPage({
    data: [{
      id: 1000000000000000100,
      url: "https://zhuanlan.zhihu.com/p/1000000000000000123",
      title: "精确文章",
      content_need_truncated: true
    }],
    paging: { totals: 1, is_end: true, next: "" }
  }, "c_9000000000000000001", 0);
  assert.equal(page.links[0].sectionId, "1000000000000000123");
  assert.equal(page.links[0].url, "https://zhuanlan.zhihu.com/p/1000000000000000123");
  assert.equal(page.links[0].requiresAccessProbe, true);
});

test("拒绝无效分页位置，避免无限循环", async () => {
  await assert.rejects(
    fetchAllColumnArticles({
      columnId: "c_123",
      requestPage: async () => {
        return {
          data: [{ id: "456", title: "文章" }],
          paging: { totals: 20, is_end: false, next: "http://www.zhihu.com/api/v4/columns/c_123/articles?limit=20&offset=20" }
        };
      },
      maxPages: 5
    }),
    /无效的下一页地址/
  );
});
