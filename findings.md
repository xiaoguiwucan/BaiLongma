# Findings: v2.1.233 Configurable Voice Event TTS Speak Limits

## Current baseline
- v2.1.232 added fixed `tts:speak` limits: 800 chars and 1200ms per WebSocket connection.
- `/settings/tts` already exists and is used by Brain UI for TTS provider, voice, and credentials.
- `/voice/events/protocol` and WebSocket hello currently use fixed protocol metadata from `voice-event-bus.js`.
- Validation and cooldown currently read fixed `VOICE_EVENTS_TTS_SPEAK_LIMITS`.

## Design finding
- Users may need a shorter limit for hardware buttons or a longer limit for desktop debugging.
- The external client should not need separate docs to know active limits; `/voice/events/protocol` and hello should report the configured values.
- A settings-backed override must preserve safe defaults and clamp values.

## Chosen config keys
- `voiceEventsTtsSpeakMaxTextChars`: default 800, clamp 40-3000.
- `voiceEventsTtsSpeakCooldownMs`: default 1200, clamp 0-10000.

## Remaining future direction
- Add global/IP-level rate limiting.
- Add authentication/pairing for LAN devices.
- Move voice protocol settings to a dedicated external-device settings panel if the list grows.
