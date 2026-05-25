# Task Plan: v2.1.222 WebSocket TTS Cancel and Speak Guards

## Goal
Continue the Xiaozhi-inspired voice optimization by shipping v2.1.222 with WebSocket `tts:cancel`, new-speak replacement, and disconnect cancellation guards for direct `/voice/events` `tts:speak` sessions.

## Current Phase
Complete

## Phases

### Phase 1: Discovery
- [x] Inspect v2.1.221 direct `tts:speak` implementation
- [x] Identify limitation: no explicit cancel or active speak lifecycle guard
- [x] Choose per-connection active speak tracking to avoid cross-client cancellation surprises
- **Status:** complete

### Phase 2: Implementation
- [x] Add `tts:cancel` / `cancel` WebSocket handling
- [x] Track active speak requestId/sessionId on each WebSocket client
- [x] Cancel old speak when same client sends a new speak
- [x] Cancel active speak on connection close/error
- [x] Stop segment streaming when cancelled, replaced, or disconnected
- **Status:** complete

### Phase 3: Version, Docs, UI Notes
- [x] Bump package version to 2.1.222
- [x] Update README, CHANGELOG, BACKUP document, and Brain UI release notes
- [x] Update progress/final verification log
- **Status:** complete

### Phase 4: Verification
- [x] Run JS syntax checks for touched files
- [x] Run `npm run smoke:tools`
- **Status:** complete

### Phase 5: GitHub Backup and Release
- [x] Commit changes
- [x] Tag `v2.1.222`
- [x] Push main and tag to GitHub
- [x] Create source tarball and Git bundle assets
- [x] Create GitHub Release with detailed notes and upload assets
- **Status:** complete

## Decisions Made
| Decision | Rationale |
|----------|-----------|
| Cancellation is scoped to the same WebSocket connection | Prevent one client from accidentally stopping another client’s TTS |
| New `tts:speak` cancels previous speak on the same connection | Matches human voice assistant behavior where new output replaces stale output |
| Disconnect triggers cancel | Avoid background TTS generation when external device disappears |
| Stream loop checks requestId and session status | Prevent stale chunks from leaking after replacement/cancel |

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
| `npm run smoke:tools` logs `better-sqlite3` Node ABI warning under Node v24 | 1 | Smoke assertions pass 6/6; existing local dependency rebuild warning |
