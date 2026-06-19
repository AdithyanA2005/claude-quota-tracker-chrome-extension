# Technical Reference

Concise technical context for humans and AI agents.

## Tool Versions

- pnpm version pinned in `mise.toml` (currently 10.33.2)
- Build tools: Vite 5.x + @crxjs/vite-plugin 2.0.0-beta.33

## Claude.ai Endpoints

Base URL:

```text
https://claude.ai/api
```

Usage endpoint:

```text
GET /organizations/{orgId}/usage
```

Subscription endpoint:

```text
GET /bootstrap/{orgId}/app_start?statsig_hashing_algorithm=djb2
```

Requests rely on the browser's existing Claude.ai session cookies:

```js
fetch(url, {
  method: 'GET',
  credentials: 'include'
});
```

## Usage Response Shape

Observed fields:

```json
{
  "five_hour": {
    "utilization": 45.2,
    "resets_at": "2026-04-27T17:00:00Z"
  },
  "seven_day": {
    "utilization": 62.8,
    "resets_at": "2026-05-02T00:00:00Z"
  },
  "seven_day_sonnet": {
    "utilization": 20.1,
    "resets_at": "2026-05-02T00:00:00Z"
  },
  "seven_day_opus": {
    "utilization": 50.5,
    "resets_at": "2026-05-02T00:00:00Z"
  }
}
```

The code maps these fields in `src/background/cache.js`:

| API field | Internal field | Display |
| --- | --- | --- |
| `five_hour` | `fiveHour` | Popup and inline tracker |
| `seven_day` | `sevenDay` | Popup and inline tracker |
| `seven_day_sonnet` | `sonnetWeekly` | Popup only |
| `seven_day_opus` | `opusWeekly` | Popup only |

## Organization ID Sources

Current lookup order:

1. `chrome.storage.local.orgId`
2. `lastActiveOrg` cookie in `src/background/api.js`
3. `localStorage.lastActiveOrg` in `src/content/auth.js`
4. `window.__INITIAL_STATE__.orgId` in `src/content/auth.js`

All values pass through `normalizeOrgId()` in `src/utils/orgId.js`.

Content script retries org ID extraction up to 10 times with 2-second intervals if initial extraction fails.

## Subscription Detection

`src/background/api.js` checks the organization object returned by `/bootstrap/{orgId}/app_start`:

- `org.raven_type` means Claude Team.
- `org.capabilities` containing `claude_max` means Claude Max.
- `org.rate_limit_tier` may distinguish Max 5x vs Max 20x.
- `org.capabilities` containing `claude_pro` means Claude Pro.
- Otherwise the code reports Claude Free.

## Cache And Polling

- Usage cache TTL: 2 minutes in `src/background/cache.js`.
- Background alarm interval: 5 minutes in `src/background/polling.js`.
- Inline tracker interval: 60 seconds in `src/content/tracker.js`.
- Mount throttle: 250ms in `src/content/tracker.js`.
- Failed fresh requests return stale cached data when available.

## Known Fragile Areas

- Claude.ai API endpoints are not public API contracts.
- Claude.ai DOM structure changes can break `src/content/dom.js` selectors.
- Chrome service workers can be suspended between events, so persistent state should live in `chrome.storage.local`.
- Popup state is short-lived and should not own data fetching rules.

## Verification Checklist

- Run `pnpm build`.
- Load `dist/` in Chrome as an unpacked extension.
- Open Claude.ai while logged in.
- Confirm `chrome.storage.local.orgId` is set.
- Confirm popup can show quota data or a clear error.
- Confirm the inline tracker remounts after Claude.ai SPA navigation.
