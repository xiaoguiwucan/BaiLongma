# Findings: v2.1.232 Voice Event TTS Speak Safety Limits

## Current baseline
- v2.1.231 added structured `protocol_error` responses and validation for malformed WebSocket messages.
- `tts:speak` still accepts arbitrary text length as long as it is non-empty.
- Repeated `tts:speak` messages are allowed immediately; the newer speak cancels the previous one.

## Design finding
- For hardware/LAN clients, accidental repeated `tts:speak` can cause constant cancellation/recreation of TTS sessions.
- Very long text can create slow or expensive TTS jobs, large audio streams, or poor UX.
- Protocol metadata should advertise safety limits so clients can enforce them before sending.
- A minimal per-WebSocket cooldown is enough for now and does not require global identity/auth.

## Chosen limits
- `maxTextChars`: 800 characters.
- `cooldownMs`: 1200 ms per WebSocket connection.
- New error codes:
  - `text_too_long`
  - `rate_limited`

## Remaining future direction
- Add configurable limits in settings.
- Add global/IP-level rate limiting before exposing beyond localhost/LAN.
- Add authentication or pairing for non-local clients.
