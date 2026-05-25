# Task Plan: v2.1.216 Sentence TTS Session

## Goal
Continue the Xiaozhi-inspired voice optimization by shipping v2.1.216 with sentence-level TTS: Chinese sentence splitter, TTS session manager, segment audio API, frontend playback queue, cancellation/old-session guard, docs, GitHub backup, and Release assets.

## Current Phase
Phase 4

## Phases

### Phase 1: Discovery
- [x] Inspect current `/tts/stream` API and frontend `playTTSReply`
- [x] Identify minimal queue/session design preserving current providers
- **Status:** complete

### Phase 2: Implementation
- [x] Add sentence splitter and TTS session manager
- [x] Add TTS session API endpoints
- [x] Replace frontend full-blob single playback with segment queue and cancellation
- **Status:** complete

### Phase 3: Verification
- [x] Run JS syntax checks and smoke checks
- [x] Log known blockers
- **Status:** complete

### Phase 4: Version, Docs, Release
- [x] Bump version to 2.1.216
- [x] Update README / CHANGELOG / BACKUP / in-app release notes
- [ ] Commit, tag, push, create GitHub Release with source/bundle assets
- **Status:** in_progress

## Decisions Made
| Decision | Rationale |
|----------|-----------|
| Keep existing TTS providers | Avoid provider regression; improve orchestration first |
| Segment on punctuation and play queued blobs | Fastest reliable Electron/browser implementation before MediaSource/Opus |
| Add session id and cancel guard | Prevent old audio from playing after interruption/new reply |

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
| `npm run smoke:tools` logs `better-sqlite3` Node ABI warning under Node v24 | 1 | Smoke assertions pass 6/6; existing local dependency rebuild warning |
