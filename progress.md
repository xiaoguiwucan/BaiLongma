# Progress: v2.1.219 TTS Audio Segment Events

## 2026-05-26
- Resumed from released v2.1.218 baseline.
- Inspected current voice event WebSocket mapping and frontend sentence-level TTS queue.
- Added `VOICE_EVENT_TYPES.TTS_AUDIO_READY` as `tts:audio_ready`.
- Updated Brain UI TTS playback to emit `tts:audio_ready` before fetching each `/tts/session/:id/audio/:index` segment.
- Updated backend voice event bus to map `tts:audio_ready` to Xiaozhi-style JSON with `type=tts`, `state=audio_ready`, `sessionId`, `index`, `text`, `url`, and `contentType`.
- Bumped version to 2.1.219 in `package.json` and `package-lock.json`.
- Updated README, CHANGELOG, BACKUP-2026-05-26.md, and Brain UI in-app release notes.

- Verification passed: `node --check src/voice/voice-events.js`, `node --check src/voice/voice-event-bus.js`, `node --check src/ui/brain-ui/app.js`, `node --check src/api.js`.
- Verification passed: `npm run smoke:tools` 6/6. Known local Node v24 / better-sqlite3 ABI audit-log warning remains non-blocking.
- Committed v2.1.219 as `a9a02cc feat: expose tts audio segment events`.
- Tagged and pushed `v2.1.219` to origin.
- Created GitHub Release: https://github.com/xiaoguiwucan/BaiLongma/releases/tag/v2.1.219
- Uploaded release assets: `backups/v2.1.219/BaiLongma-v2.1.219-source.tar.gz` and `backups/v2.1.219/BaiLongma-v2.1.219.bundle`.
