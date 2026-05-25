# Findings: v2.1.222 WebSocket TTS Cancel and Speak Guards

## Current baseline
- v2.1.221 allows external clients to call `tts:speak` and receive sentence events plus audio chunks.
- Speak sessions are created through the existing TTS session manager.
- Without cancellation, old TTS could continue after user interruption, new request, or disconnect.

## Design finding
- The correct unit of cancellation is the WebSocket connection’s active speak, not a global session, because multiple clients may speak independently.
- New speak replacing old speak is important for real voice UX; the user expects the latest assistant utterance to win.
- Disconnect cancellation prevents wasted provider calls and avoids stale chunks being emitted to a dead socket.

## Remaining future direction
- Add explicit `sessionId`-targeted cancel if multi-session-per-connection becomes necessary.
- Add server-side timeout limits for very long TTS requests.
- Add integration tests with a mock TTS provider to verify event order under cancel/replacement.
