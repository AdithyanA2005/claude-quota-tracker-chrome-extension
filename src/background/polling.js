import { getUsageData } from './cache.js';

export function startPolling() {
  chrome.alarms.create('updateUsageData', { periodInMinutes: 5 });
}

export function setupAlarms() {
  chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name === 'updateUsageData') {
      try {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tabs.length > 0 && tabs[0].url && tabs[0].url.includes('claude.ai')) {
          console.log('Active Claude tab detected. Polling for usage data update...');
          await getUsageData(true);
        } else {
          console.log('Skipping background poll: Claude is not the active tab.');
        }
      } catch (error) {
        console.error('Polling error:', error);
      }
    }
  });
}
