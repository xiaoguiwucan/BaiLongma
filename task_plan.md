# Task Plan: v2.1.212 Xiaozhi-style Wake Word Upgrade

## Goal
Continue the Xiaozhi-inspired voice optimization by shipping v2.1.212 with a stronger configurable wake-word gate: strict/loose modes, configurable command window, repeat/empty rejection, debug visibility, docs, GitHub backup, and Release assets.

## Current Phase
Phase 4

## Phases

### Phase 1: Discovery
- [x] Inspect current wake-word implementation and settings storage
- [x] Identify frontend/server config fields to extend
- **Status:** complete

### Phase 2: Implementation
- [x] Add wake mode/window/repeat suppression config to backend config
- [x] Upgrade frontend wake gate logic in voice panel
- [x] Add settings controls and persistence
- **Status:** complete

### Phase 3: Verification
- [x] Run syntax checks and targeted smoke checks
- [x] Log any known blockers
- **Status:** complete

### Phase 4: Version, Docs, Release
- [x] Bump version to 2.1.212
- [x] Update README / CHANGELOG / BACKUP / in-app release notes
- [ ] Commit, tag, push, create GitHub Release with source/bundle assets
- **Status:** in_progress

## Decisions Made
| Decision | Rationale |
|----------|-----------|
| Keep ASR provider behavior unchanged | v2.1.212 focuses on wake flow, not ASR replacement |
| Add strict/loose wake modes | User needs avoiding ordinary conversation/video false wakeups |
| Make wake command window configurable | Existing hardcoded 8s should be user-tunable |
| Add repeat suppression | The user previously saw repeated hallucinated phrases; wake gate should reject duplicates/noise more visibly |

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
| `npm run smoke:tools` logs `better-sqlite3` Node ABI warning under Node v24 | 1 | Smoke assertions still pass 6/6; record as existing local dependency rebuild warning |
