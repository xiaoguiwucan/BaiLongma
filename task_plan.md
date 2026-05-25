# Task Plan: v2.1.226 Voice Events Publish Mapping Smoke

## Goal
Continue the Xiaozhi-inspired voice optimization by shipping v2.1.226 with expanded `/voice/events` smoke coverage for the HTTP publish bridge and Xiaozhi-style event mapping.

## Current Phase
Verification complete; release in progress

## Phases

### Phase 1: Discovery
- [x] Inspect v2.1.225 smoke coverage
- [x] Identify missing coverage: `POST /voice/events/publish` bridge and event mapping
- [x] Choose deterministic `asr:final` event because it does not require TTS credentials
- **Status:** complete

### Phase 2: Implementation
- [x] Extend `scripts/smoke-voice-events.mjs`
- [x] Publish `asr:final` through HTTP `/voice/events/publish`
- [x] Verify WebSocket receives raw `voice_event`
- [x] Verify WebSocket receives Xiaozhi-style `stt final` mapping
- **Status:** complete

### Phase 3: Version, Docs, UI Notes
- [x] Bump package version to 2.1.226
- [x] Update README, CHANGELOG, BACKUP document, and Brain UI release notes
- [x] Update progress/final verification log
- **Status:** complete

### Phase 4: Verification
- [x] Run JS syntax checks for touched files
- [x] Run `npm run smoke:voice-events`
- [x] Run `npm run smoke:tools`
- **Status:** complete

### Phase 5: GitHub Backup and Release
- [ ] Commit changes
- [ ] Tag `v2.1.226`
- [ ] Push main and tag to GitHub
- [ ] Create source tarball and Git bundle assets
- [ ] Create GitHub Release with detailed notes and upload assets
- **Status:** pending

## Decisions Made
| Decision | Rationale |
|----------|-----------|
| Use `asr:final` for publish smoke | Deterministic and does not require ASR/TTS provider credentials |
| Assert both raw and mapped messages | Protects external clients that consume either protocol layer |
| Keep publish test in same temporary API server | Avoid needing an already-running desktop app |

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
| `npm run smoke:tools` logs `better-sqlite3` Node ABI warning under Node v24 | 1 | Smoke assertions pass 6/6; existing local dependency rebuild warning |
