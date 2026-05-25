# Findings: v2.1.230 Voice Events Protocol Metadata

## Current baseline
- v2.1.229 exposes `mapVoiceEventToXiaozhi(event)` and has fast mapping smoke plus WebSocket integration smoke.
- External clients still need to know protocol version, capabilities, supported endpoints, supported client messages, and mapped states from documentation or hello messages.

## Design finding
- A lightweight `GET /voice/events/protocol` endpoint makes the voice bridge easier for ESP32-style clients, desktop debug tools, and future mobile clients to self-check before opening WebSocket/audio subscriptions.
- Shared constants in `src/voice/voice-event-bus.js` reduce protocol drift: WebSocket hello, `/voice/events/status`, `/voice/events/protocol`, and smoke tests can all depend on one source of truth.
- Capability metadata should explicitly include `json_events`, `tts_audio_chunks`, and `tts_speak` because these are the current practical features external devices need to decide whether they can subscribe/play/speak.

## Remaining future direction
- Generate `docs/VOICE_EVENTS_PROTOCOL.md` tables from the same metadata to avoid manual drift.
- Add schema validation for external `tts:speak` and `subscribe` messages.
- Add a compatibility policy for future protocol version 4 before breaking message shapes.
