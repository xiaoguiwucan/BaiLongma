# Findings: v2.1.214 Video Voice Robustness Upgrade

## Current baseline
- `voice-panel.js` dispatches `bailongma:voice-activity` while video mode is active if mic volume exceeds `BARGEIN_THRESHOLD`.
- `app.js` listens for `bailongma:voice-activity` and calls `startMediaVoiceDuck({ holdMs: 1800, pause: false })`.
- Local video is ducked to volume 0.10; YouTube receives setVolume 10; Bilibili/cross-origin fallback pauses.
- Existing settings: auto duck/pause, Space PTT, system AEC.

## Gaps
- Duck volume and hold duration are hardcoded.
- A single high-volume frame can trigger media duck.
- Settings UI does not expose current duck status/tuning.
