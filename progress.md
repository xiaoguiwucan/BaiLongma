# Progress: v2.1.220 WebSocket TTS Audio Chunk Subscription

## 2026-05-26
- Resumed from released v2.1.219 baseline.
- Inspected voice event bus and TTS segment streaming route.
- Upgraded `/voice/events` hello to protocol version 2 with `json_events` and `tts_audio_chunks` capabilities.
- Added per-client subscription options for audio chunk delivery.
- Added WebSocket client messages:
  - `{"type":"subscribe","audio":true}` for base64 JSON audio chunks.
  - `{"type":"subscribe","audio":true,"binaryAudio":true}` for metadata plus binary audio chunks.
  - `{"type":"unsubscribe","audio":false,"binaryAudio":false}` to disable audio delivery.
- Added TTS audio stream broadcasts: `audio_start`, `audio_chunk`, `audio_chunk_base64` or binary chunk, `audio_end`, and `audio_error`.
- Updated `/voice/events/status` with `audioSubscribers`, `binaryAudioSubscribers`, and `version`.
- Bumped version to 2.1.220 and updated README, CHANGELOG, BACKUP-2026-05-26.md, and Brain UI in-app release notes.

- Verification passed: `node --check src/voice/voice-event-bus.js`, `node --check src/api.js`, and `node --check src/ui/brain-ui/app-shell.js`.
- Verification passed: `npm run smoke:tools` 6/6. Known local Node v24 / better-sqlite3 ABI audit-log warning remains non-blocking.
