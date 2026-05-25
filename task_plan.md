# Task Plan: v2.1.221 WebSocket TTS Speak Request

## Goal
Continue the Xiaozhi-inspired voice optimization by shipping v2.1.221 with direct WebSocket `tts:speak` requests over `/voice/events`, allowing external clients to send text and receive sentence lifecycle events plus audio chunks without depending on Brain UI playback.

## Current Phase
Complete

## Phases

### Phase 1: Discovery
- [x] Inspect v2.1.220 opt-in audio chunk broadcast path
- [x] Identify limitation: audio chunks are mirrored only when HTTP segment playback is triggered
- [x] Choose single-client `tts:speak` path that reuses existing TTS provider config and sentence splitter
- **Status:** complete

### Phase 2: Implementation
- [x] Upgrade voice event WebSocket hello to version 3 and add `tts_speak` capability
- [x] Add helpers for per-client JSON events and per-client audio chunks
- [x] Add `tts:speak` / `speak` WebSocket message handling
- [x] Create TTS session from WebSocket text request and stream each segment back to the requester
- [x] Preserve Brain UI and HTTP TTS paths
- **Status:** complete

### Phase 3: Version, Docs, UI Notes
- [x] Bump package version to 2.1.221
- [x] Update README, CHANGELOG, BACKUP document, and Brain UI release notes
- [x] Update progress/final verification log
- **Status:** complete

### Phase 4: Verification
- [x] Run JS syntax checks for touched files
- [x] Run `npm run smoke:tools`
- **Status:** complete

### Phase 5: GitHub Backup and Release
- [x] Commit changes
- [x] Tag `v2.1.221`
- [x] Push main and tag to GitHub
- [x] Create source tarball and Git bundle assets
- [x] Create GitHub Release with detailed notes and upload assets
- **Status:** complete

## Decisions Made
| Decision | Rationale |
|----------|-----------|
| Reuse `createTTSSession` and `streamTTSSegment` | Avoid duplicating provider logic and keep Brain UI/WS behavior consistent |
| Send `tts:speak` audio only to the requester | Prevent one client request from unexpectedly broadcasting private audio to all subscribed clients |
| Temporarily force requester audio on during speak and restore previous options afterward | Ensures speak always returns audio while preserving client preferences |
| Keep output as `audio/mpeg` for now | Current providers return MP3-like streams; Opus conversion is future work |

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
| `npm run smoke:tools` logs `better-sqlite3` Node ABI warning under Node v24 | 1 | Smoke assertions pass 6/6; existing local dependency rebuild warning |
