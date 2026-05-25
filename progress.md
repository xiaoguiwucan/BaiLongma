# Progress: v2.1.228 Voice Events Full TTS Lifecycle Mapping Smoke

## 2026-05-26
- Resumed from released v2.1.227 baseline.
- Inspected current voice event smoke and TTS lifecycle mappings.
- Extended publish mapping smoke to publish `tts:start`, `tts:sentence_start`, `tts:audio_ready`, `tts:sentence_end`, and `tts:stop`.
- Added assertions for Xiaozhi-style `tts start`, `sentence_start`, `audio_ready`, `sentence_end`, and `stop`, including key metadata fields.
- `npm run smoke:voice-events` now reports 15/15 checks instead of 11/11.
- Bumped version to 2.1.228 and updated README, CHANGELOG, BACKUP-2026-05-26.md, and Brain UI in-app release notes.

- Verification passed: `node --check scripts/smoke-voice-events.mjs` and `node --check scripts/voice-events-client.mjs`.
- Verification passed: `npm run smoke:voice-events` 15/15.
- Verification passed: `npm run smoke:tools` 6/6. Known local Node v24 / better-sqlite3 ABI audit-log warning remains non-blocking.
