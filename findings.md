# Findings: v2.1.235 Voice Events Remote Address TTS Speak Cooldown

## Current baseline
- v2.1.234 added optional token authentication and access checks for `/voice/events`.
- v2.1.233/v2.1.232 added configurable `tts:speak` max text and per-WebSocket cooldown.
- The cooldown is stored on `ws.lastTTSSpeakAt`, so opening a second WebSocket connection from the same client can bypass it.

## Design finding
- Hardware or desktop clients can accidentally reconnect/open multiple sockets.
- A minimal remote-address-level cooldown prevents obvious multi-connection bypass without requiring device identity yet.
- The same configured `cooldownMs` can be reused for both scopes.
- `rate_limited` should include `scope: "connection" | "remote"` so clients/debug logs know what happened.

## Remaining future direction
- Add per-device pairing tokens for stronger identity than remote address.
- Add token management UI.
- Add more complete global/IP rate limiting windows beyond speak cooldown.
