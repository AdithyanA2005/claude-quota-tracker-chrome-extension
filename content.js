// Claude Usage Tracker - Content Script
// Mounts inline quota bars near Claude's composer and keeps them mounted.

const TRACKER_ROOT_ID = 'clu-usage-inline-root';
const TRACKER_STYLE_ID = 'clu-usage-inline-style';
const REFRESH_INTERVAL_MS = 60 * 1000;
const MOUNT_THROTTLE_MS = 250;

const LOG_PREFIX = '[CLUT]';

let refreshTimer = null;
let mutationObserver = null;
let mountThrottleTimer = null;
let locationHref = window.location.href;

let orgIdExtractionAttempts = 0;
const MAX_ORG_ID_EXTRACTION_ATTEMPTS = 10;

function log(message, extra) {
  if (typeof extra === 'undefined') {
    console.log(`${LOG_PREFIX} ${message}`);
  } else {
    console.log(`${LOG_PREFIX} ${message}`, extra);
  }
}

function normalizeOrgId(value) {
  if (!value) {
    return null;
  }

  let normalized = String(value).trim();

  try {
    normalized = decodeURIComponent(normalized);
  } catch (_error) {
    // Value may already be decoded.
  }

  try {
    const parsed = JSON.parse(normalized);
    if (typeof parsed === 'string') {
      normalized = parsed;
    } else if (parsed && typeof parsed === 'object') {
      normalized = parsed.uuid || parsed.id || parsed.organization_uuid || normalized;
    }
  } catch (_error) {
    normalized = normalized.replace(/^['"]|['"]$/g, '');
  }

  const uuidMatch = normalized.match(/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i);
  return uuidMatch ? uuidMatch[0] : normalized;
}

function getOrgIdFromLocalStorage() {
  try {
    const lastActiveOrg = localStorage.getItem('lastActiveOrg');
    if (lastActiveOrg) {
      return normalizeOrgId(lastActiveOrg);
    }
  } catch (error) {
    log('localStorage read failed', error);
  }

  return null;
}

function getOrgIdFromWindowState() {
  try {
    const state = window.__INITIAL_STATE__;
    if (state && state.orgId) {
      return normalizeOrgId(state.orgId);
    }
  } catch (error) {
    log('window state read failed', error);
  }

  return null;
}

function sendOrgIdToBackground(orgId) {
  if (!orgId) {
    return;
  }

  chrome.runtime.sendMessage({ action: 'setOrgId', orgId }, () => {
    if (chrome.runtime.lastError) {
      log('setOrgId failed', chrome.runtime.lastError.message);
    }
  });
}

function extractAndSendOrgId() {
  const orgId = getOrgIdFromLocalStorage() || getOrgIdFromWindowState();

  if (orgId) {
    sendOrgIdToBackground(orgId);
    return;
  }

  orgIdExtractionAttempts += 1;
  if (orgIdExtractionAttempts < MAX_ORG_ID_EXTRACTION_ATTEMPTS) {
    window.setTimeout(extractAndSendOrgId, 2000);
  }
}

function isVisibleElement(el) {
  if (!el || !(el instanceof Element)) {
    return false;
  }

  const style = window.getComputedStyle(el);
  if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) {
    return false;
  }

  const rect = el.getBoundingClientRect();
  return rect.width > 40 && rect.height > 20;
}

function getComposerInputs() {
  const selectors = [
    'textarea',
    '[contenteditable="true"][role="textbox"]',
    '[contenteditable="true"][aria-label*="prompt" i]',
    '[contenteditable="true"]'
  ];

  const candidates = [];
  for (const selector of selectors) {
    const nodes = document.querySelectorAll(selector);
    for (const node of nodes) {
      if (isVisibleElement(node)) {
        candidates.push(node);
      }
    }
  }

  return candidates;
}

function chooseBestComposerHost() {
  const inputs = getComposerInputs();

  for (const input of inputs) {
    const form = input.closest('form');
    if (form && isVisibleElement(form)) {
      return form;
    }

    const panel = input.closest('[class*="composer" i], [class*="prompt" i], [class*="input" i]');
    if (panel && isVisibleElement(panel)) {
      return panel;
    }

    const immediate = input.parentElement;
    if (immediate && isVisibleElement(immediate)) {
      return immediate;
    }
  }

  return null;
}

function injectInlineStyles() {
  if (document.getElementById(TRACKER_STYLE_ID)) {
    return;
  }

  const style = document.createElement('style');
  style.id = TRACKER_STYLE_ID;
  style.textContent = `
    #${TRACKER_ROOT_ID} {
      width: 100%;
      margin-top: 8px;
      border-radius: 10px;
      border: 1px solid rgba(255, 255, 255, 0.08);
      background: linear-gradient(135deg, rgba(12, 19, 34, 0.86), rgba(18, 29, 48, 0.68));
      padding: 7px 10px 8px;
      backdrop-filter: blur(6px);
      box-sizing: border-box;
      animation: cluFadeIn 220ms ease;
      position: relative;
      z-index: 2;
    }

    #${TRACKER_ROOT_ID} .clu-row {
      display: grid;
      grid-template-columns: auto 1fr auto;
      gap: 8px;
      align-items: center;
      margin-bottom: 6px;
      color: #dbe7ff;
      font-size: 12px;
      line-height: 1;
    }

    #${TRACKER_ROOT_ID} .clu-row:last-of-type {
      margin-bottom: 3px;
    }

    #${TRACKER_ROOT_ID} .clu-label {
      font-weight: 700;
      min-width: 30px;
      color: #9bb7ff;
      text-transform: uppercase;
      letter-spacing: 0.35px;
      font-size: 10px;
    }

    #${TRACKER_ROOT_ID} .clu-track {
      width: 100%;
      height: 7px;
      border-radius: 999px;
      border: 1px solid rgba(255, 255, 255, 0.1);
      background: rgba(4, 8, 16, 0.9);
      overflow: hidden;
      position: relative;
    }

    #${TRACKER_ROOT_ID} .clu-fill {
      width: 0;
      height: 100%;
      border-radius: 999px;
      transition: width 420ms cubic-bezier(0.2, 0.8, 0.2, 1);
      background: linear-gradient(90deg, #7ea7ff, #5a7cff);
      box-shadow: 0 0 12px rgba(90, 124, 255, 0.45);
    }

    #${TRACKER_ROOT_ID} .clu-fill.warning {
      background: linear-gradient(90deg, #f6c47f, #e29f4b);
      box-shadow: 0 0 12px rgba(246, 196, 127, 0.42);
    }

    #${TRACKER_ROOT_ID} .clu-fill.critical {
      background: linear-gradient(90deg, #ff9ea6, #ef5f7e);
      box-shadow: 0 0 12px rgba(239, 95, 126, 0.45);
    }

    #${TRACKER_ROOT_ID} .clu-meta {
      display: inline-flex;
      gap: 7px;
      align-items: center;
      color: #adbcdf;
      font-size: 11px;
      white-space: nowrap;
    }

    #${TRACKER_ROOT_ID} .clu-dot {
      width: 4px;
      height: 4px;
      border-radius: 50%;
      background: rgba(173, 188, 223, 0.8);
    }

    #${TRACKER_ROOT_ID} .clu-status {
      font-size: 10px;
      color: #7f93c2;
      min-height: 12px;
      margin-top: 1px;
    }

    @keyframes cluFadeIn {
      from { opacity: 0; transform: translateY(3px); }
      to { opacity: 1; transform: translateY(0); }
    }
  `;

  document.head.appendChild(style);
}

function buildRow(prefix, labelText) {
  const row = document.createElement('div');
  row.className = 'clu-row';

  const label = document.createElement('span');
  label.className = 'clu-label';
  label.textContent = labelText;

  const track = document.createElement('div');
  track.className = 'clu-track';

  const fill = document.createElement('div');
  fill.className = 'clu-fill';
  fill.id = `${prefix}-fill`;

  track.appendChild(fill);

  const meta = document.createElement('span');
  meta.className = 'clu-meta';
  meta.id = `${prefix}-meta`;
  meta.textContent = '--%';

  row.append(label, track, meta);
  return row;
}

function createTrackerRoot() {
  const root = document.createElement('div');
  root.id = TRACKER_ROOT_ID;
  root.dataset.cluMounted = '1';

  root.appendChild(buildRow('clu-five-hour', '5H'));
  root.appendChild(buildRow('clu-seven-day', '7D'));

  const status = document.createElement('div');
  status.className = 'clu-status';
  status.id = 'clu-inline-status';
  status.textContent = 'Finding composer...';
  root.appendChild(status);

  return root;
}

function getTrackerRoot() {
  return document.getElementById(TRACKER_ROOT_ID);
}

function setInlineStatus(text) {
  const status = document.getElementById('clu-inline-status');
  if (status) {
    status.textContent = text;
  }
}

function ensureTrackerMounted() {
  injectInlineStyles();

  const host = chooseBestComposerHost();
  if (!host) {
    log('host-missing');
    return null;
  }

  let root = getTrackerRoot();
  if (!root) {
    root = createTrackerRoot();
  }

  if (!host.contains(root)) {
    host.appendChild(root);
    log('host-found', host);
  }

  return root;
}

function getSeverityClass(percentage) {
  if (percentage >= 90) {
    return 'critical';
  }
  if (percentage >= 70) {
    return 'warning';
  }
  return '';
}

function formatCountdown(isoDate) {
  if (!isoDate) {
    return 'reset: --';
  }

  const resetTime = new Date(isoDate).getTime();
  if (Number.isNaN(resetTime)) {
    return 'reset: --';
  }

  const remainingMs = resetTime - Date.now();
  if (remainingMs <= 0) {
    return 'reset: now';
  }

  const totalMinutes = Math.floor(remainingMs / 60000);
  const days = Math.floor(totalMinutes / (24 * 60));
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) {
    return `reset in ${days}d ${hours}h`;
  }
  if (hours > 0) {
    return `reset in ${hours}h ${minutes}m`;
  }
  return `reset in ${minutes}m`;
}

