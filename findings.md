# Findings: v2.1.212 Wake Word Upgrade

## Current baseline
- v2.1.211 shipped a voice state machine and settings debug panel.
- Current wake logic lives in `src/ui/brain-ui/voice-panel.js` with localStorage keys `bailongma-voice-wake-enabled` and `bailongma-voice-wake-words`.
- Current behavior: wake enabled by default; if transcript contains any configured wake word, the remainder is accepted; if only wake word is spoken, an 8s command window opens.
- Current backend config in `src/config.js` stores `wakeWordEnabled` and `wakeWords` only.

## Needed v2.1.212 additions
- Persist wake mode: loose contains-keyword vs strict prefix-keyword.
- Persist wake window seconds instead of hardcoded 8s.
- Add repeat/noise suppression controls and state debug events.
- Surface wake status in settings debug panel.
