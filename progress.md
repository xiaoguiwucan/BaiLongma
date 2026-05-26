# Progress: v2.1.236 Voice Events Client Identity Hello

## 2026-05-26
- Resumed after v2.1.235 release; git worktree was clean on `main`.
- Inspected `src/voice/voice-event-bus.js`, `src/api.js`, and smoke tests.
- Found `/voice/events/status` lacks per-client identity, making hardware/debug client diagnostics difficult.
- Started v2.1.236 plan to add optional `client:hello` identity registration and status summaries.
- Added optional `client:hello` / `client:identify` messages and `client_identity` protocol capability.
- Added sanitized client identity storage and `client:accepted` acknowledgement.
- Added `/voice/events/status` `clientDetails` with identity and subscription summaries.
- Extended mapping smoke to 31 checks and voice-events smoke to 34 checks.
- Bumped version to 2.1.236 and updated README, CHANGELOG, BACKUP, protocol docs, and Brain UI release notes.
- Verification passed: JS syntax checks for touched protocol/API/smoke files.
- Verification passed: `npm run smoke:voice-mapping` 31/31.
- Verification passed: `npm run smoke:voice-events` 34/34.
- Verification passed: `npm run smoke:tools` 6/6. Known local Node v24 / better-sqlite3 ABI audit-log warning remains non-blocking.
