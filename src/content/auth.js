import { log } from '../utils/logger.js';
import { normalizeOrgId } from '../utils/orgId.js';

let orgIdExtractionAttempts = 0;
const MAX_ORG_ID_EXTRACTION_ATTEMPTS = 10;

export function getOrgIdFromLocalStorage() {
  try {
    const lastActiveOrg = localStorage.getItem("lastActiveOrg");
    if (lastActiveOrg) return normalizeOrgId(lastActiveOrg);
  } catch (error) { log("localStorage read failed", error); }
  return null;
}

export function getOrgIdFromWindowState() {
  try {
    const state = window.__INITIAL_STATE__;
    if (state && state.orgId) return normalizeOrgId(state.orgId);
  } catch (error) { log("window state read failed", error); }
  return null;
}

export function sendOrgIdToBackground(orgId) {
  if (!orgId) return;
  chrome.runtime.sendMessage({ action: "setOrgId", orgId }, () => {
    if (chrome.runtime.lastError) log("setOrgId failed", chrome.runtime.lastError.message);
  });
}

export function extractAndSendOrgId() {
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
