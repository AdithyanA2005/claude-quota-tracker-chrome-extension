# Quick Start Implementation Guide

This guide provides step-by-step instructions to implement Claude quota extraction in your extension.

## Prerequisites

- Chrome Extension Manifest V3
- Understanding of service workers and content scripts
- Basic knowledge of fetch API and async/await

## Quick Implementation (Minimal Version)

### 1. Create manifest.json

```json
{
    "manifest_version": 3,
    "name": "Claude Usage Tracker",
    "version": "1.0.0",
    "description": "Track your Claude.ai usage quota",
    "permissions": ["storage", "tabs"],
    "host_permissions": ["*://claude.ai/*"],
    "background": {
        "service_worker": "background.js",
        "type": "module"
    },
    "content_scripts": [
        {
            "matches": ["https://claude.ai/*"],
            "js": ["content.js"]
        }
    ],
    "action": {
        "default_popup": "popup.html",
        "default_title": "Claude Usage Tracker"
    }
}
```

### 2. Create background.js

```javascript
// Background Service Worker
const API_BASE = 'https://claude.ai/api';

class ClaudeAPI {
    constructor(orgId) {
        this.orgId = orgId;
    }

    async getRequest(endpoint) {
        const response = await fetch(`${API_BASE}${endpoint}`, {
            headers: { 'Content-Type': 'application/json' },
            method: 'GET',
            credentials: 'include'
        });
        if (!response.ok) throw new Error(`API error: ${response.status}`);
        return response.json();
    }

    async getUsageData() {
        try {
            const usageLimits = await this.getRequest(
                `/organizations/${this.orgId}/usage`
            );
            
            const subscriptionTier = await this.getSubscriptionTier();
            
            let credits = null;
            if (usageLimits.extra_usage?.is_enabled) {
                credits = await this.getRequest(
                    `/organizations/${this.orgId}/prepaid/credits`
                );
            }
            
            return this.parseUsageData(usageLimits, subscriptionTier, credits);
        } catch (error) {
            console.error('Failed to fetch usage data:', error);
            return null;
        }
    }

    async getSubscriptionTier() {
        try {
            const appStart = await this.getRequest(
                `/bootstrap/${this.orgId}/app_start?statsig_hashing_algorithm=djb2`
            );
            const org = appStart.account?.memberships?.[0]?.organization;
            
            if (org?.capabilities?.includes('claude_max')) {
                return 'claude_max_5x';
            } else if (org?.capabilities?.includes('claude_pro')) {
                return 'claude_pro';
            }
            return 'claude_free';
        } catch (error) {
            console.error('Failed to fetch subscription tier:', error);
            return 'claude_free';
        }
    }

    parseUsageData(apiResponse, tier, creditsResponse) {
        const parseLimit = (obj) => obj ? {
            percentage: obj.utilization,
            resetsAt: new Date(obj.resets_at).getTime()
        } : null;

        return {
            limits: {
                session: parseLimit(apiResponse.five_hour),
                weekly: parseLimit(apiResponse.seven_day),
                sonnetWeekly: parseLimit(apiResponse.seven_day_sonnet),
                opusWeekly: parseLimit(apiResponse.seven_day_opus)
            },
            subscriptionTier: tier,
            extraUsage: apiResponse.extra_usage?.is_enabled ? {
                isEnabled: true,
                monthlyLimit: apiResponse.extra_usage.monthly_limit,
                usedCredits: apiResponse.extra_usage.used_credits || 0
            } : null,
            creditBalance: creditsResponse?.amount ?? null
        };
    }
}

// Message handler
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'getUsageData') {
        handleGetUsageData(message.orgId, sendResponse);
    }
});

async function handleGetUsageData(orgId, sendResponse) {
    const api = new ClaudeAPI(orgId);
    const data = await api.getUsageData();
    
    if (data) {
        await chrome.storage.local.set({ usageData: data });
    }
    
    sendResponse({ data });
}

// Poll for usage data every 5 minutes
chrome.alarms.create('pollUsageData', { periodInMinutes: 5 });

chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name === 'pollUsageData') {
        const stored = await chrome.storage.local.get('orgId');
        if (stored.orgId) {
            handleGetUsageData(stored.orgId, () => {});
        }
    }
});
```

### 3. Create content.js

