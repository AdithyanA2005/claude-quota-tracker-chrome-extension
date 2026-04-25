# Technical Research: Extracting Claude Usage Quota Data for Chrome Extensions

## Executive Summary

Based on an in-depth analysis of the `lugia19/Claude-Usage-Extension` repository (a production-grade, open-source implementation), I've identified the complete technical approach for extracting Claude usage quota information from Claude.ai for Chrome extensions. The extension successfully uses Claude's internal API to retrieve quota data, and this document details the exact methods and data structures involved.

---

## 1. WHERE/HOW CLAUDE.AI DISPLAYS QUOTA INFORMATION IN THE UI

### Claude.ai UI Architecture
Claude.ai does **not display explicit quota information in the main UI** to free users. However:

- **Pro/Max users**: May see billing information on the settings/billing page
- **Session tracking**: Users only see implicit usage through:
  - Response generation stopping when limits hit
  - HTTP 429 rate-limit responses
  - Error messages when quotas are exceeded

### Content Script Integration Points
The Claude Usage Tracker extension injects UI elements into the chat interface:

1. **Usage tracker sidebar** - Displays real-time usage percentages
2. **Conversation metrics** - Shows token counts per message
3. **Reset time countdowns** - Displays when quotas reset

This means the extension creates its own UI layer on top of Claude.ai, extracting data from Claude's APIs and displaying it in a user-friendly format.

---

## 2. API ENDPOINTS & AUTHENTICATION

### Core Usage Endpoints

**Primary endpoint for quota data:**
```
GET /api/organizations/{orgId}/usage
```

**Response format (parsed from code):**
```json
{
  "five_hour": {
    "utilization": 45.2,
    "resets_at": "2024-04-25T17:00:00Z"
  },
  "seven_day": {
    "utilization": 62.8,
    "resets_at": "2024-05-02T00:00:00Z"
  },
  "seven_day_sonnet": {
    "utilization": 20.1,
    "resets_at": "2024-05-02T00:00:00Z"
  },
  "seven_day_opus": {
    "utilization": 50.5,
    "resets_at": "2024-05-02T00:00:00Z"
  },
  "extra_usage": {
    "is_enabled": true,
    "monthly_limit": 10000,
    "used_credits": 2500
  }
}
```

### Additional Related Endpoints

| Endpoint | Method | Purpose | Response |
|----------|--------|---------|----------|
| `/api/organizations/{orgId}/prepaid/credits` | GET | Fetch credit balance | `{ "amount": 500 }` (in cents) |
| `/api/bootstrap/{orgId}/app_start` | GET | Get subscription tier & org info | Complex object with capabilities |
| `/api/organizations/{orgId}/chat_conversations/{convId}` | GET | Get conversation data for token counting | Full conversation tree |
| `/api/organizations/{orgId}/memory` | GET | Get memory/context data | Memory content |
| `/api/settings/billing` | GET | Trigger subscription tier refresh | Billing info |

### Request Interception Points

The extension intercepts these request URLs via `webRequest.onBeforeRequest` and `webRequest.onCompleted` listeners:

```javascript
// Key interception patterns from manifest:
"*://claude.ai/api/organizations/*/completion"
"*://claude.ai/api/organizations/*/retry_completion"
"*://claude.ai/api/settings/billing*"
"*://claude.ai/api/organizations/*/chat_conversations/*"
"*://claude.ai/v1/sessions/*/events"
```

---

## 3. AUTHENTICATION MECHANISM

### Cookie-Based Authentication

Claude.ai uses **standard HTTP cookie authentication** - no custom tokens required:

**Key Cookie:**
```
lastActiveOrg: {orgId}
```

This cookie is automatically sent with all authenticated requests.

### Authentication Flow in Extension

```javascript
// From background.js:
async requestActiveOrgId(tab) {
    if (chrome.cookies) {
        const cookie = await browser.cookies.get({
            name: 'lastActiveOrg',
            url: tab.url,
            storeId: tab.cookieStoreId
        });
        if (cookie?.value) return cookie.value;
    }
    
    // Fallback: request from content script
    const response = await sendTabMessage(tab.id, { action: "getOrgID" });
    return response?.orgId;
}
```

