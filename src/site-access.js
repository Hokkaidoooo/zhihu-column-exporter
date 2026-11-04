// Scheduling policy only: disabling this never relaxes content or access checks.
export const PAUSE_ON_ACCESS_RESTRICTION = true;

export function restrictedHttpStatus(status) {
  return PAUSE_ON_ACCESS_RESTRICTION && [401, 403, 429].includes(Number(status));
}

export function assertPageAccess(pageUrl) {
  if (!PAUSE_ON_ACCESS_RESTRICTION || !pageUrl) return;
  const path = new URL(pageUrl).pathname;
  if (/^\/(?:account\/unhuman|captcha|challenge|signin)(?:\/|$)/i.test(path)) {
    throw new SiteAccessRestrictionError("知乎要求登录或安全验证，请先在原页面处理");
  }
}

export class SiteAccessRestrictionError extends Error {
  constructor(reason) {
    super(`知乎限制了当前访问，已停止自动读取：${reason}`);
    this.name = "SiteAccessRestrictionError";
  }
}
