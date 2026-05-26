# Progress: v2.1.237 Voice Events Client Capabilities and Last-Seen Diagnostics

## 2026-05-26
- Resumed after v2.1.236 release; git worktree was clean on `main`.
- Inspected voice event identity/status implementation.
- Found status now has identity but lacks client-declared capabilities and last-seen diagnostics.
- Started v2.1.237 plan to add safe capabilities and `lastSeenAt` tracking.
- Added client capability metadata examples to `/voice/events/protocol`.
- Added capability sanitization, dedupe, lowercasing, and max-count protection for `client:hello`.
- Added `lastSeenAt` refresh for ping, identify, subscribe, and unsubscribe control messages.
- Extended mapping smoke to 33 checks and voice-events smoke to 37 checks.
- Bumped version to 2.1.237 and updated README, CHANGELOG, BACKUP, protocol docs, and Brain UI release notes.
- Verification passed: JS syntax checks for touched protocol/smoke files.
- Verification passed: `npm run smoke:voice-mapping` 33/33.
- Verification passed: `npm run smoke:voice-events` 37/37.
- Verification passed: `npm run smoke:tools` 6/6. Known local Node v24 / better-sqlite3 ABI audit-log warning remains non-blocking.
