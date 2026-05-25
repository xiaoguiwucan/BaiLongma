# Findings: v2.1.231 Voice Event Client Message Validation

## Current baseline
- v2.1.230 exposes protocol metadata and shared constants.
- `/voice/events` WebSocket currently catches parse errors silently.
- Unsupported client message types currently fall through without a response.
- `tts:speak` with empty text returns a TTS error, but the validation rules are not reflected in protocol metadata or pure tests.

## Design finding
- External hardware clients need deterministic error replies because serial logs and embedded debugging are limited.
- A structured `protocol_error` reply with `code`, `message`, optional `requestId`, and optional `receivedType` is easier to handle than silent ignore or connection close.
- Supported inbound message families are:
  - `ping`
  - `subscribe` / `voice:subscribe`
  - `unsubscribe` / `voice:unsubscribe`
  - `tts:speak` / `speak`
  - `tts:cancel` / `cancel`
- Validation can be introduced without bumping protocol version because valid existing messages remain compatible.

## Remaining future direction
- Add JSON schema files for protocol messages.
- Add max text length / rate limiting for `tts:speak` before exposing to LAN devices broadly.
- Add authentication or pairing before recommending non-localhost exposure.
