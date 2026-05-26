# Task Plan: v2.1.240 Voice Events Clients Diagnostics Endpoint

## Goal
Continue the Xiaozhi-inspired voice server work by adding a focused `/voice/events/clients` diagnostics endpoint, so external devices and the Brain UI/debug tools can inspect connected clients, identities, subscriptions, capabilities, and negotiated audio mode without parsing the broader status payload.

## Current Phase
Complete

## Phases

### Phase 1: Discovery
- [x] Confirm v2.1.239 clean baseline and GitHub release state
- [x] Inspect current status/protocol endpoints and bus status shape
- [x] Choose next aligned feature: focused connected-client diagnostics
- **Status:** complete

### Phase 2: Implementation
- [x] Add `/voice/events/clients` endpoint to protocol metadata and API router
- [x] Add safe `getVoiceEventClientDetails()` helper with negotiated audio details
- [x] Preserve existing `/voice/events/status` shape while reusing helper
- **Status:** complete

### Phase 3: Tests, docs, UI notes
- [x] Extend smoke tests and protocol mapping checks
- [x] Bump version to 2.1.240 and update README/CHANGELOG/BACKUP/protocol docs/UI release notes
- [x] Run syntax checks and smoke suites
- **Status:** complete

### Phase 4: GitHub release
- [x] Commit changes
- [x] Tag and push v2.1.240
- [x] Create source tarball and git bundle assets
- [x] Create GitHub Release with detailed notes and upload assets
- **Status:** complete

## Decisions Made
| Decision | Rationale |
|----------|-----------|
| Add a focused endpoint instead of expanding only status | Easier for ESP32 bridges, mobile clients, and UI diagnostics to consume safely |
| Return negotiated audio alongside identity/subscription | Makes v2.1.239 audio negotiation visible after the handshake |

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
| None yet | - | - |

## Release Cadence Update
- User requested larger updates instead of releasing every small change. Future work should be accumulated into a larger milestone release, such as v2.2.0, unless a hotfix is necessary.
