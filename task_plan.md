# Task Plan: v2.1.230 Voice Events Protocol Metadata

## Goal
Continue the Xiaozhi-inspired voice optimization by shipping v2.1.230 with a discoverable `/voice/events/protocol` metadata endpoint, shared protocol constants, updated smoke coverage, updated docs/UI release notes, and a GitHub Release with source and bundle assets.

## Current Phase
Verification complete; release in progress

## Phases

### Phase 1: Recover and verify WIP
- [x] Inspect git status and current uncommitted v2.1.230 changes
- [x] Confirm protocol metadata endpoint and smoke tests already exist in WIP
- [x] Run syntax checks and smoke tests
- **Status:** complete

### Phase 2: Version, docs, UI notes
- [x] Bump package version to 2.1.230
- [x] Update README, CHANGELOG, BACKUP document, Brain UI release notes
- [x] Update planning files with detailed findings/progress
- **Status:** complete

### Phase 3: Verification
- [x] Run `node --check` for touched JS files
- [x] Run `npm run smoke:voice-mapping`
- [x] Run `npm run smoke:voice-events`
- [x] Run `npm run smoke:tools`
- **Status:** complete

### Phase 4: GitHub backup and Release
- [ ] Commit changes
- [ ] Tag `v2.1.230`
- [ ] Push main and tag to GitHub
- [ ] Create `backups/v2.1.230` source tarball and git bundle
- [ ] Create GitHub Release with detailed notes and upload assets
- [ ] Finalize release docs if needed, then push/re-tag/re-upload assets
- **Status:** pending

## Decisions Made
| Decision | Rationale |
|----------|-----------|
| Add a metadata endpoint instead of only documenting protocol in Markdown | External devices and debug clients can discover version/capabilities/endpoints programmatically |
| Reuse shared constants for hello/status/protocol endpoint | Avoid version/capability drift across WebSocket hello, HTTP status, and docs/tests |
| Extend both pure mapping smoke and integration smoke | Pure smoke protects metadata function cheaply; integration smoke protects the HTTP endpoint and running API path |

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
| None yet | - | - |
