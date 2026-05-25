# Task Plan: v2.1.228 Voice Events Full TTS Lifecycle Mapping Smoke

## Goal
Continue the Xiaozhi-inspired voice optimization by shipping v2.1.228 with smoke coverage for the full TTS lifecycle mapping over `/voice/events/publish`.

## Current Phase
Complete

## Phases

### Phase 1: Discovery
- [x] Inspect v2.1.227 wake/TTS audio-ready smoke coverage
- [x] Identify missing coverage: TTS start/sentence_start/sentence_end/stop mappings
- [x] Choose synthetic TTS lifecycle events that require no provider credentials
- **Status:** complete

### Phase 2: Implementation
- [x] Extend `scripts/smoke-voice-events.mjs`
- [x] Publish `tts:start`, `tts:sentence_start`, `tts:audio_ready`, `tts:sentence_end`, and `tts:stop`
- [x] Verify Xiaozhi-style TTS lifecycle mappings and key metadata fields
- **Status:** complete

### Phase 3: Version, Docs, UI Notes
- [x] Bump package version to 2.1.228
- [x] Update README, CHANGELOG, BACKUP document, and Brain UI release notes
- [x] Update progress/final verification log
- **Status:** complete

### Phase 4: Verification
- [x] Run JS syntax checks for touched files
- [x] Run `npm run smoke:voice-events`
- [x] Run `npm run smoke:tools`
- **Status:** complete

### Phase 5: GitHub Backup and Release
- [x] Commit changes
- [x] Tag `v2.1.228`
- [x] Push main and tag to GitHub
- [x] Create source tarball and Git bundle assets
- [x] Create GitHub Release with detailed notes and upload assets
- **Status:** complete

## Decisions Made
| Decision | Rationale |
|----------|-----------|
| Use synthetic TTS lifecycle events | Tests event mapping without relying on TTS provider credentials |
| Assert key fields per lifecycle state | External clients need sessionId/index/text/url/reason to manage playback queues |
| Keep test in `smoke:voice-events` | Centralizes protocol protection in one command |

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
| `npm run smoke:tools` logs `better-sqlite3` Node ABI warning under Node v24 | 1 | Smoke assertions pass 6/6; existing local dependency rebuild warning |
