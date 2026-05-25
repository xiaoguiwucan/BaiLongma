# Task Plan: v2.1.214 Video Voice Robustness Upgrade

## Goal
Continue the Xiaozhi-inspired voice optimization by shipping v2.1.214 with better video playback anti-interference: configurable duck volume/hold time, stronger near-field confirmation, visible media-duck status, docs, GitHub backup, and Release assets.

## Current Phase
Phase 4

## Phases

### Phase 1: Discovery
- [x] Inspect current video duck/PTT/AEC implementation
- [x] Identify settings and media-layer changes
- **Status:** complete

### Phase 2: Implementation
- [x] Add configurable media duck level and hold time
- [x] Strengthen near-field voice confirmation before media duck
- [x] Surface media-duck status in UI/debug events
- **Status:** complete

### Phase 3: Verification
- [x] Run JS syntax checks and smoke checks
- [x] Log known blockers
- **Status:** complete

### Phase 4: Version, Docs, Release
- [x] Bump version to 2.1.214
- [x] Update README / CHANGELOG / BACKUP / in-app release notes
- [ ] Commit, tag, push, create GitHub Release with source/bundle assets
- **Status:** in_progress

## Decisions Made
| Decision | Rationale |
|----------|-----------|
| Keep current AEC/PTT toggles | Already useful and user wanted features can be combined |
| Add tuning controls before platform-specific system audio control | Safer for Electron and works for local video/YouTube/Bilibili fallback |
| Confirm near-field across multiple frames | Avoid ducking video for one-frame spikes or explosions |

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
| `npm run smoke:tools` logs `better-sqlite3` Node ABI warning under Node v24 | 1 | Smoke assertions pass 6/6; existing local dependency rebuild warning |
