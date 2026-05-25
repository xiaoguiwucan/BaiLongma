# Task Plan: v2.1.227 Voice Events Wake/TTS Mapping Smoke

## Goal
Continue the Xiaozhi-inspired voice optimization by shipping v2.1.227 with expanded `/voice/events` publish smoke coverage for wake and TTS audio-ready mappings.

## Current Phase
Verification complete; release in progress

## Phases

### Phase 1: Discovery
- [x] Inspect v2.1.226 publish mapping smoke
- [x] Identify missing coverage: wake accepted and TTS audio-ready mapping
- [x] Choose deterministic publish events that require no ASR/TTS credentials
- **Status:** complete

### Phase 2: Implementation
- [x] Extend `scripts/smoke-voice-events.mjs`
- [x] Publish `wake:accepted` through HTTP `/voice/events/publish`
- [x] Publish `tts:audio_ready` through HTTP `/voice/events/publish`
- [x] Verify Xiaozhi-style `wake accepted` mapping
- [x] Verify Xiaozhi-style `tts audio_ready` mapping with `sessionId/url/contentType`
- **Status:** complete

### Phase 3: Version, Docs, UI Notes
- [x] Bump package version to 2.1.227
- [x] Update README, CHANGELOG, BACKUP document, and Brain UI release notes
- [x] Update progress/final verification log
- **Status:** complete

### Phase 4: Verification
- [x] Run JS syntax checks for touched files
- [x] Run `npm run smoke:voice-events`
- [x] Run `npm run smoke:tools`
- **Status:** complete

### Phase 5: GitHub Backup and Release
- [ ] Commit changes
- [ ] Tag `v2.1.227`
- [ ] Push main and tag to GitHub
- [ ] Create source tarball and Git bundle assets
- [ ] Create GitHub Release with detailed notes and upload assets
- **Status:** pending

## Decisions Made
| Decision | Rationale |
|----------|-----------|
| Add wake and tts mapping to existing publish test | Keeps protocol smoke compact while covering critical external events |
| Use synthetic `tts_smoke` session ID | Avoids requiring real TTS session/provider credentials |
| Assert URL preservation for `tts:audio_ready` | External clients depend on the audio URL metadata path |

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
| `npm run smoke:tools` logs `better-sqlite3` Node ABI warning under Node v24 | 1 | Smoke assertions pass 6/6; existing local dependency rebuild warning |