### Container/Multi-Account Support

The extension uses **cookie store IDs** for Firefox container support:

```javascript
const api = new ClaudeAPI(cookieStoreId, orgId);

// In utils.js - containerFetch function:
async function containerFetch(url, options = {}, cookieStoreId = null) {
    if (!cookieStoreId || cookieStoreId === "0" || isElectron) {
        return fetch(url, options);
    }
    const headers = options.headers || {};
    headers['X-Container'] = cookieStoreId;  // Multi-container support
    options.headers = headers;
    return fetch(url, options);
}
```

---

## 4. DATA STRUCTURES & JSON FORMAT

### UsageData Class (Complete Structure)

From `shared/dataclasses.js`:

```javascript
class UsageData {
    limits: {
        session: {
            percentage: number,      // 0-100
            resetsAt: number         // Unix milliseconds
        } | null,
        weekly: { percentage, resetsAt } | null,
        sonnetWeekly: { percentage, resetsAt } | null,
        opusWeekly: { percentage, resetsAt } | null
    },
    subscriptionTier: string,        // "claude_free" | "claude_pro" | "claude_max_5x" | "claude_max_20x" | "claude_team"
    extraUsage: {
        isEnabled: boolean,
        monthlyLimit: number,        // cents
        usedCredits: number          // cents
    } | null,
    creditBalance: number | null     // cents
}
```

### Parsing API Response to UsageData

```javascript
static fromAPIResponse(apiResponse, subscriptionTier, creditsResponse = null) {
    const parseLimit = (obj) => obj ? {
        percentage: obj.utilization,
        resetsAt: new Date(obj.resets_at).getTime()
    } : null;

    return new UsageData({
        limits: {
            session: parseLimit(apiResponse.five_hour),
            weekly: parseLimit(apiResponse.seven_day),
            sonnetWeekly: parseLimit(apiResponse.seven_day_sonnet),
            opusWeekly: parseLimit(apiResponse.seven_day_opus)
        },
        subscriptionTier,
        extraUsage: apiResponse.extra_usage?.is_enabled ? {
            isEnabled: true,
            monthlyLimit: apiResponse.extra_usage.monthly_limit,
            usedCredits: apiResponse.extra_usage.used_credits || 0
        } : null,
        creditBalance: creditsResponse?.amount ?? null
    });
}
```

### Subscription Tier Detection

```javascript
async getSubscriptionTier(skipCache = false) {
    const appStartData = await this.getRequest(`/bootstrap/${this.orgId}/app_start?statsig_hashing_algorithm=djb2`);
    const memberships = appStartData.account?.memberships || [];
    const org = memberships.find(m => m.organization.uuid === this.orgId)?.organization;
    
    const hasMaxCapability = org.capabilities.includes("claude_max");
    const hasProCapability = org.capabilities.includes("claude_pro");
    const hasRavenType = !!org.raven_type;  // Claude Team indicator
    const rateLimitTier = org?.rate_limit_tier;  // "default_claude_ai" | "default_claude_max_5x" | "default_claude_max_20x"
    
    // Determine tier from capabilities...
}
```

### Estimated Quota Caps Configuration

```javascript
const ESTIMATED_CAPS = {
    "claude_free": {
        "session": 375000  // 5-hour session limit
    },
    "claude_pro": {},  // Unknown, not documented
    "claude_team": {},  // Unknown
    "claude_max_5x": {
        "session": 7.5e6,
        "weekly": 75e6,
        "sonnetWeekly": 45e6
    },
    "claude_max_20x": {}
};
```

**Note**: These are estimates - the actual API returns percentages, not absolute values.

---

## 5. BEST METHOD FOR CHROME EXTENSION IMPLEMENTATION

### Recommended Architecture

