import test from "node:test";
import assert from "node:assert/strict";
import {
  isMessageChannelClosed,
  messageChannelClosedError,
  settleFingerprint,
  waitForArticleExtraction
} from "../src/article-readiness.js";

test("正文已加载时等待连续稳定后返回", async () => {
  let extracts = 0;
  let waits = 0;
  const result = await waitForArticleExtraction({
    extract: () => {
      extracts += 1;
      return { ok: true, sectionId: "1", markdown: "正文", html: "<p>正文</p>", images: [] };
    },
    wait: async () => { waits += 1; },
    intervalMs: 250,
    minimumStableMs: 500
  });
  assert.equal(result.ok, true);
  assert.equal(extracts, 3);
  assert.equal(waits, 2);
});

test("正文增长后只返回连续稳定的完整版本", async () => {
  let extracts = 0;
  const versions = ["短正文", "这是增长后的完整正文", "这是增长后的完整正文", "这是增长后的完整正文"];
  const result = await waitForArticleExtraction({
    extract: () => {
      const markdown = versions[Math.min(extracts, versions.length - 1)];
      extracts += 1;
      return { ok: true, sectionId: "1", markdown, html: `<p>${markdown}</p>`, images: [] };
    },
    wait: async () => {},
    attempts: 5,
    intervalMs: 250,
    minimumStableMs: 500
  });
  assert.equal(result.ok, true);
  assert.equal(result.markdown, "这是增长后的完整正文");
  assert.equal(extracts, 4);
});

test("临时权限占位被完整正文替换后继续成功", async () => {
  let extracts = 0;
  const result = await waitForArticleExtraction({
    extract: () => {
      extracts += 1;
      if (extracts < 3) return { ok: false, accessDenied: true, reason: "当前浏览器会话没有显示完整正文" };
      return { ok: true, sectionId: "1", markdown: "完整正文", html: "<p>完整正文</p>", images: [] };
    },
    wait: async () => {},
    attempts: 6,
    intervalMs: 250,
    minimumStableMs: 500
  });
  assert.equal(result.ok, true);
  assert.equal(extracts, 5);
});

test("短正文稳定半秒后继续增长时不会提前返回", async () => {
  let extracts = 0;
  const versions = [
    "短正文", "短正文", "短正文",
    "这是最终完整正文", "这是最终完整正文", "这是最终完整正文", "这是最终完整正文", "这是最终完整正文", "这是最终完整正文"
  ];
  const result = await waitForArticleExtraction({
    extract: () => {
      const markdown = versions[Math.min(extracts, versions.length - 1)];
      extracts += 1;
      return { ok: true, sectionId: "1", markdown, html: `<p>${markdown}</p>`, images: [] };
    },
    wait: async () => {},
    attempts: 10,
    intervalMs: 250,
    minimumStableMs: 1200
  });
  assert.equal(result.ok, true);
  assert.equal(result.markdown, "这是最终完整正文");
  assert.equal(extracts, 9);
});

test("权限占位持续到等待结束时才确认拒绝", async () => {
  let waits = 0;
  const result = await waitForArticleExtraction({
    extract: () => ({ ok: false, accessDenied: true, reason: "当前浏览器会话没有显示完整正文" }),
    wait: async () => { waits += 1; },
    attempts: 4,
    intervalMs: 250
  });
  assert.equal(result.accessDenied, true);
  assert.equal(waits, 3);
});

test("廉价探针稳定后只做一次完整转换", async () => {
  let probes = 0;
  let extracts = 0;
  const fingerprints = ["1:100:2:0:0", "1:800:9:1:40", "1:1600:18:2:80", "1:1600:18:2:80", "1:1600:18:2:80"];
  const result = await waitForArticleExtraction({
    probe: () => {
      const fingerprint = fingerprints[Math.min(probes, fingerprints.length - 1)];
      probes += 1;
      return { ok: true, fingerprint };
    },
    extract: () => {
      extracts += 1;
      return { ok: true, sectionId: "1", markdown: "完整正文", html: "<p>完整正文</p>", images: [] };
    },
    wait: async () => {},
    intervalMs: 150,
    minimumStableMs: 300
  });
  assert.equal(result.ok, true);
  assert.equal(extracts, 1, "完整转换只应在探针稳定后执行一次");
  assert.equal(probes, 5);
});

test("探针一直为空时不会耗尽全部轮询次数", async () => {
  let probes = 0;
  const result = await waitForArticleExtraction({
    probe: () => {
      probes += 1;
      return { ok: false };
    },
    extract: () => ({ ok: false, accessDenied: true, reason: "当前浏览器会话没有显示完整正文" }),
    wait: async () => {},
    attempts: 200,
    emptyLimit: 6
  });
  assert.equal(result.accessDenied, true);
  assert.equal(probes, 6);
});

test("探针稳定但正文仍不可用时返回提取器的失败原因", async () => {
  const result = await waitForArticleExtraction({
    probe: () => ({ ok: true, fingerprint: "1:2400:20:0:0" }),
    extract: () => ({ ok: false, reason: "提取到的正文过短" }),
    wait: async () => {},
    intervalMs: 150,
    minimumStableMs: 300
  });
  assert.equal(result.ok, false);
  assert.equal(result.reason, "提取到的正文过短");
});

test("指纹稳定判定累计请求的间隔并报告样本数", async () => {
  let waits = 0;
  const settled = await settleFingerprint({
    sample: () => "same",
    wait: async () => { waits += 1; },
    intervalMs: 100,
    stableSamples: 3,
    minimumStableMs: 300
  });
  assert.equal(settled.settled, true);
  assert.equal(settled.fingerprint, "same");
  assert.equal(settled.samples, 4);
  assert.equal(waits, 3);

  const unsettled = await settleFingerprint({
    sample: () => String(waits++),
    wait: async () => {},
    attempts: 5,
    intervalMs: 100,
    minimumStableMs: 300
  });
  assert.equal(unsettled.settled, false);
  assert.equal(unsettled.samples, 5);
});

test("识别 Chrome 文档切换导致的消息通道错误", () => {
  assert.equal(isMessageChannelClosed(new Error("A listener indicated an asynchronous response by returning true, but the message channel closed before a response was received")), true);
  assert.equal(isMessageChannelClosed(new Error("Could not establish connection. Receiving end does not exist.")), true);
  assert.equal(isMessageChannelClosed(new Error("正文提取失败")), false);
  assert.match(messageChannelClosedError().message, /文章页.*跳转.*仍未返回结果/);
});
