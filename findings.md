# Findings: v2.1.225 Voice Events Smoke Test

## Current baseline
- `/voice/events` protocol v3 has enough non-TTS-provider behavior to test automatically.
- `startAPI` returns the HTTP server, so a smoke test can start and stop a temporary API instance.
- Real `tts:speak` audio generation depends on configured provider credentials, so it is not appropriate for a basic smoke test yet.

## Design finding
- Testing hello, ping, subscribe, cancel-without-active-session, and status client cleanup gives useful coverage without external credentials.
- Client count assertions need to wait until the WebSocket close event has propagated to the server.
- A later integration test can add mock TTS provider coverage for full `tts:speak` event ordering.

## Remaining future direction
- Add mock/provider injection for deterministic TTS speak tests.
- Add CI workflow once dependency/native module setup is stable.
- Extend smoke test to verify `POST /voice/events/publish` event mapping.
