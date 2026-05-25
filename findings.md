# Findings: v2.1.213 Voiceprint Stability Upgrade

## Current baseline
- `src/voice/sensevoice_server.py` stores a single normalized embedding in `data/voiceprint.json`.
- Enrollment protocol: `speaker_enroll_start` -> PCM -> `speaker_enroll_finish` -> `speaker_enroll_ok`.
- Verification compares current embedding against stored embedding with cosine similarity and threshold default 0.55.
- UI has enroll button and threshold slider but no self-test/calibration workflow.

## Stability gaps
- One enrollment sample can be too narrow and reject the same user under different distance/noise/video conditions.
- User cannot test score before enabling strict speaker verification.
- Stored file has no useful sample metadata beyond embedding/model/threshold.
