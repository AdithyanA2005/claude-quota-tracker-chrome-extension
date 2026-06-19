# Claude Usage Tracker Extension

Chrome/Chromium extension for showing Claude.ai quota usage in the browser popup and inline inside the Claude.ai composer.

## What It Does

- Reads the active Claude organization ID from Claude.ai storage/cookies.
- Fetches usage data from Claude.ai using the current browser session.
- Shows 5-hour, 7-day, Sonnet weekly, and Opus weekly usage in the extension popup.
- Injects compact 5-hour and 7-day usage bars into Claude.ai.
- Caches usage data locally to avoid unnecessary API calls.
- Detects subscription tier (Team, Max 5x/20x, Pro, Free).

## Project Structure

```text
.
├── AGENTS.md                 # AI-agent operating guide
├── README.md                 # Human-facing project overview
├── mise.toml                 # Tool version pinning (pnpm 10.33.2)
├── docs/
│   └── TECHNICAL_REFERENCE.md
├── manifest.json             # Manifest V3 extension config
├── vite.config.js            # Vite + CRX plugin config
├── src/
│   ├── background.js         # Service worker entrypoint
│   ├── background/           # API, cache, polling
│   ├── content.js            # Claude.ai content-script entrypoint
│   ├── content/              # DOM integration and inline tracker
│   ├── popup/                # Popup HTML/CSS/JS
│   └── utils/                # Formatting, logging, org ID helpers
└── icons/                    # Extension icons
```

## Polling and Caching

- Background polling: Every 5 minutes (only when Claude.ai is active tab)
- Usage cache TTL: 2 minutes
- Inline tracker refresh: Every 60 seconds
- Failed requests fall back to stale cached data

## Development

Use `pnpm`, not `npm`.

```bash
pnpm install
pnpm dev
pnpm build
```

Load the extension from `dist/` after `pnpm build`, or use the Vite dev workflow supported by `@crxjs/vite-plugin`.

## Installation For Manual Testing

1. Run `pnpm build`.
2. Open `chrome://extensions`.
3. Enable Developer mode.
4. Click Load unpacked.
5. Select the generated `dist/` directory.
6. Visit `https://claude.ai` while logged in.
7. Open the extension popup.

## Runtime Flow

1. `src/content.js` runs on Claude.ai.
2. `src/content/auth.js` extracts the active organization ID.
3. `src/background.js` receives and stores the org ID.
4. `src/background/cache.js` fetches or returns cached usage data.
5. `src/popup/popup.js` renders the full quota card UI.
6. `src/content/tracker.js` renders the compact inline tracker.

## Important Notes

- Claude.ai quota endpoints are internal and can change without notice.
- Claude.ai page markup can change, so content-script DOM selectors are intentionally heuristic.
- There are no automated tests yet; use `pnpm build` plus manual browser testing.
- Keep AI-agent context in `AGENTS.md` and `docs/TECHNICAL_REFERENCE.md` instead of adding more root-level research files.
