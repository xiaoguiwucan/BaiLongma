# Findings: v2.1.237 Voice Events Client Capabilities and Last-Seen Diagnostics

## Current baseline
- v2.1.236 added optional `client:hello` / `client:identify` identity registration.
- `/voice/events/status` exposes `clientDetails` with identity and audio subscription flags.
- Identity does not include client-declared capabilities.
- Status does not explicitly expose recent activity/last-seen time.

## Design finding
- ESP32/mobile/debug clients may support different features: binary audio, base64 audio, wake, speak, display, etc.
- A client-declared `capabilities` array helps diagnose why a client did not subscribe or play audio.
- `lastSeenAt` helps determine whether a connected WebSocket is active or stale.
- These are diagnostics, not authorization.

## Example client hello
```json
{
  "type": "client:hello",
  "clientId": "esp32-living-room",
  "capabilities": ["binary_audio", "tts_speak", "wake"]
}
```

## Remaining future direction
- Add UI panel listing connected client details.
- Use capabilities to negotiate binary/base64 defaults.
- Add per-device permissions after pairing tokens exist.
