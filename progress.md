# Progress: v2.1.211 Xiaozhi-style Voice Foundation

## 2026-05-26
- Started implementation after user confirmed “开始吧”.
- Replaced old planning files with v2.1.211 plan focused on voice state foundation.

- Added `src/voice/voice-state-machine.js` with explicit Xiaozhi-style states, transition metadata, roundId/asrSessionId/ttsSessionId generation, stale event checks, event history, and browser `bailongma:voice-state` dispatches.
- Wired `src/ui/brain-ui/voice-panel.js` to use the state machine for existing ASR/wake/speaker/video/TTS states while preserving current provider behavior.
- Added Settings → Voice debug panel in `src/ui/brain-ui/app-shell.js` and persistence/update logic in `src/ui/brain-ui/app.js`.
- Added v2.1.211 release note card in the in-app Update tab.
- Verification: JS syntax checks passed for `src/voice/voice-state-machine.js`, `src/ui/brain-ui/voice-panel.js`, `src/ui/brain-ui/app.js`, and `src/ui/brain-ui/app-shell.js`.
- Verification: `npm run smoke:tools` passed 6/6. It still logs the known local `better-sqlite3` Node ABI mismatch for audit persistence under Node v24, but the smoke assertions passed.
- Verification blocker: `npm run smoke:brain-ui` timed out waiting for `#graph circle`; this appears unrelated to the voice changes and is logged for follow-up.

- Bumped npm package version to 2.1.211.
- Updated README, CHANGELOG, backup document, and in-app release notes for v2.1.211.
