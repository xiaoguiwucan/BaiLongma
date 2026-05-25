# Task Plan: v2.1.220 WebSocket TTS Audio Chunk Subscription

## Goal
Continue the Xiaozhi-inspired voice optimization by shipping v2.1.220 with optional WebSocket TTS audio chunk subscription on top of the existing `/voice/events` JSON lifecycle channel, then back it up to GitHub with detailed docs and Release assets.

## Current Phase
Verification complete; release in progress

## Phases

### Phase 1: Discovery
- [x] Inspect current v2.1.219 audio_ready URL metadata flow
- [x] Inspect `/voice/events` WebSocket client message handling
- [x] Choose explicit opt-in audio chunk subscription to avoid breaking JSON-only clients
- **Status:** complete

### Phase 2: Implementation
- [x] Add per-client WebSocket subscription options
- [x] Add `subscribe` / `unsubscribe` handling for TTS audio chunks
- [x] Broadcast `audio_start`, `audio_chunk`, `audio_end`, and `audio_error` around TTS segment streaming
- [x] Support base64 JSON chunks by default and binary chunks when `binaryAudio=true`
- [x] Expose subscriber counts in `/voice/events/status`
- **Status:** complete

### Phase 3: Version, Docs, UI Notes
- [x] Bump package version to 2.1.220
- [x] Update README, CHANGELOG, BACKUP document, and Brain UI release notes
- [x] Update progress/final verification log
- **Status:** complete

### Phase 4: Verification
- [x] Run JS syntax checks for touched files
- [x] Run `npm run smoke:tools`
- **Status:** complete

### Phase 5: GitHub Backup and Release
- [ ] Commit changes
- [ ] Tag `v2.1.220`
- [ ] Push main and tag to GitHub
- [ ] Create source tarball and Git bundle assets
- [ ] Create GitHub Release with detailed notes and upload assets
- **Status:** pending

## Decisions Made
| Decision | Rationale |
|----------|-----------|
| Audio chunks are opt-in | Preserve existing JSON-only debug clients and avoid unexpected bandwidth use |
| Base64 JSON default, binary optional | Base64 is easiest to debug; binary is closer to future Opus/audio-frame protocol |
| Broadcast chunks while serving existing HTTP segment | Reuses provider stream without adding a new synthesis path |
| Keep contentType as `audio/mpeg` | Current TTS providers return MP3-style audio; Opus can be a later protocol version |

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
| `npm run smoke:tools` logs `better-sqlite3` Node ABI warning under Node v24 | 1 | Smoke assertions pass 6/6; existing local dependency rebuild warning |
