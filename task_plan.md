# Task Plan: v2.1.235 Voice Events Remote Address TTS Speak Cooldown

## Goal
Continue the Xiaozhi-inspired voice optimization by shipping v2.1.235 with remote-address-level `tts:speak` cooldown for `/voice/events`, preventing a client from bypassing per-WebSocket cooldown by opening multiple connections. The change must be reflected in protocol metadata, tests, docs, UI release notes, and GitHub Release assets.

## Current Phase
Verification complete; release in progress

## Phases

### Phase 1: Discovery
- [x] Confirm v2.1.234 clean baseline and release state
- [x] Inspect current per-WebSocket cooldown implementation
- [x] Identify that multiple connections from same remote address can bypass the cooldown
- **Status:** complete

### Phase 2: Implementation
- [x] Add remote-address cooldown metadata to protocol limits
- [x] Track last `tts:speak` timestamp per normalized remote address
- [x] Apply both per-connection and per-remote cooldown in WebSocket handler
- [x] Clean up stale remote cooldown entries to avoid unbounded growth
- **Status:** complete

### Phase 3: Tests, docs, UI notes
- [x] Extend smoke tests for metadata and cross-connection rate limit
- [x] Bump version to 2.1.235 and update README/CHANGELOG/BACKUP/protocol docs/UI release notes
- [x] Run syntax checks and smoke tests
- **Status:** complete

### Phase 4: GitHub release
- [ ] Commit changes
- [ ] Tag and push v2.1.235
- [ ] Create source tarball and git bundle assets
- [ ] Create GitHub Release with detailed notes and upload assets
- **Status:** in_progress

## Decisions Made
| Decision | Rationale |
|----------|-----------|
| Use the same cooldownMs for per-connection and per-remote address | Keeps the UI/config simple while preventing multi-connection bypass |
| Report `scope` in rate_limited errors | Clients can distinguish `connection` vs `remote` throttling in logs |
| Keep protocol version 3 | This is backward-compatible validation metadata/behavior |

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
| None yet | - | - |
