# Progress: v2.1.232 Voice Event TTS Speak Safety Limits

## 2026-05-26
- Resumed after v2.1.231 release; git worktree was clean on `main`.
- Inspected voice event protocol files and found `tts:speak` lacks max length/rate limiting.
- Started v2.1.232 plan to add explicit safety limits and protocol metadata for external clients.
- Added `VOICE_EVENTS_TTS_SPEAK_LIMITS` with `maxTextChars=800` and `cooldownMs=1200`.
- Exposed `tts_speak_limits`, `limits.ttsSpeak`, `text_too_long`, and `rate_limited` in protocol metadata.
- Extended `validateVoiceEventClientMessage` to reject overlong `tts:speak` text.
- Added per-WebSocket `tts:speak` cooldown guard returning `protocol_error` with `retryAfterMs`.
- Extended mapping smoke to 22 checks and voice-events smoke to 23 checks.
- Bumped version to 2.1.232 and updated README, CHANGELOG, BACKUP, protocol docs, and Brain UI release notes.
- Verification passed: JS syntax checks for touched protocol/API/smoke files.
- Verification passed: `npm run smoke:voice-mapping` 22/22.
- Verification passed: `npm run smoke:voice-events` 23/23.
- Verification passed: `npm run smoke:tools` 6/6. Known local Node v24 / better-sqlite3 ABI audit-log warning remains non-blocking.