function setRowState(prefix, quotaObj) {
  const fill = document.getElementById(`${prefix}-fill`);
  const meta = document.getElementById(`${prefix}-meta`);
  if (!fill || !meta) {
    return;
  }

  if (!quotaObj) {
    fill.style.width = '0%';
    fill.className = 'clu-fill';
    meta.textContent = '--%';
    return;
  }

  const percentage = Math.max(0, Math.min(100, Number(quotaObj.utilization) || 0));
  fill.style.width = `${percentage}%`;
  fill.className = `clu-fill ${getSeverityClass(percentage)}`.trim();

  const pctText = `${Math.round(percentage)}%`;
  const countdown = formatCountdown(quotaObj.resetsAtISO);

  meta.textContent = '';
  const pctNode = document.createElement('span');
  pctNode.textContent = pctText;
  const dot = document.createElement('span');
  dot.className = 'clu-dot';
  const resetNode = document.createElement('span');
  resetNode.textContent = countdown;
  meta.append(pctNode, dot, resetNode);
}

function requestUsageData() {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ action: 'getUsageData' }, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }

      if (!response || !response.success) {
        reject(new Error(response?.error || 'Unable to fetch usage data'));
        return;
      }

      resolve(response.data);
    });
  });
}

async function updateInlineTracker() {
  const root = ensureTrackerMounted();
  if (!root) {
    return;
  }

  setInlineStatus('Composer found, syncing quota...');

  try {
    const data = await requestUsageData();
    setRowState('clu-five-hour', data.fiveHour);
    setRowState('clu-seven-day', data.sevenDay);

    if (data.stale) {
      setInlineStatus('Using cached quota data');
    } else {
      const timeText = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setInlineStatus(`Quota synced ${timeText}`);
    }

    log('data-ok');
  } catch (error) {
    setInlineStatus('No quota data yet');
    log('data-error', error.message);
  }
}

