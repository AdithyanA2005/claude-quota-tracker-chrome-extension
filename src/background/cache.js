import { getOrgId, fetchUsageFromAPI, getSubscriptionTier } from './api.js';
import { formatResetTime } from '../utils/formatting.js';

const CACHE_DURATION = 2 * 60 * 1000;

export async function getUsageData(forceRefresh = false) {
  try {
    const orgId = await getOrgId();
    if (!orgId) throw new Error('Organization ID not found. Please visit claude.ai first.');
    const cached = await chrome.storage.local.get(['usageCache', 'usageCacheTime']);
    const now = Date.now();
    if (!forceRefresh && cached.usageCache && cached.usageCacheTime) {
      if (now - cached.usageCacheTime < CACHE_DURATION) {
        console.log('Using cached usage data');
        return cached.usageCache;
      }
    }
    console.log('Fetching fresh usage data...');
    const [usageData, tier] = await Promise.all([ fetchUsageFromAPI(orgId), getSubscriptionTier(orgId) ]);
    const formatted = {
      subscriptionTier: tier,
      fiveHour: usageData.five_hour ? { utilization: usageData.five_hour.utilization, resetsAt: formatResetTime(usageData.five_hour.resets_at), resetsAtISO: usageData.five_hour.resets_at } : null,
      sevenDay: usageData.seven_day ? { utilization: usageData.seven_day.utilization, resetsAt: formatResetTime(usageData.seven_day.resets_at), resetsAtISO: usageData.seven_day.resets_at } : null,
      sonnetWeekly: usageData.seven_day_sonnet ? { utilization: usageData.seven_day_sonnet.utilization, resetsAt: formatResetTime(usageData.seven_day_sonnet.resets_at), resetsAtISO: usageData.seven_day_sonnet.resets_at } : null,
      opusWeekly: usageData.seven_day_opus ? { utilization: usageData.seven_day_opus.utilization, resetsAt: formatResetTime(usageData.seven_day_opus.resets_at), resetsAtISO: usageData.seven_day_opus.resets_at } : null,
      lastUpdated: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
      lastUpdatedTime: now
    };
    await chrome.storage.local.set({ usageCache: formatted, usageCacheTime: now });
    console.log('Usage data fetched and cached:', formatted);
    return formatted;
  } catch (error) {
    console.error('Error fetching usage data:', error);
    const cached = await chrome.storage.local.get('usageCache');
    if (cached.usageCache) {
      return { ...cached.usageCache, error: error.message, stale: true };
    }
    throw error;
  }
}
