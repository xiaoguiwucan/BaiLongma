# Task Plan: v2.2.0 Major Voice Device Console

## Goal
Build a larger v2.2.0 milestone instead of publishing tiny releases. The milestone should make Xiaozhi-style external voice clients visible and operable from Brain UI, backed by `/voice/events` diagnostics, tests, and docs. Do not create a GitHub Release until the broader v2.2.0 feature set is ready.

## Current Phase
Checkpoint 2 complete; continue accumulating v2.2.0

## Phases

### Phase 1: Baseline and milestone scope
- [x] Confirm v2.1.240 clean baseline and GitHub release state
- [x] Record user release-cadence request: large milestone updates only
- [x] Select v2.2.0 first feature group: Brain UI external voice client diagnostics panel
- **Status:** complete

### Phase 2: Brain UI external clients panel
- [x] Add voice tab UI for `/voice/events/clients` summary, refresh, auto-refresh, and client cards
- [x] Fetch and render client identity, subscription, capabilities, negotiated audio mode, and lastSeenAt
- [x] Add resilient empty/error states for human debugging
- **Status:** complete

### Phase 3: Tests and docs for checkpoint
- [x] Extend brain-ui smoke server mocks and browser checks
- [x] Update progress docs and v2.2.0 development notes without creating release notes as final
- [x] Run relevant syntax and smoke tests
- **Status:** complete

### Phase 4: GitHub backup only
- [x] Commit v2.2.0 development checkpoint
- [x] Push to GitHub main for backup
- [x] Do not tag or create Release yet
- **Status:** complete

## Release Cadence
- User explicitly requested: “制作大版本更新，不要改动一点点就更新”.
- Therefore: accumulate v2.2.0 changes, commit/push for backup, but delay tag/Release/assets until the milestone is meaningfully complete.

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
| `npm run smoke:brain-ui` timed out waiting for graph | Full browser smoke after panel changes | Fixed by escaping release-note backticks in `app-shell.js`, serving `/src/voice/*` imports in smoke server, mocking voice local endpoints, and waiting on node-count stats. Smoke now passes. |

## Checkpoint 2: Brain UI smoke repair
- [x] Identify page bootstrap failure (`tts is not defined`) caused by unescaped backticks in settings release notes.
- [x] Fix app-shell template literal by replacing raw backtick API path with `<code>`.
- [x] Add missing static route for `/src/voice/*` modules in `smoke-brain-ui`.
- [x] Mock voice local endpoints used by the voice panel.
- [x] Verify `npm run smoke:brain-ui` passes and covers the new external clients panel.
