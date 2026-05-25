# Findings: Local Whisper ASR Default

## Existing state
- User wants local speech recognition connected and default.
- Current UI voice panel is cloud-oriented and connects to `/voice/cloud`.
- Existing local Whisper assets/code are present:
  - `src/voice/whisper_server.py`
  - `src/voice/manager.js`
  - `src/voice/whisper/` vendored Whisper package

## Open findings
- Need confirm if backend currently imports/uses `manager.js`.
- Need inspect voice settings config shape.
- Need inspect local Whisper WebSocket protocol expected by frontend.

## Phase 1 discovery update
- Frontend `voice-panel.js` currently connects only to `ws://127.0.0.1:3721/voice/cloud`.
- Backend `api.js` exposes `/voice/cloud` WebSocket and does not currently import/use `src/voice/manager.js`.
- Local Whisper protocol is compatible with the cloud proxy client shape: it accepts JSON `{type:'config', lang}` plus 16-bit PCM binary chunks and emits `{type:'transcript', text, is_final}`.
- `manager.js` already starts local Whisper on port `3723`, but there are no HTTP lifecycle endpoints wired into `api.js`.
- Settings currently store ASR provider in localStorage key `bailongma-voice-provider`, defaulting to `aliyun`.

## SenseVoice discovery
- Hugging Face model card for FunAudioLLM/SenseVoiceSmall recommends FunASR AutoModel with `model="FunAudioLLM/SenseVoiceSmall"`, `trust_remote_code=True`, `hub="hf"`, `language` options including zh/en/yue/ja/ko, and `use_itn=True`.
- Model card states SenseVoiceSmall is Chinese-first, faster than Whisper-small/large, and supports speech/event/emotion tags.

## Runtime notes for SenseVoice
- `funasr` also requires `torchaudio`; installed it into `.venv-whisper`.
- Hugging Face snapshot download stalled on `model.pt`; direct `curl -L https://huggingface.co/FunAudioLLM/SenseVoiceSmall/resolve/main/model.pt` succeeded.
- FunASR tries to install model requirements using `/Users/imac/.venv`; this warning is harmless after dependencies are installed, and the model still loads.
- Using local `models/SenseVoiceSmall/` avoids repeated large downloads on startup.
