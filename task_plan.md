# Task Plan: v2.1.229 Voice Event Mapping Pure Smoke

## Goal
Continue the Xiaozhi-inspired voice optimization by shipping v2.1.229 with an exported pure `mapVoiceEventToXiaozhi` function and a fast mapping smoke test that does not need to start the API server.

## Current Phase
Complete

## Phases

### Phase 1: Discovery
- [x] Inspect current `voice-event-bus.js` mapping function
- [x] Identify that mapping is only indirectly tested via WebSocket smoke
- [x] Choose to export the pure mapper and add a direct smoke script
- **Status:** complete

### Phase 2: Implementation
- [x] Export `mapVoiceEventToXiaozhi(event)`
- [x] Update internal callers to use the exported mapper
- [x] Add `scripts/smoke-voice-mapping.mjs`
- [x] Add `npm run smoke:voice-mapping`
- [x] Cover 13 core mapping cases
- **Status:** complete

### Phase 3: Version, Docs, UI Notes
- [x] Bump package version to 2.1.229
- [x] Update README, CHANGELOG, BACKUP document, and Brain UI release notes
- [x] Update progress/final verification log
- **Status:** complete

### Phase 4: Verification
- [x] Run JS syntax checks for touched files
- [x] Run `npm run smoke:voice-mapping`
- [x] Run `npm run smoke:voice-events`
- [x] Run `npm run smoke:tools`
- **Status:** complete

### Phase 5: GitHub Backup and Release
- [x] Commit changes
- [x] Tag `v2.1.229`
- [x] Push main and tag to GitHub
- [x] Create source tarball and Git bundle assets
- [x] Create GitHub Release with detailed notes and upload assets
- **Status:** complete

## Decisions Made
| Decision | Rationale |
|----------|-----------|
| Export the mapper instead of duplicating mapping in tests | Prevents test logic from diverging from runtime logic |
| Keep WebSocket smoke too | Pure smoke is fast, WebSocket smoke still protects integration/broadcast path |
| Include null/unknown cases | Protects graceful behavior for unsupported events |

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
| `npm run smoke:tools` logs `better-sqlite3` Node ABI warning under Node v24 | 1 | Smoke assertions pass 6/6; existing local dependency rebuild warning |
