# Findings: v2.1.236 Voice Events Client Identity Hello

## Current baseline
- v2.1.235 added remote-address speak cooldown.
- `/voice/events/status` reports aggregate counts only: clients/history/audio subscribers/binary subscribers/version.
- External clients currently cannot identify themselves as ESP32, debug CLI, mobile, etc.

## Design finding
- For hardware and LAN debugging, knowing connected client identity is more useful than just a count.
- A simple optional `client:hello` message can carry `clientId`, `device`, `app`, `version`, and `platform`.
- Server should sanitize and truncate all client-supplied metadata.
- Status should expose safe summaries only, not tokens or secrets.

## Proposed client message
```json
{
  "type": "client:hello",
  "clientId": "esp32-living-room",
  "device": "xiaozhi-esp32",
  "app": "bailongma-bridge",
  "version": "0.1.0",
  "platform": "esp32"
}
```

## Remaining future direction
- Use `clientId` for per-device pairing tokens.
- Add UI panel listing connected clients.
- Add per-client permissions/capabilities.
