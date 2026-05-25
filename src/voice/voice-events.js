export const VOICE_EVENT_TYPES = Object.freeze({
  WAKE_START: 'wake:start',
  WAKE_ACCEPTED: 'wake:accepted',
  WAKE_REJECTED: 'wake:rejected',
  ASR_PARTIAL: 'asr:partial',
  ASR_FINAL: 'asr:final',
  SPEAKER_REJECTED: 'speaker:rejected',
  TTS_START: 'tts:start',
  TTS_SENTENCE_START: 'tts:sentence_start',
  TTS_SENTENCE_END: 'tts:sentence_end',
  TTS_STOP: 'tts:stop',
  INTERRUPT: 'interrupt',
  MEDIA_DUCK: 'media:duck',
  ERROR: 'error',
})

let seq = 0
const history = []

export function emitVoiceEvent(type, detail = {}) {
  const event = {
    type,
    seq: ++seq,
    at: Date.now(),
    detail: { ...detail },
  }
  history.push(event)
  if (history.length > 120) history.shift()
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('bailongma:voice-event', { detail: event }))
  }
  return event
}

export function getVoiceEventHistory() {
  return history.map(item => ({ ...item, detail: { ...item.detail } }))
}
