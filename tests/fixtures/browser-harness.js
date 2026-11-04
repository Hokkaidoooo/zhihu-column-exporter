// Synthetic Chrome API boundary; fetch, decoding, DOM, ZIP and Blob are real browser operations.
const parameters = new URLSearchParams(location.search);
const scenario = parameters.get("scenario") || "normal";
const run = parameters.get("run") || "current";
const source = "https://www.zhihu.com/market/paid_column/100";
const links = Array.from({ length: 24 }, (_, index) => ({ sectionId: String(201 + index), title: `合成章节 ${index + 1}`, url: `${source}/section/${201 + index}` }));
const tabs = new Map([[1, { id: 1, url: source, title: "合成验收专栏", status: "complete" }]]);
let nextTab = 2;
const downloadListeners = new Set();
const downloads = new Map();
const startedAt = performance.now();
let peakTabs = 0;
let lostTab = false;

globalThis.chrome = {
  tabs: {
    get: async (id) => {
      if (!tabs.has(id)) throw new Error(`No tab with id: ${id}`);
      return { ...tabs.get(id) };
    },
    create: async ({ url }) => {
      const tab = { id: nextTab++, url, status: "complete" };
      tabs.set(tab.id, tab);
      peakTabs = Math.max(peakTabs, tabs.size - 1);
      return { ...tab };
    },
    update: async (id, update) => {
      if (scenario === "closed-tab" && !lostTab) { tabs.delete(id); lostTab = true; }
      if (!tabs.has(id)) throw new Error(`No tab with id: ${id}.`);
      Object.assign(tabs.get(id), update);
      return { ...tabs.get(id) };
    },
    remove: async (id) => { tabs.delete(id); },
    sendMessage: async (id, message) => {
      if (message.type === "PING" || message.type === "CANCEL_OPERATION") return { ok: true };
      if (message.type === "DISCOVER_COLUMN") return {
        ok: true, columnId: "100", columnTitle: "合成验收专栏", links,
        catalogComplete: scenario === "unknown" ? null : true,
        expectedCount: scenario === "unknown" ? null : links.length
      };
      const sectionId = tabs.get(id).url.split("/").at(-1);
      if (message.type === "PROBE_ARTICLE") return { ok: true, sectionId, fingerprint: `ready-${sectionId}` };
      if (message.type !== "EXTRACT_ARTICLE") throw new Error(`Unexpected message ${message.type}`);
      const index = Number(sectionId) - 201;
      const url = `${location.origin}/image/${index % 12}.png?run=${run}&scenario=${scenario}`;
      const text = "这是一段合成验收正文，用于检查表格、图片、中文标题与完整输出。".repeat(30);
      return {
        ...links[index], columnId: "100", ok: true, discovered: [],
        markdown: `${text}\n\n![合成图片](__ZHIHU_EXPORT_IMAGE_0__)`,
        html: `<p>${text}</p><img src="__ZHIHU_EXPORT_IMAGE_0__" alt="合成图片"><table><tr><th>项目</th><th>状态</th></tr><tr><td>完整内容</td><td>已保留</td></tr></table>`,
        images: [{ url, placeholder: "__ZHIHU_EXPORT_IMAGE_0__", alt: "合成图片" }]
      };
    }
  },
  scripting: { executeScript: async () => { throw new Error("Unexpected injection in fixture"); } },
  downloads: {
    onChanged: { addListener: (fn) => downloadListeners.add(fn), removeListener: (fn) => downloadListeners.delete(fn) },
    search: async ({ id }) => [downloads.get(id)].filter(Boolean),
    download: async ({ url }) => {
      const response = await fetch(url);
      const bytes = await response.arrayBuffer();
      const elapsed = performance.now() - startedAt;
      const result = await fetch(`/result?run=${run}&scenario=${scenario}&elapsed=${elapsed}&peakTabs=${peakTabs}`, { method: "POST", body: bytes });
      if (!result.ok) throw new Error(await result.text());
      const id = downloads.size + 1;
      downloads.set(id, { id, state: "complete" });
      for (const listener of downloadListeners) listener({ id, state: { current: "complete" } });
      return id;
    }
  }
};

addEventListener("error", (event) => {
  fetch(`/error?run=${run}&scenario=${scenario}`, { method: "POST", body: event.message });
});
addEventListener("unhandledrejection", (event) => {
  fetch(`/error?run=${run}&scenario=${scenario}`, { method: "POST", body: String(event.reason) });
});

document.addEventListener("DOMContentLoaded", () => {
  const start = document.querySelector("#start-button");
  const observer = new MutationObserver(() => {
    if (start.disabled) return;
    observer.disconnect();
    start.click();
  });
  observer.observe(start, { attributes: true, attributeFilter: ["disabled"] });
  if (!start.disabled) { observer.disconnect(); start.click(); }
});