```
┌─────────────────────────────────┐
│   Content Script (claude.ai)    │
│  - Intercepts org ID from DOM   │
│  - Injects tracking UI          │
│  - Sends messages to background │
└──────────────┬──────────────────┘
               │ chrome.runtime.sendMessage
               ▼
┌─────────────────────────────────┐
│   Background Service Worker     │
│  - Manages quota API calls      │
│  - Updates storage              │
│  - Schedules refresh alarms     │
│  - Stores usage history         │
└──────────────┬──────────────────┘
               │
               ▼
    ┌──────────────────────┐
    │  Claude.ai API       │
    │ /api/organizations/ │
    │      /usage         │
    └──────────────────────┘
```

### Implementation Strategy: 3 Approaches

#### **Approach 1: Web Request Interception (Recommended)**

**Advantages:**
- Automatic, passive data collection
- Works with existing Claude.ai requests
- No additional API calls needed
- Captures real usage data

**Implementation:**
```javascript
// In manifest.json
"permissions": ["webRequest", "tabs"],
"host_permissions": ["*://claude.ai/*"]

// In background.js
browser.webRequest.onCompleted.addListener(
    (details) => handleCompletedRequest(details),
    { 
        urls: ["*://claude.ai/api/organizations/*/usage"],
        types: ["xmlhttprequest"]
    },
    ["responseHeaders"]
);
```

**Limitations:** Cannot directly read response body in MV3

#### **Approach 2: Content Script Data Injection**

**Advantages:**
- Can read all response bodies
- Cleaner code structure
- Works reliably

**Implementation:**
```javascript
// Content script intercepts fetch/XHR
const originalFetch = window.fetch;
window.fetch = async (...args) => {
    const response = await originalFetch(...args);
    
    if (args[0].includes('/organizations/') && args[0].includes('/usage')) {
        const data = await response.clone().json();
        chrome.runtime.sendMessage({
            action: 'updateUsageData',
            data: data
        });
    }
    return response;
};
```

#### **Approach 3: Direct API Calls (Current Extension Method)**

**Advantages:**
- Complete control over request timing
- Can batch operations
- Can implement custom refresh intervals

**Implementation:**
```javascript
async getUsageData() {
    const usageLimitsResponse = await this.getRequest(
        `/organizations/${this.orgId}/usage`
    );
    const subscriptionTier = await this.getSubscriptionTier();
    let creditsResponse = null;
    
    if (usageLimitsResponse.extra_usage?.is_enabled) {
        creditsResponse = await this.getRequest(
            `/organizations/${this.orgId}/prepaid/credits`
        );
    }
    
    return UsageData.fromAPIResponse(
        usageLimitsResponse,
        subscriptionTier,
        creditsResponse
    );
}
```

### Manifest Configuration (MV3)

```json
{
    "manifest_version": 3,
    "permissions": [
        "storage",
        "tabs",
        "webRequest",
        "alarms"
    ],
    "host_permissions": [
        "*://claude.ai/*",
        "https://api.anthropic.com/*"
    ],
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

---

## 6. COMPLETE IMPLEMENTATION WORKFLOW

### Step 1: Initialization (Background Service Worker)

```javascript
// background.js
async function initializeExtension() {
    // Get org ID from first claude.ai tab
    const tabs = await browser.tabs.query({ url: "*://claude.ai/*" });
    if (tabs.length > 0) {
        const orgId = await requestActiveOrgId(tabs[0]);
        const api = new ClaudeAPI(tabs[0].cookieStoreId, orgId);
        const usageData = await api.getUsageData();
        
        // Store in extension storage
        await setStorageValue('usageData', usageData.toJSON());
        
        // Schedule periodic refresh (every 5 minutes)
        chrome.alarms.create('refreshUsageData', { periodInMinutes: 5 });
    }
}
```

### Step 2: Request Interception

```javascript
// Intercept message sends (API calls)
browser.webRequest.onBeforeRequest.addListener(
    async (details) => {
        if (details.url.includes('/completion') || 
            details.url.includes('/retry_completion')) {
            // Store pending request info
            const orgId = extractOrgIdFromUrl(details.url);
            const conversationId = extractConvIdFromUrl(details.url);
            
            // Capture pre-message usage snapshot
            const api = new ClaudeAPI(details.cookieStoreId, orgId);
            const previousUsage = await api.getUsageData();
            
            pendingRequests.set(`${orgId}:${conversationId}`, {
                orgId,
                conversationId,
                previousUsage: previousUsage.toJSON()
            });
        }
    },
    { urls: ["*://claude.ai/api/organizations/*/completion"] }
);

