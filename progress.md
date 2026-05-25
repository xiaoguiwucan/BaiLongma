# Progress: v2.1.218 Experimental Voice WebSocket Channel

## 2026-05-26
- Started v2.1.218 after completing and releasing v2.1.217.
- Inspected `src/api.js` WebSocket upgrade paths and browser-side voice event bus.
- Added backend `src/voice/voice-event-bus.js` for WebSocket clients and Xiaozhi-like event mapping.
- Added `/voice/events` WebSocket endpoint plus `/voice/events/status` and `/voice/events/publish` HTTP bridge endpoints.
- Added Brain UI bridge that forwards browser `bailongma:voice-event` objects to backend clients without blocking UI.

- Bumped package version to 2.1.218.
- Updated README, CHANGELOG, backup document, and in-app release notes for v2.1.218.
- Verification: JS syntax checks and `npm run smoke:tools` passed.

- Committed v2.1.218 as `27873f8 feat: add voice event websocket channel`.
- Tagged and pushed `v2.1.218` to origin.
- Created GitHub Release: https://github.com/xiaoguiwucan/BaiLongma/releases/tag/v2.1.218
- Uploaded release assets: source tarball and Git bundle under `backups/v2.1.218/`.
