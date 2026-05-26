import { getVoiceEventsProtocolMetadata, mapVoiceEventToXiaozhi, validateVoiceEventClientMessage, VOICE_EVENTS_TTS_SPEAK_LIMITS, normalizeVoiceEventsTTSSpeakLimits, sanitizeVoiceEventClientIdentity, negotiateVoiceEventClientCapabilities, getVoiceEventsOnboarding, getVoiceEventClientHealth, getVoiceEventLinkSummary, getVoiceEventLinkSelfCheck, getVoiceEventsOnboardingPackage } from '../src/voice/voice-event-bus.js'

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
assert(protocol.endpoints?.protocol === '/voice/events/protocol' && protocol.endpoints?.websocket === '/voice/events' && protocol.endpoints?.clients === '/voice/events/clients' && protocol.endpoints?.onboarding === '/voice/events/onboarding' && protocol.endpoints?.history === '/voice/events/history' && protocol.endpoints?.summary === '/voice/events/summary' && protocol.endpoints?.check === '/voice/events/check' && protocol.endpoints?.package === '/voice/events/package', 'protocol metadata exposes endpoints')
assert(protocol.auth?.localhostExempt === true && protocol.auth?.methods?.length >= 2, 'protocol metadata exposes auth methods')
assert(protocol.limits?.ttsSpeak?.maxTextChars === VOICE_EVENTS_TTS_SPEAK_LIMITS.maxTextChars && protocol.limits?.ttsSpeak?.cooldownMs === VOICE_EVENTS_TTS_SPEAK_LIMITS.cooldownMs, 'protocol metadata exposes tts speak limits')
assert(protocol.limits?.ttsSpeak?.scopes?.includes('connection') && protocol.limits?.ttsSpeak?.scopes?.includes('remoteAddress'), 'protocol metadata exposes tts speak limit scopes')
assert(protocol.capabilities.includes('client_identity') && protocol.clientMessages.includes('client:hello') && protocol.diagnosticsFields?.includes('negotiated') && protocol.diagnosticsFields?.includes('health'), 'protocol metadata exposes client identity diagnostics')
assert(protocol.capabilities.includes('audio_negotiation') && protocol.capabilities.includes('client_diagnostics') && protocol.capabilities.includes('client_onboarding') && protocol.capabilities.includes('event_history') && protocol.capabilities.includes('link_summary') && protocol.capabilities.includes('link_self_check') && protocol.capabilities.includes('onboarding_package') && protocol.negotiation?.audioModes?.includes('binary'), 'protocol metadata exposes audio negotiation and onboarding capability')
assert(protocol.identityFields.includes('capabilities') && protocol.clientCapabilityExamples.includes('binary_audio'), 'protocol metadata exposes client capability fields')
const customProtocol = getVoiceEventsProtocolMetadata({ ttsSpeakLimits: { maxTextChars: 123, cooldownMs: 456 }, auth: { tokenConfigured: true } })
assert(customProtocol.limits?.ttsSpeak?.maxTextChars === 123 && customProtocol.limits?.ttsSpeak?.cooldownMs === 456, 'protocol metadata accepts configured tts speak limits')
assert(customProtocol.auth?.tokenConfigured === true && customProtocol.auth?.requiredForRemote === true, 'protocol metadata accepts auth configuration')
assert(normalizeVoiceEventsTTSSpeakLimits({ maxTextChars: 99999, cooldownMs: -1 }).maxTextChars === 3000, 'tts speak limit normalization clamps max chars')
const identity = sanitizeVoiceEventClientIdentity({ type: 'client:hello', clientId: '  dev-1  ', device: 'xiaozhi\nESP32', app: 'bridge', capabilities: ['BINARY_AUDIO', 'wake', 'wake'] })
assert(identity.clientId === 'dev-1' && identity.device === 'xiaozhi ESP32' && identity.app === 'bridge', 'client identity sanitizer trims and removes control whitespace')
assert(identity.capabilities.includes('binary_audio') && identity.capabilities.includes('wake') && identity.capabilities.length === 2, 'client identity sanitizer normalizes capabilities')
assert(negotiateVoiceEventClientCapabilities(identity).audioMode === 'binary', 'client capability negotiation prefers binary audio')
assert(negotiateVoiceEventClientCapabilities({ capabilities: ['base64_audio'] }).audioMode === 'base64', 'client capability negotiation accepts base64 audio')
assert(negotiateVoiceEventClientCapabilities({ capabilities: ['wake'] }).audioMode === 'none', 'client capability negotiation handles no audio capability')
const onboarding = getVoiceEventsOnboarding({ host: '192.168.1.8', port: 3721, tokenConfigured: true })
assert(onboarding.urls?.lanWebSocket?.includes('192.168.1.8') && onboarding.urls.lanWebSocket.includes('token=<token>'), 'onboarding exposes LAN websocket URL with token hint')
assert(onboarding.messages?.clientHello?.type === 'client:hello' && onboarding.messages?.subscribe?.binaryAudio === true, 'onboarding exposes client hello and subscribe messages')
assert(getVoiceEventClientHealth({ identity: { clientId: 'dev', capabilities: ['binary_audio'] }, options: { audio: true, binaryAudio: true }, negotiated: { audioMode: 'binary' } }).level === 'ok', 'client health marks healthy binary subscriber ok')
assert(getVoiceEventClientHealth({ identity: { clientId: 'ws_1', capabilities: [] }, options: {}, negotiated: { audioMode: 'none' } }).level === 'warn', 'client health warns for unidentified clients without capabilities')
const emptySummary = getVoiceEventLinkSummary()
assert(emptySummary.level === 'offline' && emptySummary.issues.includes('no_clients') && emptySummary.suggestions.some(item => item.includes('没有外部语音客户端连接')), 'link summary reports offline when no clients are connected')
const selfCheck = getVoiceEventLinkSelfCheck()
assert(selfCheck.overall === 'warn' || selfCheck.overall === 'pending', 'self-check reports actionable status before device connection', JSON.stringify(selfCheck))
assert(selfCheck.steps.some(step => step.id === 'clients') && selfCheck.nextActions.length >= 1 && selfCheck.commands?.local?.includes('npm run voice:events'), 'self-check exposes steps, next actions, and onboarding command')
const onboardingPackage = getVoiceEventsOnboardingPackage({ host: '192.168.1.8', tokenConfigured: true, clientId: 'esp32-smoke' })
assert(onboardingPackage.urls?.lanWebSocket?.includes('192.168.1.8') && onboardingPackage.profile.clientId === 'esp32-smoke', 'onboarding package exposes LAN URL and profile')
assert(onboardingPackage.files?.['README.md']?.includes('client:hello') && onboardingPackage.files?.['node-client-example.mjs']?.includes('new WebSocket'), 'onboarding package includes README and node example')
assert(validateVoiceEventClientMessage({ type: 'ping' }).ok === true, 'client validation accepts ping')
assert(validateVoiceEventClientMessage({ type: 'client:hello', clientId: 'dev-1' }).ok === true, 'client validation accepts client hello')
assert(validateVoiceEventClientMessage({ type: 'tts:speak', text: '你好' }).ok === true, 'client validation accepts tts speak with text')
assert(validateVoiceEventClientMessage({ type: 'tts:speak', text: 'x'.repeat(VOICE_EVENTS_TTS_SPEAK_LIMITS.maxTextChars + 1) }).code === 'text_too_long', 'client validation rejects overlong tts speak')
assert(validateVoiceEventClientMessage({ type: 'tts:speak', text: 'x'.repeat(121) }, { limits: { maxTextChars: 120 } }).code === 'text_too_long', 'client validation uses configured max text chars')
assert(validateVoiceEventClientMessage({ type: 'tts:speak', text: '' }).code === 'missing_text', 'client validation rejects empty tts speak')
assert(validateVoiceEventClientMessage({ type: 'unknown' }).code === 'unsupported_type', 'client validation rejects unsupported type')
assert(validateVoiceEventClientMessage({}).code === 'missing_type', 'client validation rejects missing type')

const failed = checks.filter(item => !item.ok)
console.log(`\nVoice mapping smoke checks: ${checks.length - failed.length}/${checks.length} passed`)
if (failed.length) process.exitCode = 1
