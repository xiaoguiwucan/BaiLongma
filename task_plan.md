# Task Plan: Local ASR Replacement and Wake Word Gate

## Goal
Replace the default local Whisper ASR with a better Chinese-first local model, expose model switching in settings, stop Whisper when not selected, and add configurable wake-word gating so ordinary conversations/videos do not trigger the assistant.

## Current Phase
Phase 5

## Phases

### Phase 1: Requirements & Discovery
- [x] Confirm user wants local ASR by default
- [x] Inventory existing cloud/local ASR code paths
- [x] Document findings in findings.md
- **Status:** complete

### Phase 2: Design
- [x] Decide config shape and compatibility with current cloud settings
- [x] Define backend endpoints/WebSocket routing for local ASR
- [x] Define frontend switching behavior and defaults
- **Status:** complete

### Phase 3: Implementation
- [x] Add local ASR backend lifecycle/proxy support
- [x] Add frontend/provider selection support with local default
- [x] Update settings UI labels/options
- [x] Preserve cloud ASR as optional fallback
- **Status:** complete

### Phase 4: Testing & Verification
- [x] Run syntax checks
- [x] Start Electron/backend and verify endpoints/status
- [x] Verify UI defaults to local
- [x] Document any runtime dependency blockers
- **Status:** complete

### Phase 5: Delivery
- [x] Summarize changes and usage steps
- [x] Mention dependency requirements and next actions
- **Status:** complete

## Key Questions
1. Is local Whisper already present? Yes, `src/voice/whisper_server.py` and `src/voice/manager.js` exist.
2. Is local Whisper wired to the UI? To verify in Phase 1.
3. Can the current Mac run it? Need dependency check; Python 3.14 may be too new for PyTorch/Whisper.

## Decisions Made
| Decision | Rationale |
|----------|-----------|
| Make local ASR the default provider | User explicitly selected local and asked to default to it |
| Keep cloud providers available | Existing cloud flow works and is useful as fallback |
| Add `/voice/local/start|status|stop` endpoints | Frontend needs a safe way to launch/check local Whisper before opening ws://127.0.0.1:3723 |
| Use localStorage provider `local` as UI default | Minimal compatibility with current UI; cloud providers remain selectable |

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
| Local Whisper exited: missing `torch`/`whisper` under Python 3.14 | 1 | Created `.venv-whisper` with Python 3.11, installed runtime deps, and updated manager to prefer the venv |

## Notes
- Re-read plan before major implementation decisions.
- Log runtime/dependency failures in progress.md.


## New Requested Work (2026-05-25)
- [x] Add SenseVoiceSmall local backend and make it default.
- [x] Keep Whisper selectable but not running unless chosen.
- [x] Add settings UI for local ASR model switching.
- [x] Add configurable wake-word enable/keywords.
- [x] Verify endpoints and Electron app startup.


## New Implementation Summary
- Added `src/voice/sensevoice_server.py` compatible with existing PCM/WebSocket protocol.
- Updated `src/voice/manager.js` to choose `sensevoice` for `sensevoice-small` and `whisper` for Whisper model ids; changing models restarts the local ASR process.
- Added settings storage for `localAsrModel`, `wakeWordEnabled`, and `wakeWords`.
- Added Brain UI settings controls for local ASR model and wake words.
- Added frontend wake-word gate: ignored transcripts are not sent; saying only the wake word opens an 8s command window.
- Downloaded SenseVoiceSmall model to ignored local path `models/SenseVoiceSmall/` for faster startup.

## Verification
- Node syntax checks passed for modified JS.
- Python compile passed for `src/voice/sensevoice_server.py`.
- `/voice/local/status` reports `engine=sensevoice`, `model=sensevoice-small`, `status=running`.
- WebSocket test recognized bundled Chinese sample as “开放时间早上9点至下午5点。”
- WebSocket silence test produced no transcript.

## Voiceprint Gate Update (2026-05-25)
- [x] Add local speaker embedding dependency and server-side voiceprint storage.
- [x] Add WebSocket enrollment protocol.
- [x] Add speaker verification gate before ASR transcript emission.
- [x] Add settings UI for “only my voice” and voiceprint enrollment.
- [x] Verify no fake/test voiceprint remains after testing.

### Voiceprint Notes
- Voiceprint file path: `data/voiceprint.json`.
- Current state after testing: no voiceprint file exists; user must enroll from settings.
- If “只响应我的声音” is enabled before enrollment, server rejects speech with reason “未录入声纹”.

## Video Voice Robustness Update (2026-05-25)
- [x] Add independent settings toggles for video duck/pause, video PTT, and system AEC.
- [x] Keep microphone listening during video when duck/AEC is enabled; otherwise preserve old suspend behavior.
- [x] Auto duck local video/YouTube volume or pause cross-origin players on detected near-field speech.
- [x] Pause/duck video while Space PTT is held.
- [x] Pause/duck video longer after accepted assistant wake/command.
- [x] Restart and verify updated frontend assets are served.
