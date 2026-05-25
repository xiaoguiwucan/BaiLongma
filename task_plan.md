# Task Plan: v2.1.223 Voice Events Debug Client

## Goal
Continue the Xiaozhi-inspired voice optimization by shipping v2.1.223 with a reusable CLI debug client for `/voice/events`, making it easy to validate status/listen/speak/cancel and audio chunk saving before external device integration.

## Current Phase
Verification complete; release in progress

## Phases

### Phase 1: Discovery
- [x] Inspect current scripts and voice WebSocket protocol capabilities
- [x] Identify missing artifact: local protocol debug client for developers and external device integration
- [x] Choose a small Node CLI using existing `ws` dependency and native fetch/fs
- **Status:** complete

### Phase 2: Implementation
- [x] Add `scripts/voice-events-client.mjs`
- [x] Support `status`, `listen`, `speak`, and `cancel` commands
- [x] Support `--audio`, `--binary`, `--save`, `--url`, `--api`, and `--timeout`
- [x] Add `npm run voice:events`
- **Status:** complete

### Phase 3: Version, Docs, UI Notes
- [x] Bump package version to 2.1.223
- [x] Update README, CHANGELOG, BACKUP document, and Brain UI release notes
- [x] Update progress/final verification log
- **Status:** complete

### Phase 4: Verification
- [x] Run JS syntax checks for touched files
- [x] Run CLI help smoke
- [x] Run `npm run smoke:tools`
- **Status:** complete

### Phase 5: GitHub Backup and Release
- [ ] Commit changes
- [ ] Tag `v2.1.223`
- [ ] Push main and tag to GitHub
- [ ] Create source tarball and Git bundle assets
- [ ] Create GitHub Release with detailed notes and upload assets
- **Status:** pending

## Decisions Made
| Decision | Rationale |
|----------|-----------|
| Use a standalone script instead of UI-only debugging | External devices and terminal testing need a simple reproducible command |
| Use existing `ws` dependency | Avoid new dependency risk and keep install unchanged |
| Save binary/base64 audio to a file when requested | Makes TTS protocol verification tangible even before hardware integration |
| Keep status via HTTP endpoint | `/voice/events/status` is already the authoritative server-side state |

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
| Initial `--help` check returned exit code 1 because no command was set | 1 | Changed `--help` to exit 0 before missing-command validation |
| `npm run smoke:tools` logs `better-sqlite3` Node ABI warning under Node v24 | 1 | Smoke assertions pass 6/6; existing local dependency rebuild warning |
