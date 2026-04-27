import { log } from '../utils/logger.js';
import { setRowState, getTrackerRoot, injectInlineStyles, createTrackerRoot } from './ui.js';
import { chooseBestComposerHost, findControlsContainer } from './dom.js';

const MOUNT_THROTTLE_MS = 250;
const REFRESH_INTERVAL_MS = 60 * 1000;
let refreshTimer = null;
let mutationObserver = null;
let mountThrottleTimer = null;

export function ensureTrackerMounted() {
  injectInlineStyles();
  const host = chooseBestComposerHost();
  if (!host) { log('host-missing'); return null; }
  let root = getTrackerRoot();
  if (!root) { root = createTrackerRoot(); }
  const targetContainer = findControlsContainer(host);
  if (targetContainer) {
    if (root.parentElement !== targetContainer) {
      targetContainer.appendChild(root);
      log('controls-found', targetContainer);
    }
  } else {
    if (root.parentElement !== host.parentElement) {
      if (host.nextElementSibling !== root) {
        host.insertAdjacentElement('afterend', root);
        log('host-fallback', host);
      }
    }
  }
  return root;
}

export function requestUsageData() {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ action: "getUsageData" }, (response) => {
      if (chrome.runtime.lastError) { reject(new Error(chrome.runtime.lastError.message)); return; }
      if (!response || !response.success) { reject(new Error(response?.error || "Unable to fetch usage data")); return; }
      resolve(response.data);
    });
  });
}

export async function updateInlineTracker() {
  const root = ensureTrackerMounted();
  if (!root) return;
  try {
    const data = await requestUsageData();
    setRowState("clu-five-hour", data.fiveHour);
    setRowState("clu-seven-day", data.sevenDay);
    log("data-ok");
  } catch (error) {
    log("data-error", error.message);
  }
}

export function scheduleMountAndUpdate() {
  if (mountThrottleTimer) return;
  mountThrottleTimer = window.setTimeout(() => {
    mountThrottleTimer = null;
    updateInlineTracker();
  }, MOUNT_THROTTLE_MS);
}

export function startRefreshLoop() {
  if (refreshTimer) window.clearInterval(refreshTimer);
  updateInlineTracker();
  refreshTimer = window.setInterval(updateInlineTracker, REFRESH_INTERVAL_MS);
}

export function startMutationObserver() {
  if (mutationObserver) mutationObserver.disconnect();
  mutationObserver = new MutationObserver(() => { scheduleMountAndUpdate(); });
  mutationObserver.observe(document.body, { childList: true, subtree: true });
}
