# Findings: v2.1.219 TTS Audio Segment Events

## Current baseline
- v2.1.218 exposes `/voice/events` WebSocket and maps lifecycle events to Xiaozhi-like JSON.
- v2.1.216 already provides sentence-level TTS sessions and segment audio URLs at `/tts/session/:id/audio/:index`.
- The frontend knows exactly when each segment is about to be fetched, making it the lowest-risk place to emit segment metadata.

## Design finding
- A hardware/mobile client does not need binary frames immediately if it can receive `tts audio_ready` with `sessionId`, `index`, `text`, `url`, and `contentType`.
- The WebSocket event stays JSON-only for v2.1.219, but now bridges lifecycle events to actual retrievable audio.
- Future versions can replace or supplement URL metadata with binary Opus frames while keeping the same `sessionId/index` sequencing.
