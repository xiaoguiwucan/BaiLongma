# Progress: v2.1.214 Video Voice Robustness Upgrade

## 2026-05-26
- Started v2.1.214 after completing and releasing v2.1.213.
- Inspected current media duck/PTT/AEC implementation in `voice-panel.js`, `app.js`, and `app-shell.js`.
- Added confirmed-frame near-field detection before dispatching video voice duck events, reducing one-frame spike false triggers.
- Added configurable video duck level, hold time, and trigger sensitivity to Settings → Voice.
- Updated media duck layer to use configured volume/hold values and dispatch visible `bailongma:media-duck` status events.

- Bumped package version to 2.1.214.
- Updated README, CHANGELOG, backup document, and in-app release notes for v2.1.214.
- Verification: JS syntax checks and `npm run smoke:tools` passed.
