(() => {
  // src/background.js
  chrome.action.onClicked.addListener(async (tab) => {
    if (!tab?.id) return;
    const url = chrome.runtime.getURL(`export.html?tabId=${tab.id}`);
    await chrome.tabs.create({ url, active: true });
  });
})();