```javascript
// Content Script - runs on claude.ai
async function extractOrgId() {
    // Method 1: Try to get from cookie
    try {
        const cookies = document.cookie.split(';');
        for (const cookie of cookies) {
            const [name, value] = cookie.trim().split('=');
            if (name === 'lastActiveOrg') {
                return value;
            }
        }
    } catch (error) {
        console.error('Failed to parse cookies:', error);
    }

    // Method 2: Try to find in DOM (Claude.ai stores org ID in various places)
    const orgIdMatch = document.body.innerText.match(/org[_-]?id[:\s=]+([a-f0-9-]+)/i);
    if (orgIdMatch) return orgIdMatch[1];

    return null;
}

async function initializeExtension() {
    const orgId = await extractOrgId();
    
    if (orgId) {
        // Store org ID
        await chrome.storage.local.set({ orgId });
        
        // Request initial data
        chrome.runtime.sendMessage(
            { action: 'getUsageData', orgId },
            (response) => {
                if (response?.data) {
                    displayUsageUI(response.data);
                }
            }
        );
    }
}

function displayUsageUI(usageData) {
    // Create container
    let container = document.getElementById('usage-tracker');
    if (!container) {
        container = document.createElement('div');
        container.id = 'usage-tracker';
        container.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: white;
            border: 1px solid #ccc;
            border-radius: 8px;
            padding: 12px;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            font-size: 12px;
            z-index: 10000;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        `;
        document.body.appendChild(container);
    }

    // Clear previous content
    container.innerHTML = '<strong>Claude Usage</strong><br>';

    // Display limits
    const { limits, subscriptionTier } = usageData;
    
    for (const [key, limit] of Object.entries(limits)) {
        if (!limit) continue;
        
        const percentage = limit.percentage;
        const resetTime = new Date(limit.resetsAt).toLocaleString();
        const color = percentage >= 90 ? '#ff4444' : '#4444ff';
        
        const bar = document.createElement('div');
        bar.style.cssText = `
            margin: 8px 0;
            font-size: 11px;
        `;
        
        bar.innerHTML = `
            <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
                <span>${key}:</span>
                <span>${percentage.toFixed(1)}%</span>
            </div>
            <div style="background: #eee; height: 6px; border-radius: 3px; overflow: hidden;">
                <div style="
                    background: ${color};
                    height: 100%;
                    width: ${Math.min(percentage, 100)}%;
                    transition: width 0.3s;
                "></div>
            </div>
            <div style="font-size: 10px; color: #666; margin-top: 2px;">
                Resets: ${resetTime}
            </div>
        `;
        
        container.appendChild(bar);
    }

    // Display subscription tier
    const tierInfo = document.createElement('div');
    tierInfo.style.cssText = 'margin-top: 8px; padding-top: 8px; border-top: 1px solid #eee; font-size: 10px; color: #666;';
    tierInfo.textContent = `Tier: ${subscriptionTier}`;
    container.appendChild(tierInfo);
}

// Listen for updates from background
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'updateUsage' && message.data) {
        displayUsageUI(message.data);
    }
});

// Initialize on page load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeExtension);
} else {
    initializeExtension();
}
```

### 4. Create popup.html

```html
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body {
            width: 300px;
            padding: 16px;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            font-size: 14px;
        }
        h2 {
            margin-top: 0;
            font-size: 16px;
        }
        .limit-item {
            margin: 12px 0;
            padding: 8px;
            background: #f5f5f5;
            border-radius: 4px;
        }
        .percentage {
            font-weight: bold;
            color: #333;
        }
        .reset-time {
            font-size: 12px;
            color: #666;
            margin-top: 4px;
        }
        .error {
            color: #d32f2f;
            padding: 8px;
            background: #ffebee;
            border-radius: 4px;
        }
    </style>
</head>
<body>
    <h2>Claude Usage</h2>
    <div id="usage-display">Loading...</div>
</body>
<script src="popup.js"></script>
</html>
```

### 5. Create popup.js

```javascript
// Popup script
async function loadUsageData() {
    const stored = await chrome.storage.local.get(['usageData', 'orgId']);
    const display = document.getElementById('usage-display');

    if (!stored.usageData) {
        display.innerHTML = '<div class="error">No usage data available. Make sure you\'re logged into claude.ai.</div>';
        return;
    }

    const { limits, subscriptionTier } = stored.usageData;
    let html = `<div class="subscription">Tier: <strong>${subscriptionTier}</strong></div>`;

    for (const [key, limit] of Object.entries(limits)) {
        if (!limit) continue;
        
        const resetDate = new Date(limit.resetsAt);
        html += `
            <div class="limit-item">
                <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                    <span>${key}</span>
                    <span class="percentage">${limit.percentage.toFixed(1)}%</span>
                </div>
                <div style="background: #ddd; height: 4px; border-radius: 2px; overflow: hidden;">
                    <div style="
                        background: ${limit.percentage >= 90 ? '#ff4444' : '#4444ff'};
                        height: 100%;
                        width: ${Math.min(limit.percentage, 100)}%;
                    "></div>
                </div>
                <div class="reset-time">Resets: ${resetDate.toLocaleString()}</div>
            </div>
        `;
    }

    display.innerHTML = html;
}

// Refresh button (optional)
document.addEventListener('DOMContentLoaded', loadUsageData);
```

## Running Your Extension

1. Save all files to a directory (e.g., `claude-tracker/`)
2. Open `chrome://extensions/`
3. Enable "Developer mode"
4. Click "Load unpacked"
5. Select your directory

## Testing

1. Open https://claude.ai in a tab
2. Check the extension icon in the toolbar
3. You should see usage data displayed

## Next Steps

- Add error handling for API failures
- Implement retry logic for rate limiting
- Add storage of historical data
- Create a full dashboard view
- Add notifications when limits are reached

## Troubleshooting

**No data showing?**
- Check that you're logged into claude.ai
- Check browser console for errors
- Verify Chrome DevTools → Application → Storage for stored data

**Getting 429 errors?**
- You're being rate limited
- Implement exponential backoff in `getRequest()`
- Reduce polling frequency

**Org ID not found?**
- The cookie extraction might not work for all users
- Try logging out and back in
- Check browser cookies manually
