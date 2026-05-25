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

- Committed v2.1.214 as `ee3ac51 feat: tune video voice ducking`.
- Tagged and pushed `v2.1.214` to origin.
- Created GitHub Release: https://github.com/xiaoguiwucan/BaiLongma/releases/tag/v2.1.214
- Uploaded release assets: source tarball and Git bundle under `backups/v2.1.214/`.
