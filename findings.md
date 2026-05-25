# Findings: v2.1.223 Voice Events Debug Client

## Current baseline
- `/voice/events` now supports JSON lifecycle events, opt-in audio chunks, `tts:speak`, and `tts:cancel`.
- Developers currently need ad-hoc `node -e` snippets to test the protocol.
- Existing project dependency `ws` is already available and suitable for a CLI client.

## Design finding
- A dedicated CLI client reduces friction for protocol verification and gives ESP32/mobile integration a concrete reference.
- The script should support both passive listening and active `tts:speak` requests.
- Saving audio chunks to a file makes it easy to verify that binary/base64 chunks are valid audio.

## Remaining future direction
- Convert this script into automated integration tests once a mock TTS provider exists.
- Add protocol examples for LAN devices and ESP32 clients.
- Add optional event-order assertions for CI.
