# Findings: v2.1.221 WebSocket TTS Speak Request

## Current baseline
- v2.1.220 supports opt-in audio chunk delivery over `/voice/events`.
- That delivery is currently triggered by HTTP segment playback, so external devices are still passive listeners.
- Existing TTS session code already has the core pieces needed for direct TTS: text splitting, provider credentials, session IDs, and segment streaming.

## Design finding
- `tts:speak` should be scoped to the requesting WebSocket client to avoid privacy and bandwidth surprises.
- Reusing the same session/segment events keeps the protocol compatible with v2.1.219/220 clients.
- The server can emit both raw `voice_event` and Xiaozhi-style JSON for each sentence, then stream audio chunks over the same connection.

## Remaining future direction
- Add cancel support for in-flight `tts:speak` sessions.
- Add Opus transcoding or an Opus-native TTS path.
- Add an automated integration test that starts the API, connects a WebSocket, sends `tts:speak`, and verifies event order using a mock provider.
