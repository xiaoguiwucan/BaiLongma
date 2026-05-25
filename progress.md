# Progress: v2.1.224 Voice Events Protocol Documentation

## 2026-05-26
- Resumed from released v2.1.223 baseline.
- Inspected README, CHANGELOG, backup notes, and current `/voice/events` protocol features.
- Added `docs/VOICE_EVENTS_PROTOCOL.md` as the stable protocol reference for external clients.
- Documented endpoint/status API, hello/version/capabilities, ping/pong, audio subscription, raw events, Xiaozhi-style event mapping, TTS audio chunks, `tts:speak`, `tts:cancel`, status response, CLI examples, client implementation advice, and known limitations.
- Bumped version to 2.1.224 and updated README, CHANGELOG, BACKUP-2026-05-26.md, and Brain UI in-app release notes.

- Verification passed: protocol document content check for version/tts:speak/tts:cancel/audio_chunk/binaryAudio.
- Verification passed: `node --check scripts/voice-events-client.mjs` and CLI `--help` output check.
- Verification passed: `npm run smoke:tools` 6/6. Known local Node v24 / better-sqlite3 ABI audit-log warning remains non-blocking.
- Committed v2.1.224 as `471d0c4 docs: add voice events protocol guide`.
- Tagged and pushed `v2.1.224` to origin.
- Created GitHub Release: https://github.com/xiaoguiwucan/BaiLongma/releases/tag/v2.1.224
- Uploaded release assets: `backups/v2.1.224/BaiLongma-v2.1.224-source.tar.gz` and `backups/v2.1.224/BaiLongma-v2.1.224.bundle`.
