# Progress: v2.1.226 Voice Events Publish Mapping Smoke

## 2026-05-26
- Resumed from released v2.1.225 baseline.
- Inspected `scripts/smoke-voice-events.mjs` and `/voice/events/publish` route.
- Extended the voice events smoke test to open a WebSocket client, publish an `asr:final` event through HTTP `/voice/events/publish`, and assert that the client receives both raw `voice_event` and Xiaozhi-style `stt final` JSON.
- `npm run smoke:voice-events` now reports 9/9 checks instead of 7/7.
- Bumped version to 2.1.226 and updated README, CHANGELOG, BACKUP-2026-05-26.md, and Brain UI in-app release notes.

- Verification passed: `node --check scripts/smoke-voice-events.mjs` and `node --check scripts/voice-events-client.mjs`.
- Verification passed: `npm run smoke:voice-events` 9/9.
- Verification passed: `npm run smoke:tools` 6/6. Known local Node v24 / better-sqlite3 ABI audit-log warning remains non-blocking.
