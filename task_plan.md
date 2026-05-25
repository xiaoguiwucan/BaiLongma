# Task Plan: v2.1.233 Configurable Voice Event TTS Speak Limits

## Goal
Continue the Xiaozhi-inspired voice optimization by shipping v2.1.233 with configurable `/voice/events` `tts:speak` safety limits. The limits should be readable/writable through TTS settings, reflected in `/voice/events/protocol` and WebSocket hello, used by validation/rate limiting, covered by smoke tests, documented, shown in Brain UI, and backed up to GitHub Release.

## Current Phase
Verification complete; release in progress

## Phases

### Phase 1: Discovery
- [x] Confirm v2.1.232 clean baseline and release state
- [x] Inspect TTS config API/UI and voice event limit usage
- [x] Identify fixed constants need settings-backed overrides
- **Status:** complete

### Phase 2: Implementation
- [x] Add TTS config fields for `voiceEventsTtsSpeakMaxTextChars` and `voiceEventsTtsSpeakCooldownMs`
- [x] Allow protocol metadata and validation to receive active limits
- [x] Use configured limits in `/voice/events/protocol`, WebSocket hello, validation, and cooldown
- [x] Add settings UI inputs and save/load wiring
- **Status:** complete

### Phase 3: Tests, docs, UI notes
- [x] Extend smoke tests for configurable limits
- [x] Bump version to 2.1.233 and update README/CHANGELOG/BACKUP/protocol docs/UI release notes
- [x] Run syntax checks and smoke tests
- **Status:** complete

### Phase 4: GitHub release
- [ ] Commit changes
- [ ] Tag and push v2.1.233
- [ ] Create source tarball and git bundle assets
- [ ] Create GitHub Release with detailed notes and upload assets
- **Status:** in_progress

## Decisions Made
| Decision | Rationale |
|----------|-----------|
| Store limits under TTS config | These limits protect TTS speak behavior and belong with TTS service settings |
| Keep defaults 800 / 1200ms | Preserve v2.1.232 behavior for users who do not configure anything |
| Clamp values | Prevent unusable or unsafe settings from UI/API mistakes |

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
| None yet | - | - |
