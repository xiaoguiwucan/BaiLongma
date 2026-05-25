# Progress: v2.1.233 Configurable Voice Event TTS Speak Limits

## 2026-05-26
- Resumed after v2.1.232 release; git worktree was clean on `main`.
- Inspected `src/config.js`, `src/api.js`, `src/voice/voice-event-bus.js`, Brain UI TTS settings, and smoke tests.
- Found TTS settings are the right place to persist voice event `tts:speak` safety limits.
- Started v2.1.233 plan to make fixed v2.1.232 limits configurable while preserving defaults.
- Added settings-backed TTS speak limits: `voiceEventsTtsSpeakMaxTextChars` and `voiceEventsTtsSpeakCooldownMs`.
- Added `normalizeVoiceEventsTTSSpeakLimits` and made protocol metadata/hello accept active configured limits.
- Updated `/voice/events/protocol`, WebSocket hello, validation, and cooldown to use configured limits from `/settings/tts`.
- Added Brain UI inputs for external voice client max text chars and cooldown ms.
- Extended mapping smoke to 25 checks and voice-events smoke to 26 checks.
- Bumped version to 2.1.233 and updated README, CHANGELOG, BACKUP, protocol docs, and Brain UI release notes.
- Verification passed: JS syntax checks for touched protocol/config/API/UI/smoke files.
- Verification passed: `npm run smoke:voice-mapping` 25/25.
- Verification passed: `npm run smoke:voice-events` 26/26.
- Verification passed: `npm run smoke:tools` 6/6. Known local Node v24 / better-sqlite3 ABI audit-log warning remains non-blocking.
