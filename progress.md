# Progress: v2.2.0 Major Voice Device Console

## 2026-05-26
- Resumed after v2.1.240 release.
- Verified current local package version is 2.1.240 and git worktree is clean.
- User clarified release cadence: make major updates, do not publish tiny releases for every small change.
- Started v2.2.0 milestone planning: first checkpoint is a Brain UI external voice client diagnostics panel backed by `/voice/events/clients`.
- Added Brain UI voice-tab external clients panel backed by `/voice/events/clients`.
- Panel shows connected count, audio subscribers, binary subscribers, refresh/autorefresh controls, empty/error states, and per-client cards.
- Client cards render identity, app/device/platform/version, capabilities, subscription state, lastSeenAt, and negotiated audio mode/reason.
- Added visual styling for the voice client console in `styles.css`.
- Extended brain-ui smoke mock with `/voice/events/clients` response and assertions for the client card, but current full browser smoke is blocked by pre-existing `#graph circle` timeout in this local environment before reaching the new assertions.
- Verification passed: `node --check src/ui/brain-ui/app.js`.
- Verification passed: `node --check src/ui/brain-ui/app-shell.js`.
- Verification passed: `node --check scripts/smoke-brain-ui.mjs`.
- Verification passed: `npm run smoke:voice-events` 41/41.
- Verification passed: `npm run smoke:voice-events-client` 8/8.
- Committed v2.2.0 development checkpoint as `380badf feat: add voice clients panel for v2.2.0`.
- Pushed checkpoint to GitHub main for backup only.
- No tag or GitHub Release created per user's major-release cadence request.
- Fixed Brain UI smoke root cause: unescaped backticks inside `app-shell.js` release notes broke the template literal and stopped `renderBrainUiApp()` before graph/client panel rendering.
- Updated brain-ui smoke static server to serve `/src/voice/*` module imports used by `voice-panel.js`.
- Updated brain-ui smoke to wait on rendered node-count stats instead of raw SVG circles, matching current graph rendering behavior.
- Added `/voice/local/start` and `/voice/local/status` mocks to the brain-ui smoke server.
- Verification passed: `npm run smoke:brain-ui` now completes and asserts voice clients panel renders `smoke-esp32` with binary negotiated mode.
- Verification passed again: `node --check src/ui/brain-ui/app.js`, `node --check src/ui/brain-ui/app-shell.js`, `node --check scripts/smoke-brain-ui.mjs`.
- Verification passed again: `npm run smoke:voice-events` 41/41 and `npm run smoke:voice-events-client` 8/8.
