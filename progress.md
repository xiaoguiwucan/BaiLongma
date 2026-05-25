# Progress: v2.1.230 Voice Events Protocol Metadata

## 2026-05-26
- Resumed from released v2.1.229 baseline with uncommitted v2.1.230 WIP.
- Inspected current WIP diff: protocol constants and `getVoiceEventsProtocolMetadata()` were added to `src/voice/voice-event-bus.js`.
- Confirmed WebSocket hello now spreads protocol metadata, and status uses `VOICE_EVENTS_PROTOCOL_VERSION`.
- Confirmed `src/api.js` adds `GET /voice/events/protocol` returning `{ ok: true, ...metadata }`.
- Confirmed `scripts/smoke-voice-mapping.mjs` checks protocol metadata and `scripts/smoke-voice-events.mjs` checks the running HTTP endpoint.
- Ran syntax checks for touched protocol/API/smoke files successfully.
- Bumped `package.json` and `package-lock.json` to 2.1.230.
- Updated README current version and recent version summary.
- Updated CHANGELOG with detailed v2.1.230 update content, reason, impact, verification, and deployment notes.
- Updated BACKUP-2026-05-26.md current version and current-state description.
- Added v2.1.230 release note card to Brain UI Settings -> Update notes.
- Verification passed: `npm run smoke:voice-mapping` 15/15.
- Verification passed: `npm run smoke:voice-events` 17/17.
- Verification passed: `npm run smoke:tools` 6/6. Known local Node v24 / better-sqlite3 ABI audit-log warning remains non-blocking.
