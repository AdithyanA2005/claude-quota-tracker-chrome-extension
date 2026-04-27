import { getUsageData } from './cache.js';

export function startPolling() {
  chrome.alarms.create('updateUsageData', { periodInMinutes: 5 });
}

export function setupAlarms() {
  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'updateUsageData') {
      console.log('Polling for usage data update...');
      getUsageData(true).catch(error => {
        console.error('Polling error:', error);
      });
    }
  });
}
