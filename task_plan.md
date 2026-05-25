# Task Plan: v2.1.225 Voice Events Smoke Test

## Goal
Continue the Xiaozhi-inspired voice optimization by shipping v2.1.225 with an automated smoke test for the `/voice/events` protocol, protecting hello, ping, subscribe, cancel, and status behavior.

## Current Phase
Complete

## Phases

### Phase 1: Discovery
- [x] Inspect current API startup/export behavior
- [x] Identify protocol behaviors that can be tested without real TTS credentials
- [x] Choose a temporary local API server smoke test on an isolated port
- **Status:** complete

### Phase 2: Implementation
- [x] Add `scripts/smoke-voice-events.mjs`
- [x] Validate `/voice/events/status` protocol version
- [x] Validate WebSocket hello service/version/capabilities
- [x] Validate ping/pong
- [x] Validate subscribe audio/binary options
- [x] Validate `tts:cancel` no-active-session response
- [x] Validate client count returns to zero after sockets close
- [x] Add `npm run smoke:voice-events`
- **Status:** complete

### Phase 3: Version, Docs, UI Notes
- [x] Bump package version to 2.1.225
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
- [x] Tag `v2.1.225`
- [x] Push main and tag to GitHub
- [x] Create source tarball and Git bundle assets
- [x] Create GitHub Release with detailed notes and upload assets
- **Status:** complete

## Decisions Made
| Decision | Rationale |
|----------|-----------|
| Test without real TTS credentials | Keeps smoke reliable on fresh developer machines |
| Use isolated default port 39221 | Avoid colliding with normal app port 3721 |
| Verify no-active-session cancel | Exercises structured cancel response without requiring audio provider |
| Wait for socket close before status count check | Avoid race between client close and server-side cleanup |

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
| First status-after-close check saw one remaining client | 1 | Wait for WebSocket close event and add a short cleanup delay before status assertion |
| `npm run smoke:tools` logs `better-sqlite3` Node ABI warning under Node v24 | 1 | Smoke assertions pass 6/6; existing local dependency rebuild warning |
