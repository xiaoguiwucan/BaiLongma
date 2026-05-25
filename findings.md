# Findings: v2.1.211 Xiaozhi-style Voice Foundation

## Existing baseline
- Latest released version before this work: v2.1.210.
- Existing local ASR stack already includes SenseVoiceSmall default, Whisper fallback, wake-word gate, voiceprint gate, and video protection toggles.
- User requires every version/update to be backed up to GitHub and GitHub Releases with detailed notes and assets.

## Research carryover from Xiaozhi
- Xiaozhi-style flow should be event/state driven: wake, ASR, LLM, TTS lifecycle, interruption, stale round protection.
- The first safe BaiLongma step is a voice state machine + round/session IDs + settings/debug UI.


## Phase 1 discovery
- `src/ui/brain-ui/voice-panel.js` is the main runtime voice controller: mic lifecycle, ASR WebSocket, wake-word gate, speaker rejection, barge-in, video/media mode, and TTS suspension hooks all live there.
- Settings markup is generated in `src/ui/brain-ui/app-shell.js`; settings behavior is in `src/ui/brain-ui/app.js` around the voice keys block.
- Safe integration path: add a small browser-compatible state machine module and wire existing `setStatus(...)` calls through it. Avoid changing ASR/TTS provider behavior in this foundation release.
