# Task Plan: v2.1.237 Voice Events Client Capabilities and Last-Seen Diagnostics

## Goal
Continue the Xiaozhi-inspired voice optimization by shipping v2.1.237 with richer external client diagnostics: `client:hello` can declare capabilities, server sanitizes/stores them, status reports capabilities and `lastSeenAt`, and common messages update client last-seen timestamps.

## Current Phase
Verification complete; release in progress

## Phases

### Phase 1: Discovery
- [x] Confirm v2.1.236 clean baseline and release state
- [x] Inspect client identity storage and status details
- [x] Identify missing capability declaration and last-seen diagnostics
- **Status:** complete

### Phase 2: Implementation
- [x] Add capability sanitization and protocol metadata field
- [x] Store capabilities from `client:hello` / `client:identify`
- [x] Track `lastSeenAt` for ping/identify/subscribe/unsubscribe and status
- [x] Include safe capabilities in `client:accepted` and `/voice/events/status`
- **Status:** complete

### Phase 3: Tests, docs, UI notes
- [x] Extend smoke tests for capability and lastSeenAt diagnostics
- [x] Bump version to 2.1.237 and update README/CHANGELOG/BACKUP/protocol docs/UI release notes
- [x] Run syntax checks and smoke tests
- **Status:** complete

### Phase 4: GitHub release
- [ ] Commit changes
- [ ] Tag and push v2.1.237
- [ ] Create source tarball and git bundle assets
- [ ] Create GitHub Release with detailed notes and upload assets
- **Status:** in_progress

## Decisions Made
| Decision | Rationale |
|----------|-----------|
| Keep capabilities as a small string array | Easy for ESP32/debug clients and safe for status output |
| Update `lastSeenAt` on lightweight control messages | Provides useful activity diagnostics without logging every audio chunk |
| Clamp capabilities count/length | Prevents client metadata abuse |

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
| None yet | - | - |
