# Task Plan: v2.1.217 Xiaozhi-style Voice Event Protocol

## Goal
Continue the Xiaozhi-inspired voice optimization by shipping v2.1.217 with a unified browser voice event bus and event protocol for wake/asr/tts/interrupt/media, docs, GitHub backup, and Release assets.

## Current Phase
Phase 4

## Phases

### Phase 1: Discovery
- [x] Inspect existing custom voice events and TTS/ASR hooks
- [x] Identify minimal event bus that preserves existing behavior
- **Status:** complete

### Phase 2: Implementation
- [x] Add browser-safe voice event bus/protocol module
- [x] Wire wake/ASR/speaker/media events from voice panel
- [x] Wire TTS session/segment/interrupt events from app playback
- **Status:** complete

### Phase 3: Verification
- [x] Run JS syntax checks and smoke checks
- [x] Log known blockers
- **Status:** complete

### Phase 4: Version, Docs, Release
- [x] Bump version to 2.1.217
- [x] Update README / CHANGELOG / BACKUP / in-app release notes
- [ ] Commit, tag, push, create GitHub Release with source/bundle assets
- **Status:** in_progress

## Decisions Made
| Decision | Rationale |
|----------|-----------|
| Add browser event bus first | Enables protocol/debugging before WebSocket device channel |
| Preserve existing DOM events | Avoid breaking current media duck and wake integrations |
| Use Xiaozhi-like namespaced event types | Makes future WS JSON protocol straightforward |

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
| `npm run smoke:tools` logs `better-sqlite3` Node ABI warning under Node v24 | 1 | Smoke assertions pass 6/6; existing local dependency rebuild warning |
