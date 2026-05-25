# Findings: v2.1.224 Voice Events Protocol Documentation

## Current baseline
- `/voice/events` has evolved into protocol v3 with JSON events, TTS audio chunks, direct `tts:speak`, and `tts:cancel`.
- v2.1.223 added a CLI debug client, but the protocol itself was scattered across README/CHANGELOG/release notes.
- External device integration needs a stable, single reference document.

## Design finding
- The protocol doc should describe both raw `voice_event` and Xiaozhi-style mapped events because clients may choose either layer.
- Audio chunk semantics need clear ordering: metadata JSON followed by binary frame when `binaryAudio=true`.
- Cancellation semantics must be explicit: scoped to the same WebSocket connection's active speak.

## Remaining future direction
- Add Opus frame documentation after actual Opus encoding/transcoding exists.
- Add sequence diagrams once the client/server flows stabilize further.
- Add SDK snippets for ESP32 and mobile clients.
