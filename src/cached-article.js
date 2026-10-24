import { normalizeColumnArticleItem } from "./article-api.js";
import { extractArticleDocument } from "./content-core.js";

export function extractColumnArticleItem(item, columnId, hostDocument, toMarkdown) {
  const normalized = normalizeColumnArticleItem(item, columnId);
  if (!normalized.ok) return normalized;

  const articleDocument = hostDocument.implementation.createHTMLDocument(normalized.title);
  articleDocument.title = normalized.title;
  const heading = articleDocument.createElement("h1");
  heading.textContent = normalized.title;
  const columnLink = articleDocument.createElement("a");
  columnLink.href = `https://www.zhihu.com/column/${columnId}`;
  columnLink.textContent = "所属专栏";
  const article = articleDocument.createElement("article");
  article.className = "RichText";
  article.innerHTML = normalized.content;
  articleDocument.body.append(heading, columnLink, article);

  const result = extractArticleDocument(articleDocument, normalized.url, toMarkdown);
  return {
    ...result,
    columnId,
    sectionId: normalized.sectionId,
    title: normalized.title,
    url: normalized.url,
    requiresAccessValidation: normalized.requiresAccessValidation
  };
}
