# Findings: v2.1.227 Voice Events Wake/TTS Mapping Smoke

## Current baseline
- v2.1.226 smoke verifies `asr:final` raw event and `stt final` mapping.
- `wake:accepted` and `tts:audio_ready` are equally important for external hardware clients.
- These mappings are deterministic and can be tested without live microphone or TTS credentials.

## Design finding
- `wake:accepted` protects the wake lifecycle contract external clients use to enter an active interaction.
- `tts:audio_ready` protects the bridge from sentence lifecycle to retrievable audio URL metadata.
- Synthetic events are sufficient for mapping smoke because the goal is to test the event bus and WebSocket broadcast, not ASR/TTS model quality.

## Remaining future direction
- Add mapping tests for `wake:rejected`, `tts:start`, `tts:sentence_start`, `tts:sentence_end`, and `tts:stop`.
- Add event-order tests around direct `tts:speak` with a mock provider.
