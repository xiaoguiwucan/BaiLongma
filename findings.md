# Findings: v2.1.226 Voice Events Publish Mapping Smoke

## Current baseline
- v2.1.225 smoke validates WebSocket hello, ping, subscribe, cancel, and client cleanup.
- `/voice/events/publish` is the bridge used by Brain UI to forward browser-side voice events to backend WebSocket clients.
- The bridge also performs Xiaozhi-style mapping through `publishVoiceEvent`.

## Design finding
- `asr:final` is the best first mapping test because it maps cleanly to `{type:"stt", state:"final"}` and requires no model credentials.
- Testing raw `voice_event` and mapped JSON together protects both debugging clients and Xiaozhi-style clients.
- This fills the largest gap left by v2.1.225 without adding flaky provider-dependent testing.

## Remaining future direction
- Add publish mapping tests for wake accepted/rejected and TTS lifecycle events.
- Add mock TTS provider coverage for full `tts:speak` audio sequencing.
