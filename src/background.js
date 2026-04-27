import { normalizeOrgId } from './utils/orgId.js';
import { getUsageData } from './background/cache.js';
import { startPolling, setupAlarms } from './background/polling.js';

setupAlarms();

chrome.runtime.onInstalled.addListener(() => {
  console.log('Claude Usage Tracker installed');
  startPolling();
});

chrome.runtime.onStartup.addListener(() => {
  startPolling();
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getUsageData') {
    getUsageData().then(data => sendResponse({ success: true, data })).catch(error => sendResponse({ success: false, error: error.message }));
    return true; 
  }
  if (request.action === 'setOrgId') {
    const orgId = normalizeOrgId(request.orgId);
    chrome.storage.local.set({ orgId }, () => {
      console.log('Organization ID set:', orgId);
      sendResponse({ success: true });
    });
    return true;
  }
  if (request.action === 'refreshUsageData') {
    getUsageData(true).then(data => sendResponse({ success: true, data })).catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
});

chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    if (tab.url && tab.url.includes('claude.ai')) {
      chrome.tabs.sendMessage(activeInfo.tabId, { action: 'getOrgId' }).catch(() => {});
    }
  } catch (error) {
    console.error('Error on tab activation:', error);
  }
});

console.log('Claude Usage Tracker background service worker loaded');
