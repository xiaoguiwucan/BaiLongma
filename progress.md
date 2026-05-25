# Progress: v2.1.222 WebSocket TTS Cancel and Speak Guards

## 2026-05-26
- Resumed from released v2.1.221 baseline.
- Inspected WebSocket `tts:speak` implementation and TTS session lifecycle.
- Added per-connection active speak tracking with `requestId` and `sessionId`.
- Added `tts:cancel` / `cancel` WebSocket message handling.
- Same-client new `tts:speak` now cancels the previous speak with reason `replaced_by_new_speak`.
- WebSocket close/error now cancels the active speak with reason `client_disconnected`.
- Segment streaming now checks cancellation, request replacement, and socket readiness before emitting chunks; cancellation attempts to destroy the provider audio stream.
- Bumped version to 2.1.222 and updated README, CHANGELOG, BACKUP-2026-05-26.md, and Brain UI in-app release notes.

- Verification passed: `node --check src/api.js`, `node --check src/voice/voice-event-bus.js`, and `node --check src/ui/brain-ui/app-shell.js`.
- Verification passed: `npm run smoke:tools` 6/6. Known local Node v24 / better-sqlite3 ABI audit-log warning remains non-blocking.
