# Findings: v2.1.217 Xiaozhi-style Voice Event Protocol

## Current baseline
- Existing events are scattered: `bailongma:voice-state`, `bailongma:assistant-wake`, `bailongma:voice-activity`, `bailongma:media-duck`.
- TTS session playback has sessionId and segment indexes but no standardized lifecycle events.
- Voice state machine already dispatches state transitions, but ASR/TTS lifecycle is not normalized.

## Needed event protocol
- A unified bus event, e.g. `bailongma:voice-event`.
- Namespaced types: `wake:start`, `wake:accepted`, `wake:rejected`, `asr:partial`, `asr:final`, `speaker:rejected`, `tts:start`, `tts:sentence_start`, `tts:sentence_end`, `tts:stop`, `interrupt`, `media:duck`.
- Keep browser-only for this release; later WebSocket can forward the same event objects.
