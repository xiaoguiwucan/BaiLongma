# Progress: v2.1.240 Voice Events Clients Diagnostics Endpoint

## 2026-05-26
- Resumed after v2.1.239 release.
- Verified local package version 2.1.239 and GitHub Release v2.1.239 with source tarball and git bundle assets.
- Inspected current `/voice/events/status`, `/voice/events/protocol`, and voice event bus status details.
- Started v2.1.240 to add a focused connected-client diagnostics endpoint.
- Implemented `GET /voice/events/clients` focused diagnostics endpoint.
- Added `client_diagnostics` protocol capability and `endpoints.clients` metadata.
- Added `getVoiceEventClientDetails()` helper and reused it in `/voice/events/status`.
- Client diagnostics now include safe identity, audio subscription flags, and negotiated audio mode.
- Extended smoke tests: voice-events now covers 41 checks including empty and active clients endpoint responses.
- Bumped package version to 2.1.240 and updated README, CHANGELOG, BACKUP, protocol docs, and Brain UI release notes.
- Verification passed: `node --check src/voice/voice-event-bus.js`.
- Verification passed: `node --check src/api.js`.
- Verification passed: `node --check scripts/smoke-voice-mapping.mjs`.
- Verification passed: `node --check scripts/smoke-voice-events.mjs`.
- Verification passed: `npm run smoke:voice-mapping` 37/37.
- Verification passed: `npm run smoke:voice-events` 41/41.
- Verification passed: `npm run smoke:voice-events-client` 8/8.
- Verification passed: `npm run smoke:tools` 6/6. Known local Node v24 / better-sqlite3 ABI audit-log warning remains non-blocking.
- Committed v2.1.240 as `af0ca82 feat: add voice event client diagnostics endpoint`.
- Tagged and pushed `v2.1.240` to origin.
- Created local release assets: `backups/v2.1.240/BaiLongma-v2.1.240-source.tar.gz` and `backups/v2.1.240/BaiLongma-v2.1.240.bundle`.
- Created GitHub Release: https://github.com/xiaoguiwucan/BaiLongma/releases/tag/v2.1.240
- Uploaded release assets: source tarball and git bundle.
- User clarified release cadence: stop publishing tiny releases for every small change; next work should be accumulated into a larger milestone release, e.g. v2.2.0.
