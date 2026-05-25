# Progress: Local Whisper ASR Default

## 2026-05-25
- Created planning files for local ASR integration.
- Confirmed user wants local Whisper ASR connected and used by default.
- Implemented backend local Whisper lifecycle endpoints: `/voice/local/status`, `/voice/local/start`, `/voice/local/restart`, `/voice/local/stop`.
- Updated voice config to support `asrProvider` and `whisperModel`, defaulting to local/small.
- Updated settings UI to expose "本地 Whisper（默认）" and model selection.
- Updated voice panel to default to local ASR, start the local Whisper service, and connect to ws://127.0.0.1:3723 while preserving cloud fallback.
- Syntax checks passed for api/config/app/voice-panel/app-shell.
- Created `.venv-whisper` using Python 3.11 and installed local Whisper runtime dependencies: torch, numpy, websockets, tqdm, more-itertools, tiktoken, numba, ffmpeg-python.
- Updated `manager.js` to prefer `.venv-whisper/bin/python`, then python3.11/3.12/python3.
- Restarted Electron after killing old single-instance process.
- Verified `/voice/local/status` returns running on port 3723.
- Verified settings UI defaults to provider `local` and Whisper model `small`.
- First Whisper small model download completed (461 MB) and server started successfully.

- Installed FunASR/SenseVoice dependencies into `.venv-whisper`: funasr, modelscope, huggingface_hub, soundfile and transitive deps.
- Added `src/voice/sensevoice_server.py` with WebSocket protocol compatible with existing frontend.

- Added local ASR model selector in settings: SenseVoiceSmall default plus Whisper fallbacks.
- Added wake-word settings: enable switch and editable keyword list.
- Frontend now gates final transcripts with the wake words; commands without wake words are ignored and not sent to the assistant.
- Manager now starts SenseVoice for `sensevoice-small`, keeps Whisper selectable, and restarts when switching models.
- Downloaded `model.pt` manually from Hugging Face into ignored `models/SenseVoiceSmall/` after HF snapshot download stalled on the large LFS file.
- Restarted Electron/backend; SenseVoice server is running on ws://127.0.0.1:3723.
- Verified SenseVoice with bundled `zh.mp3` sample and verified silence produces no transcript.
- User chose wake-word model direction and asked for voiceprint so only their own voice can wake/control the assistant.
- Installed local speaker verification dependencies into `.venv-whisper`: `resemblyzer`, `webrtcvad`, `webrtcvad-wheels`.
- Added speaker enrollment/verification protocol to `src/voice/sensevoice_server.py`:
  - `speaker_enroll_start` / PCM frames / `speaker_enroll_finish`
  - saves local-only voiceprint to `data/voiceprint.json`
  - `speakerVerification` config gates recognition and emits `speaker_rejected` for non-matching or missing voiceprint.
- Added Brain UI settings controls: “只响应我的声音” and “录入我的声纹”.
- Enrollment records 6.5 seconds locally through WebSocket and enables speaker verification after success.
- Verified protocol using bundled sample audio, then deleted the test voiceprint so the user can enroll their own voice.
- Restarted SenseVoice server and verified strict mode rejects recognition when speaker verification is enabled but no voiceprint is enrolled.
- Added three independent video-voice protection toggles in Settings → Voice:
  1. auto duck/pause video when near-field speech is detected,
  2. enable Space push-to-talk during video,
  3. enable system echo cancellation (AEC) for microphone capture.
- Changed video-mode voice behavior: when duck/AEC is enabled, entering video mode keeps or auto-starts local voice listening instead of suspending the microphone; if both are disabled it falls back to the old suspend behavior.
- Added `bailongma:voice-activity` events from the voice panel to the media layer; media layer temporarily ducks local video/YouTube volume or pauses Bilibili-like cross-origin players.
- Added `bailongma:assistant-wake` handling so successful wake/command pauses video longer while the assistant starts responding.
- Updated Space PTT: during video playback it pauses/ducks video for the hold duration and restores after release; it can be disabled independently in settings.
- Restarted Electron and verified updated JS is served and local SenseVoice is still running.
- User reported their own voice was rejected after enrollment. Lowered speaker verification threshold from 0.72 to 0.55 because short wake phrases are unstable with speaker embeddings.
- Added Settings → Voice “声纹严格度” slider (0.45–0.80, default 0.55), saved to localStorage and sent to the local ASR server as `speakerThreshold`.
- Updated rejection UI to display the actual speaker score and threshold when available, making calibration easier.
- Restarted local SenseVoice after the threshold change.
