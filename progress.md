# Progress: v2.1.216 Sentence TTS Session

## 2026-05-26
- Started v2.1.216 after completing and releasing v2.1.215.
- Inspected existing `streamTTS`, `/tts/stream`, and frontend `playTTSReply` blob-based playback.
- Added `src/voice/sentence-splitter.js` for Chinese/English punctuation based TTS segmentation.
- Added `src/voice/tts-session.js` with session IDs, segment list, cancellation, and per-segment streaming.
- Added backend `/tts/session`, `/tts/session/:id/audio/:index`, and `/tts/session/:id/cancel` endpoints while preserving `/tts/stream`.
- Replaced frontend whole-reply TTS playback with session/segment queue playback and old-session cancellation guard.

- Bumped package version to 2.1.216.
- Updated README, CHANGELOG, backup document, and in-app release notes for v2.1.216.
- Verification: JS syntax checks and `npm run smoke:tools` passed.
