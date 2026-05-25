# Task Plan: v2.1.213 Voiceprint Stability Upgrade

## Goal
Continue the Xiaozhi-inspired voice optimization by shipping v2.1.213 with more stable local voiceprint recognition: multi-sample enrollment, enrollment quality/calibration feedback, speaker self-test, settings UI, docs, GitHub backup, and Release assets.

## Current Phase
Phase 4

## Phases

### Phase 1: Discovery
- [x] Inspect current SenseVoice speaker verification code
- [x] Inspect current settings enrollment UI
- **Status:** complete

### Phase 2: Implementation
- [x] Store multi-sample voiceprint centroids and metadata
- [x] Add speaker test/status protocol
- [x] Add settings UI for voiceprint self-test and calibration feedback
- **Status:** complete

### Phase 3: Verification
- [x] Run Python compile and JS syntax checks
- [x] Run targeted smoke checks
- **Status:** complete

### Phase 4: Version, Docs, Release
- [x] Bump version to 2.1.213
- [x] Update README / CHANGELOG / BACKUP / in-app release notes
- [ ] Commit, tag, push, create GitHub Release with source/bundle assets
- **Status:** in_progress

## Decisions Made
| Decision | Rationale |
|----------|-----------|
| Keep resemblyzer backend for now | Avoid large new model dependency; improve stability with sampling/calibration first |
| Store centroid plus sample count | More robust than one embedding from one recording |
| Add self-test before further model swaps | User needs to know whether current threshold rejects their voice |

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
| `npm run smoke:tools` logs `better-sqlite3` Node ABI warning under Node v24 | 1 | Smoke assertions pass 6/6; existing local dependency rebuild warning |
