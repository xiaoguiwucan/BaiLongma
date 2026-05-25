# Progress: v2.1.227 Voice Events Wake/TTS Mapping Smoke

## 2026-05-26
- Resumed from released v2.1.226 baseline.
- Inspected `scripts/smoke-voice-events.mjs` and `src/voice/voice-event-bus.js` mappings.
- Extended the publish mapping smoke to publish `wake:accepted` and `tts:audio_ready` in addition to `asr:final`.
- Added assertions for Xiaozhi-style `wake accepted` and `tts audio_ready` mapping, including `sessionId` and audio URL preservation.
- `npm run smoke:voice-events` now reports 11/11 checks instead of 9/9.
- Bumped version to 2.1.227 and updated README, CHANGELOG, BACKUP-2026-05-26.md, and Brain UI in-app release notes.

- Verification passed: `node --check scripts/smoke-voice-events.mjs` and `node --check scripts/voice-events-client.mjs`.
- Verification passed: `npm run smoke:voice-events` 11/11.
- Verification passed: `npm run smoke:tools` 6/6. Known local Node v24 / better-sqlite3 ABI audit-log warning remains non-blocking.
