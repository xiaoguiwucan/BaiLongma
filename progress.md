# Progress: v2.1.221 WebSocket TTS Speak Request

## 2026-05-26
- Resumed from released v2.1.220 baseline.
- Inspected TTS session manager and voice event WebSocket bus.
- Upgraded `/voice/events` hello to protocol version 3 with `tts_speak` capability.
- Added voice event bus helpers for single-client JSON delivery, client option snapshots, and target-client audio chunk delivery.
- Added WebSocket `tts:speak` / `speak` handling in `src/api.js`.
- `tts:speak` now creates a TTS session from text, emits session/start/sentence/audio_ready events, streams audio chunks to the requester, and emits sentence_end/stop.
- Bumped version to 2.1.221 and updated README, CHANGELOG, BACKUP-2026-05-26.md, and Brain UI in-app release notes.

- Verification passed: `node --check src/voice/voice-event-bus.js`, `node --check src/api.js`, and `node --check src/ui/brain-ui/app-shell.js`.
- Verification passed: `npm run smoke:tools` 6/6. Known local Node v24 / better-sqlite3 ABI audit-log warning remains non-blocking.
