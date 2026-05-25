# Progress: v2.1.223 Voice Events Debug Client

## 2026-05-26
- Resumed from released v2.1.222 baseline.
- Inspected existing scripts and `/voice/events` protocol capabilities.
- Added `scripts/voice-events-client.mjs`, a CLI debug client for the voice WebSocket protocol.
- Supported commands:
  - `status` for `/voice/events/status`.
  - `listen` for passive JSON event listening.
  - `listen --audio --binary --save out.mp3` for audio chunk subscription and saving.
  - `speak "text" --binary --save out.mp3` for direct WebSocket `tts:speak` verification.
  - `cancel` for `tts:cancel` verification.
- Added `npm run voice:events`.
- Bumped version to 2.1.223 and updated README, CHANGELOG, BACKUP-2026-05-26.md, and Brain UI in-app release notes.

- Verification passed: `node --check scripts/voice-events-client.mjs`, CLI `--help` output/exit code check, `node --check src/api.js`, `node --check src/voice/voice-event-bus.js`, and `node --check src/ui/brain-ui/app-shell.js`.
- Verification passed: `npm run smoke:tools` 6/6. Known local Node v24 / better-sqlite3 ABI audit-log warning remains non-blocking.
- Committed v2.1.223 as `7103103 feat: add voice events debug client`.
- Tagged and pushed `v2.1.223` to origin.
- Created GitHub Release: https://github.com/xiaoguiwucan/BaiLongma/releases/tag/v2.1.223
- Uploaded release assets: `backups/v2.1.223/BaiLongma-v2.1.223-source.tar.gz` and `backups/v2.1.223/BaiLongma-v2.1.223.bundle`.