// Intercept completed requests
browser.webRequest.onCompleted.addListener(
    async (details) => {
        if (details.url.includes('/chat_conversations/') && 
            details.url.includes('tree=True')) {
            
            // Extract IDs from URL
            const orgId = extractOrgIdFromUrl(details.url);
            const conversationId = extractConvIdFromUrl(details.url);
            
            // Fetch updated usage data
            const api = new ClaudeAPI(details.cookieStoreId, orgId);
            const currentUsage = await api.getUsageData();
            
            // Calculate delta
            const delta = calculateUsageDelta(previousUsage, currentUsage);
            
            // Update UI across all tabs
            updateAllTabsWithUsage(currentUsage);
        }
    },
    { urls: ["*://claude.ai/api/organizations/*/chat_conversations/*"] }
);
```

### Step 3: UI Display (Content Script)

```javascript
// content.js
class UsageDisplay {
    async render(usageData) {
        const container = document.querySelector('#usage-tracker') || 
                         this.createContainer();
        
        for (const [limitKey, limit] of Object.entries(usageData.limits)) {
            if (!limit) continue;
            
            const percentage = limit.percentage;
            const resetTime = new Date(limit.resetsAt);
            
            // Create progress bar
            const bar = document.createElement('div');
            bar.className = 'usage-bar';
            bar.style.width = percentage + '%';
            bar.style.backgroundColor = percentage >= 90 ? 'red' : 'blue';
            
            // Add label
            const label = document.createElement('span');
            label.textContent = `${limitKey}: ${percentage.toFixed(0)}% (Resets: ${resetTime.toLocaleTimeString()})`;
            
            container.appendChild(label);
            container.appendChild(bar);
        }
    }
}
```

### Step 4: Storage & Caching

```javascript
// Use browser.storage.local for persistent data
await browser.storage.local.set({
    'usageData': usageData.toJSON(),
    'usageHistory': [
        {
            timestamp: Date.now(),
            usage: usageData.toJSON()
        }
    ],
    'lastRefresh': Date.now()
});

