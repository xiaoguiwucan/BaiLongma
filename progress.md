# Progress: v2.1.235 Voice Events Remote Address TTS Speak Cooldown

## 2026-05-26
- Resumed after v2.1.234 release; git worktree was clean on `main`.
- Inspected current `/voice/events` rate limiting and found it is per WebSocket connection only.
- Started v2.1.235 plan to add remote-address-level `tts:speak` cooldown and protocol metadata.
- Added `limits.ttsSpeak.scopes` metadata with `connection` and `remoteAddress`.
- Added remote-address-level `tts:speak` cooldown map with stale-entry pruning.
- Updated `rate_limited` protocol errors to include `scope: connection` or `scope: remote`.
- Extended mapping smoke to 28 checks and voice-events smoke to 31 checks.
- Bumped version to 2.1.235 and updated README, CHANGELOG, BACKUP, protocol docs, and Brain UI release notes.
- Verification passed: JS syntax checks for touched protocol/API/smoke files.
- Verification passed: `npm run smoke:voice-mapping` 28/28.
- Verification passed: `npm run smoke:voice-events` 31/31.
- Verification passed: `npm run smoke:tools` 6/6. Known local Node v24 / better-sqlite3 ABI audit-log warning remains non-blocking.
