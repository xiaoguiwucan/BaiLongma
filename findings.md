# Findings: v2.1.215 ASR Provider Refactor

## Current baseline
- `src/voice/manager.js` maps `sensevoice-small` to engine `sensevoice`; Whisper model IDs map to engine `whisper`.
- `/voice/local/start` and `/voice/local/restart` accept `localAsrModel` / `model` / `whisperModel`.
- Settings UI exposes service provider and local model, but no recognition profile such as speed/balanced/accuracy.
- `src/config.js` stores `asrProvider`, `localAsrModel`, `whisperModel`, wake fields, and speaker settings.

## Needed refactor
- A provider metadata module so UI/API can describe local engines and future candidates without hardcoding everything in settings markup.
- A config field `asrProfile` for speed/balanced/accuracy.
- Manager status should expose engine label/profile metadata for debugging.
