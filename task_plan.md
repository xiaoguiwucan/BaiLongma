# Task Plan: v2.1.232 Voice Event TTS Speak Safety Limits

## Goal
Continue the Xiaozhi-inspired voice optimization by shipping v2.1.232 with explicit `tts:speak` safety limits: maximum text length, per-connection cooldown, protocol metadata for those limits, structured `protocol_error` responses, tests, docs, UI notes, and GitHub Release assets.

## Current Phase
Verification complete; release in progress

## Phases

### Phase 1: Discovery
- [x] Confirm v2.1.231 clean baseline and release state
- [x] Inspect current `tts:speak` validation and WebSocket handler
- [x] Identify missing max length and rate limiting before LAN/hardware exposure
- **Status:** complete

### Phase 2: Implementation
- [x] Add shared `tts:speak` limit constants and metadata
- [x] Extend validation to reject overlong text
- [x] Add per-connection cooldown guard for `tts:speak`
- [x] Return structured `protocol_error` with retry/limit details
- **Status:** complete

### Phase 3: Tests, docs, UI notes
- [x] Extend pure smoke tests for max text length
- [x] Extend WebSocket smoke tests for too-long text and rate limit
- [x] Bump version to 2.1.232 and update README/CHANGELOG/BACKUP/protocol docs/UI notes
- **Status:** complete

### Phase 4: Verification and release
- [x] Run syntax checks and smoke tests
- [ ] Commit changes
- [ ] Tag and push v2.1.232
- [ ] Create source tarball and git bundle assets
- [ ] Create GitHub Release with detailed notes and upload assets
- **Status:** in_progress

## Decisions Made
| Decision | Rationale |
|----------|-----------|
| Keep protocol version 3 | Limits are backward-compatible validation behavior and do not change successful message shapes |
| Expose limits in `/voice/events/protocol` | External clients can self-adjust UI and avoid preventable errors |
| Use per-connection cooldown | Simple protection against accidental repeated speak from one device without introducing global auth/session complexity yet |

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
| None yet | - | - |
