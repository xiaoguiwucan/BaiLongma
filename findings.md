# Findings: v2.1.218 Experimental Voice WebSocket Channel

## Current baseline
- `src/api.js` already hosts WebSocket upgrades for `/voice/cloud` and `/acui`.
- v2.1.217 emits browser-side `bailongma:voice-event` objects.
- Backend cannot see browser DOM events unless the frontend forwards them.

## Planned channel
- Add `/voice/events` WebSocket for external clients.
- Add `POST /voice/events/publish` for Brain UI to forward internal voice events.
- Broadcast both raw event and Xiaozhi-like mapped messages, e.g. `tts start`, `sentence_start`, `stop`.
