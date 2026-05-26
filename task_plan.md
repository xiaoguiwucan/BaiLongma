# Task Plan: v2.1.238 Voice Events Debug Client Identity

## Goal
Continue the Xiaozhi-inspired voice server work by making the bundled `/voice/events` CLI debug client understand the new client identity/capability negotiation, so ESP32-style bridges and local debugging can identify themselves consistently.

## Current Phase
GitHub release

## Phases

### Phase 1: Discovery
- [x] Confirm v2.1.237 clean baseline and latest release state
- [x] Inspect `scripts/voice-events-client.mjs`, smoke tests, protocol docs, and UI release notes
- [x] Choose a small concrete next feature: CLI identity/capability handshake
- **Status:** complete

### Phase 2: Implementation
- [x] Add CLI flags for client identity and capabilities
- [x] Send `client:hello` automatically before listen/speak/cancel by default, with `--no-identify` escape hatch
- [x] Add `protocol` convenience command
- **Status:** complete

### Phase 3: Tests, docs, UI notes
- [x] Extend smoke tests for CLI-facing protocol behavior
- [x] Bump version to 2.1.238 and update README/CHANGELOG/BACKUP/protocol docs/UI release notes
- [x] Run syntax checks and smoke suites
- **Status:** complete

### Phase 4: GitHub release
- [ ] Commit changes
- [ ] Tag and push v2.1.238
- [ ] Create source tarball and git bundle assets
- [ ] Create GitHub Release with detailed notes and upload assets
- **Status:** pending

## Decisions Made
| Decision | Rationale |
|----------|-----------|
| Improve the CLI before deeper protocol changes | Makes existing v2.1.236-v2.1.237 server diagnostics usable immediately from Mac/ESP32 bridge debugging |
| Keep this release low-risk | The user wants continual stable backed-up versions; small testable increments reduce regressions |

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
| None yet | - | - |
