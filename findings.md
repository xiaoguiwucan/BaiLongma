# Findings: v2.1.234 Voice Events Optional Token Authentication

## Current baseline
- v2.1.233 made `tts:speak` limits configurable.
- HTTP paths already use `hasAllowedAccess(req, url)` / `requireLocalOrToken(req, res, url)`.
- `/acui` WebSocket upgrade checks origin and allowed access.
- `/voice/events` WebSocket upgrade currently calls `handleUpgrade` directly without origin/access checks.

## Design finding
- `/voice/events` is increasingly capable: it can receive `tts:speak`, stream audio, expose protocol metadata, and receive client commands.
- Before recommending LAN/external clients, the WebSocket should have the same access posture as `/acui`.
- Existing `BAILONGMA_API_TOKEN` supports Authorization Bearer and `?token=` query parameter via `hasValidAuthToken`.
- Protocol metadata should say whether auth is configured and which methods are accepted, without exposing the token.

## Auth behavior
- Loopback clients remain allowed without token.
- LAN/private clients are allowed if `BAILONGMA_ALLOW_LAN=true`, matching existing helper behavior.
- If `BAILONGMA_API_TOKEN` is set, clients can pass `Authorization: Bearer <token>` or `?token=<token>`.
- Origin must be loopback or private LAN origin when LAN is enabled.

## Remaining future direction
- Add per-device pairing tokens.
- Add global/IP-level rate limiting.
- Add UI helper to generate/copy token and LAN connection URL.
