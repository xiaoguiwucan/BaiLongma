# Findings: v2.1.229 Voice Event Mapping Pure Smoke

## Current baseline
- `voice-event-bus.js` has a central event-to-Xiaozhi mapping function used by broadcast paths.
- v2.1.228 WebSocket smoke covers many mappings, but requires starting an API server.
- Mapping logic itself is pure and can be tested directly.

## Design finding
- Direct pure-function tests are faster and make mapping regressions easier to diagnose.
- The WebSocket smoke should remain because it validates integration, client cleanup, and publish bridge behavior.
- Exporting `mapVoiceEventToXiaozhi` gives future tooling and tests a stable runtime source of truth.

## Remaining future direction
- Use the exported mapper in protocol documentation generation or snapshot tests.
- Add TypeScript/JSDoc schema definitions for mapped event payloads.
