# Task Plan: v2.1.239 Voice Events Audio Capability Negotiation

## Goal
Continue the Xiaozhi-inspired voice server work by adding explicit audio capability negotiation to `/voice/events`, so ESP32-style clients that declare `binary_audio` or `base64_audio` receive a clear negotiated recommendation without changing old client behavior.

## Current Phase
GitHub release

## Phases

### Phase 1: Discovery
- [x] Confirm v2.1.238 clean baseline and GitHub release state
- [x] Inspect protocol metadata, client identity handling, and smoke coverage
- [x] Choose next aligned feature: capability-based negotiated audio mode
- **Status:** complete

### Phase 2: Implementation
- [x] Add protocol capability and metadata for audio negotiation
- [x] Compute negotiated audio mode from sanitized client capabilities
- [x] Return negotiation details in `client:accepted`
- [x] Keep subscribe behavior backward-compatible unless client explicitly subscribes
- **Status:** complete

### Phase 3: Tests, docs, UI notes
- [x] Extend smoke tests and pure mapping/protocol checks
- [x] Bump version to 2.1.239 and update README/CHANGELOG/BACKUP/protocol docs/UI release notes
- [x] Run syntax checks and smoke suites
- **Status:** complete

### Phase 4: GitHub release
- [ ] Commit changes
- [ ] Tag and push v2.1.239
- [ ] Create source tarball and git bundle assets
- [ ] Create GitHub Release with detailed notes and upload assets
- **Status:** pending

## Decisions Made
| Decision | Rationale |
|----------|-----------|
| Negotiate but do not auto-subscribe audio in this step | Safer for existing clients; makes capability outcome explicit without unexpected audio traffic |
| Prefer binary over base64 when both are declared | Binary is lower overhead and closer to hardware streaming patterns |

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
| None yet | - | - |
