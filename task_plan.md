# Task Plan: v2.1.215 ASR Provider Refactor

## Goal
Continue the Xiaozhi-inspired voice optimization by shipping v2.1.215 with clearer ASR provider abstraction and recognition profiles: provider metadata, local engine/model normalization, speed/balanced/accuracy profiles, settings UI, docs, GitHub backup, and Release assets.

## Current Phase
Phase 4

## Phases

### Phase 1: Discovery
- [x] Inspect current ASR manager/config/API/UI structure
- [x] Identify minimal provider abstraction that preserves existing behavior
- **Status:** complete

### Phase 2: Implementation
- [x] Add ASR provider metadata module
- [x] Update manager/config/API to expose profiles and engines
- [x] Add settings controls for recognition profile and clearer provider labels
- **Status:** complete

### Phase 3: Verification
- [x] Run JS syntax checks and smoke checks
- [x] Log known blockers
- **Status:** complete

### Phase 4: Version, Docs, Release
- [x] Bump version to 2.1.215
- [x] Update README / CHANGELOG / BACKUP / in-app release notes
- [ ] Commit, tag, push, create GitHub Release with source/bundle assets
- **Status:** in_progress

## Decisions Made
| Decision | Rationale |
|----------|-----------|
| Keep SenseVoiceSmall default | Existing user preference: Chinese-first, fast, local |
| Add profiles without swapping model automatically | Safer than changing runtime model unexpectedly; profile prepares future tuning |
| Expose provider metadata via status/config | Helps future Sherpa/FunASR provider additions and UI clarity |

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
| `npm run smoke:tools` logs `better-sqlite3` Node ABI warning under Node v24 | 1 | Smoke assertions pass 6/6; existing local dependency rebuild warning |
