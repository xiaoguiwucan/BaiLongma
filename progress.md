# Progress: v2.1.213 Voiceprint Stability Upgrade

## 2026-05-26
- Started v2.1.213 after completing and releasing v2.1.212.
- Inspected `sensevoice_server.py` speaker enrollment/verification and current Brain UI voiceprint settings.
- Updated SenseVoice speaker storage to support multiple enrollment embeddings, centroid calculation, sample metadata, and best-of-centroid/sample verification scoring.
- Added `speaker_test_start` / `speaker_test_finish` protocol to test the current user's voice against the stored voiceprint without sending text to the assistant.
- Added settings UI controls for voiceprint self-test and local voiceprint status.
- Reworked frontend voiceprint enrollment to record 7.5s, display sample count/calibration score, and apply recommended threshold when available.

- Bumped package version to 2.1.213.
- Updated README, CHANGELOG, backup document, and in-app release notes for v2.1.213.
- Verification: Python compile, JS syntax checks, and `npm run smoke:tools` passed.

- Committed v2.1.213 as `7e6ee1a feat: improve voiceprint enrollment stability`.
- Tagged and pushed `v2.1.213` to origin.
- Created GitHub Release: https://github.com/xiaoguiwucan/BaiLongma/releases/tag/v2.1.213
- Uploaded release assets: source tarball and Git bundle under `backups/v2.1.213/`.
