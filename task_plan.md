# Task Plan: v2.1.224 Voice Events Protocol Documentation

## Goal
Continue the Xiaozhi-inspired voice optimization by shipping v2.1.224 with a formal `/voice/events` protocol document for external device, phone, and debug-client integration.

## Current Phase
Verification complete; release in progress

## Phases

### Phase 1: Discovery
- [x] Inspect current `/voice/events` protocol features and CLI debug client
- [x] Identify missing artifact: stable protocol documentation for external clients
- [x] Choose a dedicated Markdown document under `docs/`
- **Status:** complete

### Phase 2: Implementation
- [x] Add `docs/VOICE_EVENTS_PROTOCOL.md`
- [x] Document endpoint, status API, hello/version/capabilities, heartbeat
- [x] Document JSON events, Xiaozhi-style mappings, audio chunks, `tts:speak`, and `tts:cancel`
- [x] Document CLI examples, client implementation advice, and known limitations
- **Status:** complete

### Phase 3: Version, Docs, UI Notes
- [x] Bump package version to 2.1.224
- [x] Update README, CHANGELOG, BACKUP document, and Brain UI release notes
- [x] Update progress/final verification log
- **Status:** complete

### Phase 4: Verification
- [x] Check protocol document content
- [x] Run CLI syntax/help checks
- [x] Run `npm run smoke:tools`
- **Status:** complete

### Phase 5: GitHub Backup and Release
- [ ] Commit changes
- [ ] Tag `v2.1.224`
- [ ] Push main and tag to GitHub
- [ ] Create source tarball and Git bundle assets
- [ ] Create GitHub Release with detailed notes and upload assets
- **Status:** pending

## Decisions Made
| Decision | Rationale |
|----------|-----------|
| Put protocol docs in `docs/VOICE_EVENTS_PROTOCOL.md` | Stable path for hardware/mobile developers and Release references |
| Document current `audio/mpeg` limitation explicitly | Avoid confusing current MP3-like chunks with future Opus frames |
| Include CLI examples in protocol docs | Makes documentation immediately verifiable on the developer's Mac |
| Include client implementation advice | Helps future ESP32/mobile clients handle binary frames, queues, and cancellation correctly |

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
| `npm run smoke:tools` logs `better-sqlite3` Node ABI warning under Node v24 | 1 | Smoke assertions pass 6/6; existing local dependency rebuild warning |
