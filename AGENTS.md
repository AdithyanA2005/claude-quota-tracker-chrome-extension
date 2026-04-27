# AI Agent Guide

This file is the main entry point for AI coding agents working in this repository.

## Project Summary

This is a Manifest V3 Chrome extension built with Vite and `@crxjs/vite-plugin`. It tracks Claude.ai quota usage through Claude.ai internal endpoints and displays the result in two places:

- Extension popup: full usage cards.
- Claude.ai page: compact inline usage bars near the composer.

## Source Map

```text
src/background.js
src/background/api.js
src/background/cache.js
src/background/polling.js

src/content.js
src/content/auth.js
src/content/dom.js
src/content/router.js
src/content/tracker.js
src/content/ui.js

src/popup/popup.html
src/popup/popup.css
src/popup/popup.js

src/utils/formatting.js
src/utils/logger.js
src/utils/orgId.js
```

## Architecture Rules

- Background code owns API calls, caching, polling, and Chrome runtime message handling.
- Content code owns Claude.ai DOM integration, org ID extraction from page state, route observation, and inline UI mounting.
- Popup code owns popup rendering and user interactions only.
- Shared formatting, logging, and org ID normalization belong in `src/utils/`.
- Do not put business logic in `manifest.json`, popup HTML, or CSS files.

## Commands

Use `pnpm` only.

```bash
pnpm install
pnpm dev
pnpm build
```

There is currently no test script. Use `pnpm build` as the baseline verification command.

## Extension Behavior

- `manifest.json` registers `src/background.js` as a module service worker.
- `manifest.json` injects `src/content.js` on `https://claude.ai/*`.
- `src/background/api.js` calls `https://claude.ai/api` endpoints with `credentials: 'include'`.
- `src/background/cache.js` caches usage data for 2 minutes.
- `src/background/polling.js` refreshes data every 5 minutes only when Claude.ai is the active tab.
- `src/content/tracker.js` refreshes the inline tracker every 60 seconds.

## API Context

See `docs/TECHNICAL_REFERENCE.md` for endpoint and response-shape details.

## Coding Guidelines

- Prefer small, targeted changes.
- Preserve the current vanilla JavaScript structure unless there is a clear reason to introduce new tooling.
- Be careful with Claude.ai DOM selectors; they are brittle by nature.
- Keep generated build output out of git. `dist/` is ignored.
- Do not log sensitive values such as full organization IDs unless explicitly debugging locally.
- When adding docs for agents, update this file or `docs/TECHNICAL_REFERENCE.md`; do not create extra root-level Markdown files.

## Manual Verification

After code changes, run:

```bash
pnpm build
```

For behavior changes, manually test in Chrome:

1. Load `dist/` as an unpacked extension.
2. Visit `https://claude.ai` while logged in.
3. Confirm the popup renders usage data or a useful error.
4. Confirm the inline tracker appears near the composer.
