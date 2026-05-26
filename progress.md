# Progress: v2.1.238 Voice Events Debug Client Identity

## 2026-05-26
- Resumed after v2.1.237 release.
- Confirmed latest git log shows v2.1.237 final docs commit and package version 2.1.237.
- Inspected the voice events CLI debug client and found it still lacks `client:hello`/capability flags, even though the server now supports them.
- Started v2.1.238 to make the CLI a practical Xiaozhi-style client/bridge debugging tool.
- Implemented CLI `protocol` command.
- Added default `client:hello` handshake for CLI listen/speak/cancel.
- Added CLI identity flags: `--client-id`, `--device`, `--app`, `--client-version`, `--platform`.
- Added repeatable/comma-separated `--capability` and `--no-identify` compatibility switch.
- Added `scripts/smoke-voice-events-client.mjs` and `npm run smoke:voice-events-client`; initial run passed 8/8.
- Bumped package version to 2.1.238 and regenerated package-lock metadata.
- Updated README, CHANGELOG, BACKUP, protocol docs, and Brain UI release notes for v2.1.238.
- Verification passed: `node --check scripts/voice-events-client.mjs`.
- Verification passed: `node --check scripts/smoke-voice-events-client.mjs`.
- Verification passed: `node --check scripts/smoke-voice-events.mjs`.
- Verification passed: `node --check scripts/smoke-voice-mapping.mjs`.
- Verification passed: `npm run smoke:voice-mapping` 33/33.
- Verification passed: `npm run smoke:voice-events` 37/37.
- Verification passed: `npm run smoke:voice-events-client` 8/8.
- Verification passed: `npm run smoke:tools` 6/6. Known local Node v24 / better-sqlite3 ABI audit-log warning remains non-blocking.
- Committed v2.1.238 as `25d7ee1 feat: enhance voice events debug client`.
- Tagged and pushed `v2.1.238` to origin.
- Created local release assets: `backups/v2.1.238/BaiLongma-v2.1.238-source.tar.gz` and `backups/v2.1.238/BaiLongma-v2.1.238.bundle`.
- Created GitHub Release: https://github.com/xiaoguiwucan/BaiLongma/releases/tag/v2.1.238
- Uploaded release assets: source tarball and git bundle.
