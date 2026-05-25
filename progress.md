# Progress: v2.1.225 Voice Events Smoke Test

## 2026-05-26
- Resumed from released v2.1.224 baseline.
- Inspected `startAPI` and `/voice/events` protocol paths.
- Added `scripts/smoke-voice-events.mjs`.
- The smoke test starts a temporary API server on port `39221` by default, verifies `/voice/events/status`, connects WebSocket clients, validates hello, ping/pong, subscribe audio/binary options, structured `tts:cancel` no-active-session response, and final client count cleanup.
- Added `npm run smoke:voice-events`.
- Initial status-after-close assertion saw one remaining client; fixed by resolving after WebSocket close and adding a short cleanup delay.
- Bumped version to 2.1.225 and updated README, CHANGELOG, BACKUP-2026-05-26.md, and Brain UI in-app release notes.

- Verification passed: `node --check scripts/smoke-voice-events.mjs` and `node --check scripts/voice-events-client.mjs`.
- Verification passed: `npm run smoke:voice-events` 7/7.
- Verification passed: `npm run smoke:tools` 6/6. Known local Node v24 / better-sqlite3 ABI audit-log warning remains non-blocking.
