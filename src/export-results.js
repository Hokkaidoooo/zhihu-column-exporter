export function collectUnexportedArticles({ links, articles, failures, reason }) {
  const successfulIds = new Set(articles.map((article) => article.sectionId));
  const failuresById = new Map(failures.map((failure) => [failure.sectionId, failure]));
  return links.filter((link) => !successfulIds.has(link.sectionId)).map((link) => {
    const failure = failuresById.get(link.sectionId);
    if (failure) return failure;
    return {
      sectionId: link.sectionId,
      title: link.title,
      url: link.url,
      reason,
      accessDenied: false
    };
  });
}
