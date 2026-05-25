# Progress: v2.1.215 ASR Provider Refactor

## 2026-05-26
- Started v2.1.215 after completing and releasing v2.1.214.
- Inspected current local ASR manager, API endpoints, config storage, and Brain UI settings.
- Added `src/voice/asr-providers.js` with ASR profile metadata and local/cloud provider summaries.
- Updated voice manager status to expose engine label, active profile, and provider summaries.
- Added `asrProfile` to persisted voice config and local ASR start/restart API payloads.
- Added Brain UI settings control for recognition mode: speed/balanced/accuracy.

- Bumped package version to 2.1.215.
- Updated README, CHANGELOG, backup document, and in-app release notes for v2.1.215.
- Verification: JS syntax checks and `npm run smoke:tools` passed.

- Committed v2.1.215 as `dffd83b feat: add asr provider profiles`.
- Tagged and pushed `v2.1.215` to origin.
- Created GitHub Release: https://github.com/xiaoguiwucan/BaiLongma/releases/tag/v2.1.215
- Uploaded release assets: source tarball and Git bundle under `backups/v2.1.215/`.