function scheduleMountAndUpdate() {
  if (mountThrottleTimer) {
    return;
  }

  mountThrottleTimer = window.setTimeout(() => {
    mountThrottleTimer = null;
    updateInlineTracker();
  }, MOUNT_THROTTLE_MS);
}

function startRefreshLoop() {
  if (refreshTimer) {
    window.clearInterval(refreshTimer);
  }

  updateInlineTracker();
  refreshTimer = window.setInterval(updateInlineTracker, REFRESH_INTERVAL_MS);
}

function startMutationObserver() {
  if (mutationObserver) {
    mutationObserver.disconnect();
  }

  mutationObserver = new MutationObserver(() => {
    scheduleMountAndUpdate();
  });

  mutationObserver.observe(document.body, {
    childList: true,
    subtree: true
  });
}

function handleRouteOrViewChange() {
  if (window.location.href !== locationHref) {
    locationHref = window.location.href;
    log('route-change', locationHref);
    scheduleMountAndUpdate();
  }
}

function patchHistoryForSpaNavigation() {
  const originalPushState = history.pushState;
  const originalReplaceState = history.replaceState;

  history.pushState = function pushStatePatched(...args) {
    const result = originalPushState.apply(this, args);
    window.dispatchEvent(new Event('clu:locationchange'));
    return result;
  };

  history.replaceState = function replaceStatePatched(...args) {
    const result = originalReplaceState.apply(this, args);
    window.dispatchEvent(new Event('clu:locationchange'));
    return result;
  };
}

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request.action === 'getOrgId') {
    const orgId = getOrgIdFromLocalStorage() || getOrgIdFromWindowState();
    if (orgId) {
      sendOrgIdToBackground(orgId);
    }
    sendResponse({ orgId });
    return false;
  }

  if (request.action === 'refreshInlineTracker') {
    updateInlineTracker().then(() => sendResponse({ success: true }));
    return true;
  }

  return false;
});

function init() {
  log('content-script-loaded');
  extractAndSendOrgId();
  patchHistoryForSpaNavigation();
  startRefreshLoop();
  startMutationObserver();

  window.addEventListener('clu:locationchange', handleRouteOrViewChange);
  window.addEventListener('popstate', handleRouteOrViewChange);

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      scheduleMountAndUpdate();
    }
  });
}

if (document.readyState === 'complete' || document.readyState === 'interactive') {
  init();
} else {
  window.addEventListener('load', init, { once: true });
}
