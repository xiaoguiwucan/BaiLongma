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

- Committed v2.1.216 as `90152dd feat: add sentence tts sessions`.
- Tagged and pushed `v2.1.216` to origin.
- Created GitHub Release: https://github.com/xiaoguiwucan/BaiLongma/releases/tag/v2.1.216
- Uploaded release assets: source tarball and Git bundle under `backups/v2.1.216/`.
