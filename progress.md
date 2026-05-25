# Progress: v2.1.231 Voice Event Client Message Validation

## 2026-05-26
- Resumed after v2.1.230 release; git worktree was clean on `main`.
- Inspected `src/voice/voice-event-bus.js`, `src/api.js`, `scripts/smoke-voice-events.mjs`, and `docs/VOICE_EVENTS_PROTOCOL.md`.
- Found that malformed JSON and unsupported `/voice/events` client messages were silently ignored, making external client debugging difficult.
- Started v2.1.231 plan to add structured protocol validation and error replies.
- Implemented `protocol_errors` capability and protocol metadata `errorCodes`.
- Added `validateVoiceEventClientMessage`, `createVoiceEventProtocolError`, and `sendVoiceEventProtocolError`.
- Updated `/voice/events` WebSocket boundary to return structured `protocol_error` for invalid JSON, unsupported type, and empty `tts:speak`.
- Extended pure mapping smoke to 20 checks and integration voice-events smoke to 20 checks.
- Bumped version to 2.1.231 and updated README, CHANGELOG, BACKUP, docs/VOICE_EVENTS_PROTOCOL.md, and Brain UI release notes.
- Verification passed: JS syntax checks for touched protocol/API/smoke files.
- Verification passed: `npm run smoke:voice-mapping` 20/20.
- Verification passed: `npm run smoke:voice-events` 20/20.
- Verification passed: `npm run smoke:tools` 6/6. Known local Node v24 / better-sqlite3 ABI audit-log warning remains non-blocking.
- Committed v2.1.231 as `2d8b98f feat: validate voice event client messages`.
- Tagged and pushed `v2.1.231` to origin.
- Created local release assets: `backups/v2.1.231/BaiLongma-v2.1.231-source.tar.gz` and `backups/v2.1.231/BaiLongma-v2.1.231.bundle`.
- Created GitHub Release: https://github.com/xiaoguiwucan/BaiLongma/releases/tag/v2.1.231
- Uploaded release assets via GitHub API: source tarball and git bundle.
