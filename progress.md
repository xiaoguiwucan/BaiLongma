# Progress: v2.1.239 Voice Events Audio Capability Negotiation

## 2026-05-26
- Resumed after v2.1.238 release.
- Verified local package version 2.1.238, clean latest release with source tarball and git bundle assets.
- Inspected `/voice/events` protocol metadata and client identity/capability handling.
- Started v2.1.239 to add capability-based audio negotiation in `client:accepted` while preserving old subscribe behavior.
- Implemented `audio_negotiation` protocol capability and metadata.
- Added `negotiateVoiceEventClientCapabilities()` with binary > base64 > none priority.
- Extended `client:accepted` to include `negotiated` audio recommendation while keeping `shouldSubscribeAudio: false` for backward-compatible behavior.
- Extended smoke mapping to 37 checks and voice events smoke to 39 checks.
- Bumped package version to 2.1.239 and updated README, CHANGELOG, BACKUP, protocol docs, and Brain UI release notes.
- Verification passed: `node --check src/voice/voice-event-bus.js`.
- Verification passed: `node --check scripts/smoke-voice-mapping.mjs`.
- Verification passed: `node --check scripts/smoke-voice-events.mjs`.
- Verification passed: `node --check scripts/smoke-voice-events-client.mjs`.
- Verification passed: `npm run smoke:voice-mapping` 37/37.
- Verification passed: `npm run smoke:voice-events` 39/39.
- Verification passed: `npm run smoke:voice-events-client` 8/8.
- Verification passed: `npm run smoke:tools` 6/6. Known local Node v24 / better-sqlite3 ABI audit-log warning remains non-blocking.
- Committed v2.1.239 as `171e7de feat: add voice event audio negotiation`.
- Tagged and pushed `v2.1.239` to origin.
- Created local release assets: `backups/v2.1.239/BaiLongma-v2.1.239-source.tar.gz` and `backups/v2.1.239/BaiLongma-v2.1.239.bundle`.
- Created GitHub Release: https://github.com/xiaoguiwucan/BaiLongma/releases/tag/v2.1.239
- Uploaded release assets: source tarball and git bundle.
