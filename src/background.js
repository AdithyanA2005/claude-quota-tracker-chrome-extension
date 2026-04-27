// Claude Usage Tracker - Background Service Worker
// Handles API calls, polling, and data management

const POLLING_INTERVAL = 5 * 60 * 1000; // 5 minutes
const CACHE_DURATION = 2 * 60 * 1000; // 2 minutes
const API_BASE = 'https://claude.ai/api';
const CLAUDE_ORIGIN = 'https://claude.ai';

// Initialize extension on install/update
chrome.runtime.onInstalled.addListener(() => {
  console.log('Claude Usage Tracker installed');
  // Start polling
  startPolling();
});

chrome.runtime.onStartup.addListener(() => {
  startPolling();
});

// Listen for messages from popup and content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getUsageData') {
    getUsageData().then(data => {
      sendResponse({ success: true, data });
    }).catch(error => {
      sendResponse({ success: false, error: error.message });
    });
    return true; // Will respond asynchronously
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
    getUsageData(true).then(data => {
      sendResponse({ success: true, data });
    }).catch(error => {
      sendResponse({ success: false, error: error.message });
    });
    return true;
  }
});

/**
 * Get organization ID from storage or return null
 */
async function getOrgId() {
  const result = await chrome.storage.local.get('orgId');
  if (result.orgId) {
    return normalizeOrgId(result.orgId);
  }

  const cookieOrgId = await getOrgIdFromCookie();
  if (cookieOrgId) {
    await chrome.storage.local.set({ orgId: cookieOrgId });
    return cookieOrgId;
  }

  return null;
}

/**
 * Normalize values read from cookies/storage into a bare organization UUID.
 */
function normalizeOrgId(value) {
  if (!value) {
    return null;
  }

  let normalized = String(value).trim();

  try {
    normalized = decodeURIComponent(normalized);
  } catch (_error) {
    // Keep the original value if it is not URL encoded.
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

/**
 * Read Claude's active organization ID from its cookie. This handles HttpOnly
 * cookies that content scripts cannot read.
 */
async function getOrgIdFromCookie() {
  try {
    const cookie = await chrome.cookies.get({
      url: CLAUDE_ORIGIN,
      name: 'lastActiveOrg'
    });

    return normalizeOrgId(cookie?.value);
  } catch (error) {
    console.error('Unable to read lastActiveOrg cookie:', error);
    return null;
  }
}

/**
 * Fetch usage data from Claude API
 */
async function fetchUsageFromAPI(orgId) {
  const url = `${API_BASE}/organizations/${orgId}/usage`;
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json'
    },
    credentials: 'include' // Include cookies for authentication
  });
  
  if (!response.ok) {
    throw new Error(`API Error: ${response.status} ${response.statusText}`);
  }
  
  return await response.json();
}

/**
 * Get subscription tier from bootstrap endpoint
 */
