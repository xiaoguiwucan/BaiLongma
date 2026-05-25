# Progress: v2.1.229 Voice Event Mapping Pure Smoke

## 2026-05-26
- Resumed from released v2.1.228 baseline.
- Inspected `src/voice/voice-event-bus.js` mapping logic.
- Exported `mapVoiceEventToXiaozhi(event)` and updated runtime callers to use the exported mapper.
- Added `scripts/smoke-voice-mapping.mjs` with 13 mapping checks covering ASR, wake, TTS lifecycle, audio_ready defaults, interrupt fallback, unknown events, and null events.
- Added `npm run smoke:voice-mapping`.
- Bumped version to 2.1.229 and updated README, CHANGELOG, BACKUP-2026-05-26.md, and Brain UI in-app release notes.

- Verification passed: `node --check src/voice/voice-event-bus.js`, `node --check scripts/smoke-voice-mapping.mjs`, and `node --check scripts/smoke-voice-events.mjs`.
- Verification passed: `npm run smoke:voice-mapping` 13/13.
- Verification passed: `npm run smoke:voice-events` 15/15.
- Verification passed: `npm run smoke:tools` 6/6. Known local Node v24 / better-sqlite3 ABI audit-log warning remains non-blocking.
- Committed v2.1.229 as `0986651 test: add voice event mapping smoke`.
- Tagged and pushed `v2.1.229` to origin.
- Created GitHub Release: https://github.com/xiaoguiwucan/BaiLongma/releases/tag/v2.1.229
- Uploaded release assets: `backups/v2.1.229/BaiLongma-v2.1.229-source.tar.gz` and `backups/v2.1.229/BaiLongma-v2.1.229.bundle`.
