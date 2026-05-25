# Findings: v2.1.220 WebSocket TTS Audio Chunk Subscription

## Current baseline
- v2.1.219 emits `tts:audio_ready` with the segment URL, index, text, and content type.
- `/tts/session/:id/audio/:index` already streams provider audio chunks to the browser.
- `/voice/events` already supports JSON lifecycle events and a lightweight ping handler.

## Design finding
- The safest next Xiaozhi-style step is an explicit subscription model: clients must opt in before receiving audio chunks.
- Base64 JSON chunks are useful for simple clients and logging; binary chunks are closer to the eventual Opus frame protocol.
- Broadcasting from the existing HTTP segment stream keeps desktop behavior unchanged and avoids double TTS synthesis.

## Remaining future direction
- Convert provider audio to Opus frames or add an Opus-capable provider path.
- Move from “HTTP playback triggers WebSocket audio mirror” to a first-class WebSocket TTS session request path.
- Add a small protocol test client in `scripts/` once runtime server tests are introduced.