async function getSubscriptionTier(orgId) {
  try {
    const url = `${API_BASE}/bootstrap/${orgId}/app_start?statsig_hashing_algorithm=djb2`;
    
    const response = await fetch(url, {
      method: 'GET',
      credentials: 'include'
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch subscription tier');
    }
    
    const data = await response.json();
    
    // Extract subscription information
    const org = data.account?.memberships?.[0]?.organization;
    if (!org) {
      return 'unknown';
    }
    
    // Detect subscription tier
    if (org.raven_type) {
      return 'Claude Team';
    } else if (org.capabilities?.includes('claude_max')) {
      const tier = org.rate_limit_tier || '';
      if (tier.includes('20x')) {
        return 'Claude Max (20x)';
      } else if (tier.includes('5x')) {
        return 'Claude Max (5x)';
      }
      return 'Claude Max';
    } else if (org.capabilities?.includes('claude_pro')) {
      return 'Claude Pro';
    }
    
    return 'Claude Free';
  } catch (error) {
    console.error('Error fetching subscription tier:', error);
    return 'unknown';
  }
}

/**
 * Format timestamp to readable reset time
 */
function formatResetTime(isoTimestamp) {
  try {
    const date = new Date(isoTimestamp);
    const now = new Date();
    
    // Check if reset is today
    if (date.toDateString() === now.toDateString()) {
      return `Today ${date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}`;
    }
    
    // Check if reset is tomorrow
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    if (date.toDateString() === tomorrow.toDateString()) {
      return `Tomorrow ${date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}`;
    }
    
    // Otherwise show day and time
    return date.toLocaleDateString('en-US', { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  } catch (error) {
    return 'Unknown';
  }
}

/**
 * Get usage data - main function
 */
async function getUsageData(forceRefresh = false) {
  try {
    const orgId = await getOrgId();
    
    if (!orgId) {
      throw new Error('Organization ID not found. Please visit claude.ai first.');
    }
    
    // Check cache
    const cached = await chrome.storage.local.get(['usageCache', 'usageCacheTime']);
    const now = Date.now();
    
    if (!forceRefresh && cached.usageCache && cached.usageCacheTime) {
      if (now - cached.usageCacheTime < CACHE_DURATION) {
        console.log('Using cached usage data');
        return cached.usageCache;
      }
    }
    
    // Fetch fresh data
    console.log('Fetching fresh usage data...');
    const [usageData, tier] = await Promise.all([
      fetchUsageFromAPI(orgId),
      getSubscriptionTier(orgId)
    ]);
    
    // Format the response
    const formatted = {
      subscriptionTier: tier,
      fiveHour: usageData.five_hour ? {
        utilization: usageData.five_hour.utilization,
        resetsAt: formatResetTime(usageData.five_hour.resets_at),
        resetsAtISO: usageData.five_hour.resets_at
      } : null,
      sevenDay: usageData.seven_day ? {
        utilization: usageData.seven_day.utilization,
        resetsAt: formatResetTime(usageData.seven_day.resets_at),
        resetsAtISO: usageData.seven_day.resets_at
      } : null,
      sonnetWeekly: usageData.seven_day_sonnet ? {
        utilization: usageData.seven_day_sonnet.utilization,
        resetsAt: formatResetTime(usageData.seven_day_sonnet.resets_at),
        resetsAtISO: usageData.seven_day_sonnet.resets_at
      } : null,
      opusWeekly: usageData.seven_day_opus ? {
        utilization: usageData.seven_day_opus.utilization,
        resetsAt: formatResetTime(usageData.seven_day_opus.resets_at),
        resetsAtISO: usageData.seven_day_opus.resets_at
      } : null,
      lastUpdated: new Date().toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: true 
      }),
      lastUpdatedTime: now
    };
    
    // Cache the result
    await chrome.storage.local.set({
      usageCache: formatted,
      usageCacheTime: now
    });
    
    console.log('Usage data fetched and cached:', formatted);
    return formatted;
  } catch (error) {
    console.error('Error fetching usage data:', error);
    
    // Return cached data if available, even if expired
    const cached = await chrome.storage.local.get('usageCache');
    if (cached.usageCache) {
      return {
        ...cached.usageCache,
        error: error.message,
        stale: true
      };
    }
    
    throw error;
  }
}

/**
 * Start periodic polling
 */
function startPolling() {
  // Poll every 5 minutes
  chrome.alarms.create('updateUsageData', { periodInMinutes: 5 });
}

// Handle alarm for polling
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'updateUsageData') {
    console.log('Polling for usage data update...');
    getUsageData(true).catch(error => {
      console.error('Polling error:', error);
    });
  }
});

// When a tab is activated, try to get org ID from that tab if it's Claude.ai
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    if (tab.url && tab.url.includes('claude.ai')) {
      // Send message to content script to extract org ID
      chrome.tabs.sendMessage(activeInfo.tabId, { action: 'getOrgId' }).catch(() => {
        // Tab might not have content script loaded yet
      });
    }
  } catch (error) {
    console.error('Error on tab activation:', error);
  }
});

console.log('Claude Usage Tracker background service worker loaded');
