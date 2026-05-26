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
