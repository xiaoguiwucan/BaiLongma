# Progress: v2.1.234 Voice Events Optional Token Authentication

## 2026-05-26
- Resumed after v2.1.233 release; git worktree was clean on `main`.
- Inspected `src/api.js` access helpers and WebSocket upgrade handler.
- Found `/acui` uses origin/access checks but `/voice/events` does not.
- Started v2.1.234 plan to add optional token authentication metadata and upgrade enforcement for `/voice/events`.
- Added auth metadata to `getVoiceEventsProtocolMetadata()` and WebSocket hello.
- Added `/voice/events` WebSocket upgrade origin/access checks matching `/acui` behavior.
- Reused existing `BAILONGMA_API_TOKEN` Bearer/query token access helper without exposing token in protocol metadata.
- Extended mapping smoke to 27 checks and voice-events smoke to 29 checks.
- Bumped version to 2.1.234 and updated README, CHANGELOG, BACKUP, protocol docs, and Brain UI release notes.
- Verification passed: JS syntax checks for touched protocol/API/smoke files.
- Verification passed: `npm run smoke:voice-mapping` 27/27.
- Verification passed: `npm run smoke:voice-events` 29/29.
- Verification passed: `npm run smoke:tools` 6/6. Known local Node v24 / better-sqlite3 ABI audit-log warning remains non-blocking.
