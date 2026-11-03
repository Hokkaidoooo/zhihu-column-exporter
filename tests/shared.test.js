// 专栏与文章 ID 均为合成测试值，不对应用户的阅读记录。
import test from "node:test";
import assert from "node:assert/strict";
import {
  canonicalSectionUrl,
  escapeHtml,
  isZhihuUrl,
  parsePaidColumnUrl,
  sanitizeFilename,
  uniqueBy
} from "../src/shared.js";
import { parseExactJsonNumbers } from "../src/shared.js";

test("精确 JSON 数字解析保持字符串、转义和普通数值语义，并拒绝损坏 JSON", () => {
  const input = '{"id":1000000000000000123,"text":"a\\\"1000000000000000123","count":3,"ratio":1.5,"exponent":1e2}';
  assert.deepEqual(parseExactJsonNumbers(input), { id: "1000000000000000123", text: 'a"1000000000000000123', count: 3, ratio: 1.5, exponent: 100 });
  for (const invalid of ['{"id":01000000000000000123}', '{"id":1000000000000000123x}', '{"id":1.}', '{1000000000000000123:1}']) {
    assert.throws(() => parseExactJsonNumbers(invalid), SyntaxError);
  }
});

test("识别旧版付费专栏章节链接", () => {
  assert.deepEqual(
    parsePaidColumnUrl("https://www.zhihu.com/market/paid_column/1000000000000001030/section/1000000000000001159?utm_source=test"),
    {
      columnId: "1000000000000001030",
      sectionId: "1000000000000001159",
      kind: "section"
    }
  );
});

test("识别新版专栏目录链接", () => {
  assert.deepEqual(
    parsePaidColumnUrl("https://www.zhihu.com/xen/market/remix/paid_column/1000000000000000901"),
    { columnId: "1000000000000000901", sectionId: null, kind: "catalog" }
  );
});

test("识别包含 paid_column 的其他知乎新路由", () => {
  assert.deepEqual(
    parsePaidColumnUrl("https://www.zhihu.com/xen/market/paid_column/123/section/456"),
    { columnId: "123", sectionId: "456", kind: "section" }
  );
  assert.equal(isZhihuUrl("https://www.zhihu.com/xen/market/ecom-page/abc"), true);
});

test("识别真实 column 目录和 zhuanlan 文章链接", () => {
  assert.deepEqual(
    parsePaidColumnUrl("https://www.zhihu.com/column/c_9000000000000000001"),
    { columnId: "c_9000000000000000001", sectionId: null, kind: "catalog" }
  );
  assert.deepEqual(
    parsePaidColumnUrl("https://zhuanlan.zhihu.com/p/123456789"),
    { columnId: null, sectionId: "123456789", kind: "section" }
  );
});

test("拒绝非知乎域名与无关知乎链接", () => {
  assert.equal(parsePaidColumnUrl("https://example.com/market/paid_column/1"), null);
  assert.equal(parsePaidColumnUrl("https://www.zhihu.com/question/123"), null);
});

test("生成规范章节链接", () => {
  assert.equal(
    canonicalSectionUrl("100", "200"),
    "https://www.zhihu.com/market/paid_column/100/section/200"
  );
  assert.equal(canonicalSectionUrl("c_100", "200"), "https://zhuanlan.zhihu.com/p/200");
  assert.throws(() => canonicalSectionUrl("bad", "200"));
});

test("文件名兼容 Windows 并限制长度", () => {
  assert.equal(sanitizeFilename('标题: 第 1/2 章?'), "标题_ 第 1_2 章_");
  assert.equal(sanitizeFilename("CON"), "_CON");
  assert.equal(Array.from(sanitizeFilename("长".repeat(100))).length, 80);
});

test("HTML 转义与稳定去重", () => {
  assert.equal(escapeHtml('<a title="x">&</a>'), "&lt;a title=&quot;x&quot;&gt;&amp;&lt;/a&gt;");
  assert.deepEqual(uniqueBy([{ id: 1 }, { id: 1 }, { id: 2 }], (item) => item.id), [{ id: 1 }, { id: 2 }]);
});