// Retrieve cached data
const cached = await browser.storage.local.get('usageData');
```

---

## 7. ERROR HANDLING & EDGE CASES

### Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| **No organization ID available** | Request from content script via `getOrgID` message |
| **Cookie-based auth expired** | Redirect user to claude.ai to re-authenticate |
| **Rate limiting (429 errors)** | Implement exponential backoff retry logic |
| **Multi-account/containers** | Store separate data per `cookieStoreId` |
| **Offline/network errors** | Show cached data with "last updated" timestamp |
| **Peak hour rate limits** | Reduce refresh frequency during peak times |

### Implementation Example:

```javascript
async function apiCallWithRetry(fn, maxRetries = 3) {
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await fn();
        } catch (error) {
            if (error.status === 429) {
                const backoffMs = Math.pow(2, i) * 1000;
                await sleep(backoffMs);
                continue;
            }
            throw error;
        }
    }
}
```

---

## 8. KEY INSIGHTS FROM REFERENCE IMPLEMENTATION

### Data Parsing Quirks

1. **API returns percentage utilization**, not absolute token counts
   - Must be multiplied by estimated caps to get actual token usage
   - Different tiers have different estimated caps

2. **Peak Hours Rate Limiting**
   - Session caps are effectively 1.5x higher during off-peak hours (1pm-7pm GMT weekdays)
   - Extension calculates: `isPeakHours() = day !== weekday || hour < 12 || hour >= 18`

3. **Model-Specific Limits**
   - Opus and Sonnet have separate weekly limits
   - Regular `weekly` limit applies to all models
   - Extension tracks: `weekly`, `sonnetWeekly`, `opusWeekly`

### Subscription Tier Complexity

```javascript
// Actual logic from extension (very convoluted!)
if (hasRavenType) {
    tier = "claude_team";
} else if (hasMaxCapability) {
    if (rateLimitTier.includes("5x")) {
        tier = "claude_max_5x";
    } else {
        tier = "claude_max_20x";
    }
} else if (hasProCapability) {
    tier = "claude_pro";
} else if (rateLimitTier === "default_claude_ai") {
    tier = "claude_free";
}
```

### Best Practice: Polling Strategy

```javascript
// Refresh intervals by context
const REFRESH_INTERVALS = {
    'USER_MESSAGE_SENT': 'immediate',     // Refresh after API call completes
    'POLLING': 5 * 60 * 1000,            // 5 minutes for background polling
    'ELECTRON': 2 * 60 * 1000,           // 2 minutes for desktop app
    'RESET_CHECK': 3 * 60 * 1000         // 3 minutes for reset notifications
};
```

---

## 9. PRODUCTION CONSIDERATIONS

### Security Best Practices

1. **Never store sensitive data unencrypted**
   - Use `browser.storage.local` (encrypted by default)
   - Don't expose API keys in content scripts

2. **Validate organization ID**
   - Only call APIs for org IDs extracted from claude.ai
   - Prevent injection of arbitrary org IDs

3. **CORS Considerations**
   - Claude.ai API likely supports CORS from extension context
   - Use `credentials: 'include'` for cookie-based auth

### Performance Optimization

```javascript
// Batch API calls
const batchApiCalls = async (orgId, calls) => {
    return Promise.all([
        api.getUsageData(),
        api.getSubscriptionTier(),
        calls.length > 0 && api.getCredits(),
    ].filter(Boolean));
};

// Cache aggressively
const CACHE_DURATIONS = {
    'subscriptionTier': 24 * 60 * 60 * 1000,  // 24 hours
    'usage': 2 * 60 * 1000,                   // 2 minutes
    'conversation': 60 * 60 * 1000            // 1 hour
};
```

---

## 10. RECOMMENDED TECHNICAL APPROACH (SUMMARY)

### For Your Extension:

```
ARCHITECTURE:
1. Background Service Worker
   - Manages all API calls to Claude.ai
   - Stores usage data in browser.storage.local
   - Implements retry logic and rate-limit handling

2. Content Script
   - Extracts organization ID from DOM or cookies
   - Sends messages requesting usage data updates
   - Renders UI overlays on Claude.ai

3. API Wrapper (ClaudeAPI class)
   - Handles containerFetch for multi-account support
   - Implements tier detection
   - Manages subscription tier caching

WORKFLOW:
1. User opens claude.ai → Content script extracts orgId
2. Extension fetches /api/organizations/{orgId}/usage
3. Parses response into UsageData object
4. Updates all tabs with usage UI overlay
5. Continues polling every 5 minutes
6. On message send: captures pre-send usage
7. On message completion: captures post-send usage
8. Calculates and displays delta

API CALLS NEEDED:
- GET /api/organizations/{orgId}/usage (main quota data)
- GET /api/bootstrap/{orgId}/app_start (subscription tier)
- GET /api/organizations/{orgId}/prepaid/credits (if extra usage enabled)

RESPONSE HANDLING:
- Parse utilization percentage to 0-100
- Parse resets_at ISO date to Unix milliseconds
- Combine with tier information to estimate absolute tokens
- Display with progress bars and countdown timers
```

---

## References & Resources

- **Reference Implementation**: https://github.com/lugia19/Claude-Usage-Extension
- **API Base URL**: `https://claude.ai/api`
- **Authentication**: Browser cookies (`lastActiveOrg` for org ID)
- **Response Format**: JSON with utilization percentages and ISO timestamps
- **Tier Capabilities**: Detected from `/bootstrap` endpoint

---

**Document Generated**: 2026-04-25  
**Research Basis**: Production-grade implementation analysis
**Extension Status**: Actively maintained with 277+ GitHub stars
