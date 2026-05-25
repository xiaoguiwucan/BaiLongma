# Progress: v2.1.217 Xiaozhi-style Voice Event Protocol

## 2026-05-26
- Started v2.1.217 after completing and releasing v2.1.216.
- Inspected existing scattered voice/media/TTS events and current TTS segment queue.
- Added `src/voice/voice-events.js` with Xiaozhi-style namespaced voice event types and browser `bailongma:voice-event` dispatch.
- Wired wake, ASR partial/final, speaker rejection, interruption, media duck, TTS session start, sentence start/end, and TTS stop events.
- Added the latest voice event to the existing voice debug panel.

- Bumped package version to 2.1.217.
- Updated README, CHANGELOG, backup document, and in-app release notes for v2.1.217.
- Verification: JS syntax checks and `npm run smoke:tools` passed.
