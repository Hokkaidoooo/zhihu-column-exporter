import { probeArticleDocument } from "./content-core.js";

// Cache only a small readiness result, never article text or converted output.
// Setting this to false keeps the original full-scan path for diagnosis.
export const CACHE_ARTICLE_PROBES = true;

export function createArticleProbe(document, { enabled = CACHE_ARTICLE_PROBES, probe = probeArticleDocument } = {}) {
  let cached = null;
  let cachedUrl = "";
  let sources = [];
  let observer = null;
  const invalidate = () => { cached = null; sources = []; };
  const observe = () => {
    if (!enabled || observer) return;
    observer = new document.defaultView.MutationObserver(invalidate);
    observer.observe(document, { subtree: true, childList: true, characterData: true, attributes: true });
  };

  return {
    read(pageUrl) {
      if (!enabled) return probe(document, pageUrl);
      observe();
      // takeRecords covers changes made before the observer callback runs.
      if (observer.takeRecords().length || cachedUrl !== pageUrl
        || sources.some(({ image, src }) => image.currentSrc !== src)) invalidate();
      if (!cached) {
        cached = probe(document, pageUrl);
        cachedUrl = pageUrl;
        // Responsive image selection can change without a DOM mutation.
        sources = Array.from(document.images, (image) => ({ image, src: image.currentSrc }));
      }
      return cached;
    },
    release() {
      observer?.disconnect();
      observer = null;
      invalidate();
    }
  };
}
