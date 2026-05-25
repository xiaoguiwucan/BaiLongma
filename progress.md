# Progress: v2.1.212 Xiaozhi-style Wake Word Upgrade

## 2026-05-26
- Started v2.1.212 continuation after user asked “继续 做完”.
- Inspected current wake gate in `voice-panel.js`, settings in `app.js` / `app-shell.js`, and backend voice config in `config.js`.
- Extended backend voice config with `wakeMode`, `wakeWindowSeconds`, and `wakeRepeatSuppression`.
- Upgraded frontend wake gate to support strict prefix matching, loose contains matching, configurable wake command window, and repeated rejected transcript suppression.
- Added Settings controls for wake matching mode, wake command window slider, and repeated false-text suppression.

- Bumped package version to 2.1.212.
- Updated README, CHANGELOG, backup document, and in-app release notes for v2.1.212.
- Verification: JS syntax checks passed and `npm run smoke:tools` passed 6/6 with the existing better-sqlite3 Node ABI audit warning.
