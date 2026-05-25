# Task Plan: v2.1.234 Voice Events Optional Token Authentication

## Goal
Continue the Xiaozhi-inspired voice optimization by shipping v2.1.234 with optional token authentication metadata and enforcement for `/voice/events`, so LAN/external clients can use the existing `BAILONGMA_API_TOKEN` mechanism instead of leaving the voice WebSocket unauthenticated.

## Current Phase
Verification complete; release in progress

## Phases

### Phase 1: Discovery
- [x] Confirm v2.1.233 clean baseline and release state
- [x] Inspect API access helpers and WebSocket upgrade handling
- [x] Identify `/voice/events` upgrade lacks the same access guard as `/acui`
- **Status:** complete

### Phase 2: Implementation
- [x] Add auth metadata to voice events protocol response and hello
- [x] Enforce origin/access checks for `/voice/events` WebSocket upgrade
- [x] Reuse existing `BAILONGMA_API_TOKEN` Bearer/query token behavior
- [x] Keep localhost developer usage working without token
- **Status:** complete

### Phase 3: Tests, docs, UI notes
- [x] Extend smoke tests for auth metadata and query-token WebSocket connection
- [x] Bump version to 2.1.234 and update README/CHANGELOG/BACKUP/protocol docs/UI release notes
- [x] Run syntax checks and smoke tests
- **Status:** complete

### Phase 4: GitHub release
- [ ] Commit changes
- [ ] Tag and push v2.1.234
- [ ] Create source tarball and git bundle assets
- [ ] Create GitHub Release with detailed notes and upload assets
- **Status:** in_progress

## Decisions Made
| Decision | Rationale |
|----------|-----------|
| Reuse `BAILONGMA_API_TOKEN` | Avoids inventing another token mechanism and aligns HTTP settings/admin security behavior |
| Allow localhost without token | Keeps local Electron/dev workflow unchanged |
| Advertise auth metadata without exposing token | Clients need to know how to authenticate, but never receive the secret itself |

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
| None yet | - | - |
