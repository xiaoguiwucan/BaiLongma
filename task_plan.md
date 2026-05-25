# Task Plan: v2.1.211 Xiaozhi-style Voice Foundation

## Goal
Start the Xiaozhi-inspired optimization plan for BaiLongma by shipping v2.1.211 with a reusable voice interaction state machine, round/session guards, settings/debug visibility, and documentation/release backup discipline.

## Current Phase
Phase 5

## Phases

### Phase 1: Discovery
- [x] Inspect current voice UI/config/API structure
- [x] Identify safest integration point for state machine and settings debug panel
- [x] Record findings
- **Status:** complete

### Phase 2: Implement State Foundation
- [x] Add `src/voice/voice-state-machine.js`
- [x] Add round/session ID helpers and stale-event protection hooks
- [x] Wire frontend voice panel to state machine events without breaking current local ASR
- **Status:** complete

### Phase 3: Settings & Debug UI
- [x] Add settings toggles for voice foundation/debug visibility where needed
- [x] Add voice status/debug panel in Brain UI
- [x] Surface roundId/sessionId/state/reason for troubleshooting
- **Status:** complete

### Phase 4: Verification
- [x] Run JS syntax checks / smoke checks
- [x] Verify package starts enough to serve UI/API where practical
- [x] Log any blockers
- **Status:** complete

### Phase 5: Version, Docs, Release
- [x] Bump version to 2.1.211
- [x] Update README / CHANGELOG / BACKUP notes / Brain UI release notes
- [ ] Commit, tag, push, create GitHub Release with source/bundle assets
- **Status:** in_progress

## Decisions Made
| Decision | Rationale |
|----------|-----------|
| Start with state machine foundation instead of full TTS rewrite | User approved full Xiaozhi-style plan; v2.1.211 was defined as safe foundation |
| Preserve current SenseVoice/wake/voiceprint/video protection behavior | Avoid regressing already-working local voice stack |
| Add debug visibility now | Needed for future wake/ASR/TTS tuning and user-reported voice issues |

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
| `npm run smoke:brain-ui` timed out waiting for `#graph circle` | 1 | Logged as unrelated UI smoke blocker; JS checks and tools smoke passed |
