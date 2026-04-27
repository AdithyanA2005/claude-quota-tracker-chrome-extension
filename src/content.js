import { log } from './utils/logger.js';
import { extractAndSendOrgId, sendOrgIdToBackground, getOrgIdFromLocalStorage, getOrgIdFromWindowState } from './content/auth.js';
import { startRefreshLoop, startMutationObserver, updateInlineTracker, scheduleMountAndUpdate } from './content/tracker.js';
import { patchHistoryForSpaNavigation, handleRouteOrViewChange } from './content/router.js';

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request.action === "getOrgId") {
    const orgId = getOrgIdFromLocalStorage() || getOrgIdFromWindowState();
    if (orgId) sendOrgIdToBackground(orgId);
    sendResponse({ orgId });
    return false;
  }
  if (request.action === "refreshInlineTracker") {
    updateInlineTracker().then(() => sendResponse({ success: true }));
    return true;
  }
  return false;
});

function init() {
  log("content-script-loaded");
  extractAndSendOrgId();
  patchHistoryForSpaNavigation();
  startRefreshLoop();
  startMutationObserver();

  window.addEventListener("clu:locationchange", handleRouteOrViewChange);
  window.addEventListener("popstate", handleRouteOrViewChange);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") scheduleMountAndUpdate();
  });
}

if (document.readyState === "complete" || document.readyState === "interactive") {
  init();
} else {
  window.addEventListener("load", init, { once: true });
}
