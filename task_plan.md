# Task Plan: v2.1.236 Voice Events Client Identity Hello

## Goal
Continue the Xiaozhi-inspired voice optimization by shipping v2.1.236 with `/voice/events` external client identity registration. Clients can send `client:hello` / `client:identify` with device/app metadata; the server stores sanitized identity per connection, reports identity in status, acknowledges with `client:accepted`, and documents/tests the flow.

## Current Phase
Complete

## Phases

### Phase 1: Discovery
- [x] Confirm v2.1.235 clean baseline and release state
- [x] Inspect current voice event client handling and status
- [x] Identify missing per-client identity metadata for diagnostics and future pairing
- **Status:** complete

### Phase 2: Implementation
- [x] Add identity capability/client messages/protocol metadata
- [x] Sanitize and store client identity on WebSocket connection
- [x] Return `client:accepted` acknowledgement
- [x] Include client summaries in `/voice/events/status`
- **Status:** complete

### Phase 3: Tests, docs, UI notes
- [x] Extend mapping/status smoke tests for identity
- [x] Bump version to 2.1.236 and update README/CHANGELOG/BACKUP/protocol docs/UI release notes
- [x] Run syntax checks and smoke tests
- **Status:** complete

### Phase 4: GitHub release
- [x] Commit changes
- [x] Tag and push v2.1.236
- [x] Create source tarball and git bundle assets
- [x] Create GitHub Release with detailed notes and upload assets
- **Status:** complete

## Decisions Made
| Decision | Rationale |
|----------|-----------|
| Add identity before full pairing tokens | Gives immediate diagnostics and prepares schema for future per-device auth |
| Sanitize/truncate all client-provided strings | Prevents huge or unsafe metadata from entering status/history/logs |
| Keep identity optional | Existing clients remain compatible |

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
| None yet | - | - |
