# Findings: v2.1.216 Sentence TTS Session

## Current baseline
- Backend `/tts/stream` streams provider audio but frontend `playTTSReply` waits for `resp.blob()`, so playback starts only after the whole text audio is downloaded.
- Current TTS providers are already abstracted in `src/voice/tts-providers.js`.
- Frontend has interruption hooks `stopTTS`, `duckTTS`, `unduckTTS`, `resumeTTSIfNoSpeech`.

## Needed changes
- Add sentence splitting for Chinese/English punctuation.
- Add server-side TTS session manager for session IDs, segment indexes, and cancellation.
- Frontend should split text into segments, request segment audio, and play as a queue, while discarding old sessions.
