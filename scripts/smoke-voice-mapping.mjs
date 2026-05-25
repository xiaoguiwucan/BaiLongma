import { getVoiceEventsProtocolMetadata, mapVoiceEventToXiaozhi, validateVoiceEventClientMessage, VOICE_EVENTS_TTS_SPEAK_LIMITS } from '../src/voice/voice-event-bus.js'

const checks = []
function assert(condition, label, detail = '') {
  checks.push({ ok: !!condition, label, detail })
  if (condition) console.log(`[PASS] ${label}`)
  else console.error(`[FAIL] ${label}${detail ? `\n  ${detail}` : ''}`)
}

const cases = [
  {
    label: 'asr partial maps to stt partial',
    event: { type: 'asr:partial', detail: { text: '你' } },
    expect: { type: 'stt', state: 'partial', text: '你' },
  },
  {
    label: 'asr final maps to stt final',
    event: { type: 'asr:final', detail: { text: '你好' } },
    expect: { type: 'stt', state: 'final', text: '你好' },
  },
  {
    label: 'wake accepted maps with word',
    event: { type: 'wake:accepted', detail: { text: '小白龙', word: '小白龙' } },
    expect: { type: 'wake', state: 'accepted', text: '小白龙', word: '小白龙' },
  },
  {
    label: 'wake rejected maps with reason',
    event: { type: 'wake:rejected', detail: { reason: 'no_keyword' } },
    expect: { type: 'wake', state: 'rejected', reason: 'no_keyword' },
  },
  {
    label: 'tts start maps with segment count',
    event: { type: 'tts:start', detail: { sessionId: 'tts_1', segmentCount: 2 } },
    expect: { type: 'tts', state: 'start', sessionId: 'tts_1', segmentCount: 2 },
  },
  {
    label: 'tts sentence start maps text',
    event: { type: 'tts:sentence_start', detail: { sessionId: 'tts_1', index: 0, text: '第一句' } },
    expect: { type: 'tts', state: 'sentence_start', sessionId: 'tts_1', index: 0, text: '第一句' },
  },
  {
    label: 'tts audio ready maps url and contentType',
    event: { type: 'tts:audio_ready', detail: { sessionId: 'tts_1', index: 0, text: '第一句', url: '/tts/session/tts_1/audio/0', contentType: 'audio/mpeg' } },
    expect: { type: 'tts', state: 'audio_ready', sessionId: 'tts_1', index: 0, text: '第一句', url: '/tts/session/tts_1/audio/0', contentType: 'audio/mpeg' },
  },
  {
    label: 'tts audio ready defaults contentType',
    event: { type: 'tts:audio_ready', detail: { sessionId: 'tts_1', index: 1, text: '第二句', url: '/x' } },
    expect: { type: 'tts', state: 'audio_ready', sessionId: 'tts_1', index: 1, text: '第二句', url: '/x', contentType: 'audio/mpeg' },
  },
  {
    label: 'tts sentence end maps text',
    event: { type: 'tts:sentence_end', detail: { sessionId: 'tts_1', index: 0, text: '第一句' } },
    expect: { type: 'tts', state: 'sentence_end', sessionId: 'tts_1', index: 0, text: '第一句' },
  },
  {
    label: 'tts stop maps reason',
    event: { type: 'tts:stop', detail: { reason: 'completed' } },
    expect: { type: 'tts', state: 'stop', reason: 'completed' },
  },
  {
    label: 'interrupt maps source fallback',
    event: { type: 'interrupt', detail: {} },
    expect: { type: 'interrupt', source: 'unknown' },
  },
]

function sameJson(a, b) {
  return JSON.stringify(a) === JSON.stringify(b)
}

for (const item of cases) {
  const actual = mapVoiceEventToXiaozhi(item.event)
  assert(sameJson(actual, item.expect), item.label, `expected=${JSON.stringify(item.expect)} actual=${JSON.stringify(actual)}`)
}

assert(mapVoiceEventToXiaozhi({ type: 'unknown:event', detail: {} }) === null, 'unknown event maps to null')
assert(mapVoiceEventToXiaozhi(null) === null, 'null event maps to null')

const protocol = getVoiceEventsProtocolMetadata()
assert(protocol.version >= 3 && protocol.capabilities.includes('tts_speak') && protocol.capabilities.includes('protocol_errors') && protocol.capabilities.includes('tts_speak_limits'), 'protocol metadata exposes version, tts_speak, protocol_errors, and tts_speak_limits')
assert(protocol.endpoints?.protocol === '/voice/events/protocol' && protocol.endpoints?.websocket === '/voice/events', 'protocol metadata exposes endpoints')
assert(protocol.limits?.ttsSpeak?.maxTextChars === VOICE_EVENTS_TTS_SPEAK_LIMITS.maxTextChars && protocol.limits?.ttsSpeak?.cooldownMs === VOICE_EVENTS_TTS_SPEAK_LIMITS.cooldownMs, 'protocol metadata exposes tts speak limits')
assert(validateVoiceEventClientMessage({ type: 'ping' }).ok === true, 'client validation accepts ping')
assert(validateVoiceEventClientMessage({ type: 'tts:speak', text: '你好' }).ok === true, 'client validation accepts tts speak with text')
assert(validateVoiceEventClientMessage({ type: 'tts:speak', text: 'x'.repeat(VOICE_EVENTS_TTS_SPEAK_LIMITS.maxTextChars + 1) }).code === 'text_too_long', 'client validation rejects overlong tts speak')
assert(validateVoiceEventClientMessage({ type: 'tts:speak', text: '' }).code === 'missing_text', 'client validation rejects empty tts speak')
assert(validateVoiceEventClientMessage({ type: 'unknown' }).code === 'unsupported_type', 'client validation rejects unsupported type')
assert(validateVoiceEventClientMessage({}).code === 'missing_type', 'client validation rejects missing type')

const failed = checks.filter(item => !item.ok)
console.log(`\nVoice mapping smoke checks: ${checks.length - failed.length}/${checks.length} passed`)
if (failed.length) process.exitCode = 1
