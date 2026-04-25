# Quick Reference - Claude Quota Extraction

## API Endpoint

```
GET https://claude.ai/api/organizations/{orgId}/usage
```

## Response Format

```json
{
  "five_hour": { "utilization": 45.2, "resets_at": "2024-04-25T17:00:00Z" },
  "seven_day": { "utilization": 62.8, "resets_at": "2024-05-02T00:00:00Z" },
  "seven_day_sonnet": { "utilization": 20.1, "resets_at": "2024-05-02T00:00:00Z" },
  "seven_day_opus": { "utilization": 50.5, "resets_at": "2024-05-02T00:00:00Z" },
  "extra_usage": {
    "is_enabled": true,
    "monthly_limit": 10000,
    "used_credits": 2500
  }
}
```

## Authentication

- Method: HTTP Cookies
- Cookie Name: `lastActiveOrg`
- Cookie Value: Organization UUID
- Header: `credentials: 'include'`

## Minimal Code Example

```javascript
async function getUsageQuota(orgId) {
  const response = await fetch(
    `https://claude.ai/api/organizations/${orgId}/usage`,
    {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include'
    }
  );
  return response.json();
}
```

## Data Mapping

| API Field | Meaning | Unit |
|-----------|---------|------|
| `five_hour` | 5-hour session limit | percentage (0-100) |
| `seven_day` | Weekly limit | percentage (0-100) |
| `seven_day_sonnet` | Sonnet model weekly | percentage (0-100) |
| `seven_day_opus` | Opus model weekly | percentage (0-100) |
| `utilization` | Usage percentage | 0-100 |
| `resets_at` | When limit resets | ISO8601 timestamp |
| `monthly_limit` | Extra usage monthly limit | cents ($) |
| `used_credits` | Credits used this month | cents ($) |

## Related Endpoints

| Endpoint | Purpose | Returns |
|----------|---------|---------|
| `/bootstrap/{orgId}/app_start` | Subscription info | Tier capabilities |
| `/organizations/{orgId}/prepaid/credits` | Credit balance | `{ "amount": 500 }` (cents) |
| `/organizations/{orgId}/chat_conversations/{id}` | Conversation tokens | Full message tree |
| `/organizations/{orgId}/memory` | User memory data | Memory content |

## Subscription Tiers

- `claude_free` - Free tier
- `claude_pro` - Pro subscription
- `claude_team` - Team accounts
- `claude_max_5x` - Max 5x tier
- `claude_max_20x` - Max 20x tier

## Manifest.json Permissions

```json
{
  "permissions": ["storage", "tabs", "webRequest", "alarms"],
  "host_permissions": ["*://claude.ai/*"]
}
```

## Polling Intervals

| Scenario | Interval |
|----------|----------|
| Background polling | 5 minutes |
| Peak hours (1pm-7pm GMT weekdays) | 2-3 minutes |
| Rate limited (429) | Exponential backoff |
| Message sent | Immediate |

## Error Codes

| Code | Meaning | Action |
|------|---------|--------|
| 200 | Success | Use data |
| 401 | Unauthorized | User needs to re-login |
| 429 | Rate limited | Implement backoff |
| 500 | Server error | Retry after delay |

## Estimated Token Caps

| Tier | Session | Weekly |
|------|---------|--------|
| claude_free | 375,000 | N/A |
| claude_pro | ? | ? |
| claude_max_5x | 7.5M | 75M |
| claude_max_20x | 30M | 300M |

*Note: These are estimates; API returns percentages*

## Directory Structure

```
extension/
├── manifest.json
├── background.js
├── content.js
├── popup.html
├── popup.js
└── styles.css
```

## Implementation Checklist

- [ ] Create manifest.json with MV3
- [ ] Implement background service worker
- [ ] Implement content script
- [ ] Add org ID extraction logic
- [ ] Create popup UI
- [ ] Implement API wrapper
- [ ] Add storage management
- [ ] Test on claude.ai
- [ ] Error handling
- [ ] Rate limit handling
- [ ] Multi-account support
- [ ] Caching strategy

## Key Files to Review

1. **RESEARCH_SUMMARY.txt** - Start here for overview
2. **CLAUDE_QUOTA_RESEARCH.md** - Complete technical details
3. **IMPLEMENTATION_GUIDE.md** - Step-by-step code examples

## Common Issues

### No data showing
- Check: Are you logged into claude.ai?
- Check: Is org ID being extracted correctly?
- Solution: Add console logging in content script

### Getting 429 errors
- Issue: Rate limiting from Claude.ai
- Solution: Implement exponential backoff
- Tip: Reduce polling frequency

### Org ID not found
- Try: Logout and login to claude.ai
- Check: Browser cookies for `lastActiveOrg`
- Fallback: Use content script message handler

### Authentication fails
- Check: Credentials in fetch request
- Check: CORS headers
- Solution: Use `credentials: 'include'`

## Performance Tips

- Cache subscription tier (24 hours)
- Cache usage data (2 minutes)
- Batch multiple API calls
- Debounce UI updates
- Use service worker for background polling

## Security Best Practices

- Never expose org IDs in logs
- Validate org IDs before API calls
- Use `browser.storage.local` (encrypted)
- Don't store sensitive data in session storage
- Validate API responses

## Testing Commands

```javascript
// Test in extension popup console:
const stored = await chrome.storage.local.get('usageData');
console.log(stored.usageData);

// Test API directly:
fetch('https://claude.ai/api/organizations/{orgId}/usage',
  { credentials: 'include' }
).then(r => r.json()).then(console.log);
```

## References

- Main Research: CLAUDE_QUOTA_RESEARCH.md
- Implementation: IMPLEMENTATION_GUIDE.md
- Reference Code: https://github.com/lugia19/Claude-Usage-Extension
