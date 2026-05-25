# Task Plan: v2.1.231 Voice Event Client Message Validation

## Goal
Continue the Xiaozhi-inspired voice optimization by shipping v2.1.231 with explicit WebSocket client message validation and structured protocol error replies, so external clients get clear feedback for bad JSON, missing `type`, unsupported message types, and invalid `tts:speak` payloads.

## Current Phase
Verification complete; release in progress

## Phases

### Phase 1: Discovery
- [x] Inspect v2.1.230 clean baseline and release state
- [x] Inspect `/voice/events` WebSocket message handling
- [x] Identify missing validation/error replies for malformed/unsupported client messages
- **Status:** complete

### Phase 2: Implementation
- [x] Add shared client message validation helpers in `src/voice/voice-event-bus.js`
- [x] Use validation in `/voice/events` WebSocket handling in `src/api.js`
- [x] Keep existing ping/subscribe/unsubscribe/tts:speak/tts:cancel behavior compatible
- **Status:** complete

### Phase 3: Tests, docs, UI notes
- [x] Extend pure smoke coverage for validation helper
- [x] Extend WebSocket smoke coverage for invalid JSON, unsupported type, invalid speak text
- [x] Bump version to 2.1.231 and update README/CHANGELOG/BACKUP/docs/UI notes
- **Status:** complete

### Phase 4: Verification and release
- [x] Run syntax checks and smoke tests
- [ ] Commit changes
- [ ] Tag and push v2.1.231
- [ ] Create source tarball and git bundle assets
- [ ] Create GitHub Release with detailed notes and upload assets
- **Status:** in_progress

## Decisions Made
| Decision | Rationale |
|----------|-----------|
| Validate external messages at the WebSocket boundary | Prevents silent failures and makes ESP32/debug client integration easier to diagnose |
| Return structured `protocol_error` JSON instead of closing immediately | Keeps clients connected and gives them actionable feedback |
| Preserve protocol version 3 | Validation is backward-compatible and does not change successful message shapes |

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
| None yet | - | - |
