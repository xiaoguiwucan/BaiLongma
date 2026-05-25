# Task Plan: v2.1.218 Experimental Voice WebSocket Channel

## Goal
Continue the Xiaozhi-inspired voice optimization by shipping v2.1.218 with an experimental WebSocket voice event channel that broadcasts Xiaozhi-style JSON lifecycle events to external clients, docs, GitHub backup, and Release assets.

## Current Phase
Phase 4

## Phases

### Phase 1: Discovery
- [x] Inspect current HTTP/WebSocket upgrade structure
- [x] Identify low-risk bridge from browser voice events to backend WebSocket clients
- **Status:** complete

### Phase 2: Implementation
- [x] Add backend voice event broadcaster and `/voice/events` WebSocket endpoint
- [x] Add frontend bridge that forwards `bailongma:voice-event` to backend
- [x] Map internal events to Xiaozhi-like JSON messages
- **Status:** complete

### Phase 3: Verification
- [x] Run JS syntax checks and smoke checks
- [x] Log known blockers
- **Status:** complete

### Phase 4: Version, Docs, Release
- [x] Bump version to 2.1.218
- [x] Update README / CHANGELOG / BACKUP / in-app release notes
- [ ] Commit, tag, push, create GitHub Release with source/bundle assets
- **Status:** in_progress

## Decisions Made
| Decision | Rationale |
|----------|-----------|
| Implement JSON event channel before binary audio frames | Safer experimental step and matches v2.1.217 event bus |
| Use frontend bridge POST to backend | Existing voice events are browser-side; backend cannot directly observe DOM events |
| Preserve current ASR/TTS playback | This version only exposes events to external clients |

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
| `npm run smoke:tools` logs `better-sqlite3` Node ABI warning under Node v24 | 1 | Smoke assertions pass 6/6; existing local dependency rebuild warning |
