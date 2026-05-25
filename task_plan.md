# Task Plan: v2.1.219 TTS Audio Segment Events

## Goal
Continue the Xiaozhi-inspired voice optimization by shipping v2.1.219 with TTS audio segment metadata events over the existing `/voice/events` WebSocket channel, then back it up to GitHub with detailed docs and Release assets.

## Current Phase
Complete

## Phases

### Phase 1: Discovery
- [x] Inspect current v2.1.218 voice event WebSocket channel
- [x] Inspect current sentence-level TTS playback flow
- [x] Choose low-risk audio metadata URL event before binary Opus frames
- **Status:** complete

### Phase 2: Implementation
- [x] Add `tts:audio_ready` voice event type
- [x] Emit audio segment URL metadata before each frontend segment fetch
- [x] Map `tts:audio_ready` to Xiaozhi-style WebSocket JSON
- **Status:** complete

### Phase 3: Version, Docs, UI Notes
- [x] Bump package version to 2.1.219
- [x] Update README, CHANGELOG, BACKUP document, and Brain UI release notes
- [x] Update progress/final verification log
- **Status:** complete

### Phase 4: Verification
- [x] Run JS syntax checks for touched files
- [x] Run `npm run smoke:tools`
- **Status:** complete

### Phase 5: GitHub Backup and Release
- [x] Commit changes
- [x] Tag `v2.1.219`
- [x] Push main and tag to GitHub
- [x] Create source tarball and Git bundle assets
- [x] Create GitHub Release with detailed notes and upload assets
- **Status:** complete

## Decisions Made
| Decision | Rationale |
|----------|-----------|
| Use `tts:audio_ready` metadata before binary frames | External clients can pull audio now without changing provider/player internals |
| Use relative `url` plus raw `absoluteUrl` in original event detail | Relative URL is safer for LAN host rewriting; absolute URL is convenient for local debug |
| Preserve existing `/tts/session/:id/audio/:index` endpoint | Avoid duplicate audio storage or caching complexity |

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
| `npm run smoke:tools` logs `better-sqlite3` Node ABI warning under Node v24 | 1 | Smoke assertions pass 6/6; existing local dependency rebuild warning |
