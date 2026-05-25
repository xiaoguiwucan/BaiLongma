# Findings: v2.1.228 Voice Events Full TTS Lifecycle Mapping Smoke

## Current baseline
- v2.1.227 smoke verifies ASR final, wake accepted, and TTS audio_ready mappings.
- Full external playback needs more lifecycle coverage: start, sentence_start, sentence_end, and stop.
- All lifecycle mappings are deterministic in `voice-event-bus.js` and can be tested with synthetic publish events.

## Design finding
- TTS lifecycle smoke protects the event order vocabulary that hardware clients will use to start queues, play each sentence, and stop playback.
- Synthetic lifecycle tests do not prove audio quality, but they do protect the JSON protocol contract.

## Remaining future direction
- Add direct `tts:speak` event-order testing with a mock provider.
- Add audio chunk binary/base64 sequencing tests once provider mocking exists.
