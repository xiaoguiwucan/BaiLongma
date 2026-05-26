export const VOICE_EVENTS_PROTOCOL_VERSION = 3
export const VOICE_EVENTS_PROTOCOL_CAPABILITIES = Object.freeze(['json_events', 'tts_audio_chunks', 'tts_speak', 'protocol_errors', 'tts_speak_limits', 'client_identity', 'audio_negotiation', 'client_diagnostics', 'client_onboarding', 'event_history', 'link_summary', 'link_self_check', 'onboarding_package'])
export const VOICE_EVENTS_TTS_SPEAK_LIMITS = Object.freeze({
  maxTextChars: 800,
  cooldownMs: 1200,
})

export function normalizeVoiceEventsTTSSpeakLimits(limits = {}) {
  const maxTextChars = Number(limits.maxTextChars ?? limits.voiceEventsTtsSpeakMaxTextChars ?? VOICE_EVENTS_TTS_SPEAK_LIMITS.maxTextChars)
  const cooldownMs = Number(limits.cooldownMs ?? limits.voiceEventsTtsSpeakCooldownMs ?? VOICE_EVENTS_TTS_SPEAK_LIMITS.cooldownMs)
  return {
    maxTextChars: Number.isFinite(maxTextChars) ? Math.max(40, Math.min(3000, Math.round(maxTextChars))) : VOICE_EVENTS_TTS_SPEAK_LIMITS.maxTextChars,
    cooldownMs: Number.isFinite(cooldownMs) ? Math.max(0, Math.min(10000, Math.round(cooldownMs))) : VOICE_EVENTS_TTS_SPEAK_LIMITS.cooldownMs,
  }
}
export const VOICE_EVENTS_PROTOCOL_STATES = Object.freeze({
  wake: ['accepted', 'rejected'],
  stt: ['partial', 'final'],
  tts: ['start', 'session', 'sentence_start', 'audio_ready', 'audio_start', 'audio_chunk', 'audio_chunk_base64', 'audio_end', 'audio_error', 'sentence_end', 'stop', 'cancelled', 'error'],
  interrupt: ['interrupt'],
})


export function getVoiceEventsOnboarding({ host = '127.0.0.1', port = 3721, protocol = 'http:', tokenConfigured = false } = {}) {
  const safeHost = String(host || '127.0.0.1').replace(/^\[(.*)\]$/, '$1')
  const displayHost = ['localhost', '127.0.0.1', '::1'].includes(safeHost) ? '<Mac局域网IP>' : safeHost
  const wsScheme = protocol === 'https:' ? 'wss' : 'ws'
  const localWsUrl = `${wsScheme}://127.0.0.1:${port}/voice/events`
  const lanWsUrl = `${wsScheme}://${displayHost}:${port}/voice/events${tokenConfigured ? '?token=<token>' : ''}`
  const localCommand = `npm run voice:events -- listen --url ${localWsUrl} --audio --binary --client-id mac-debug --device mac --platform macos --capability binary_audio --capability wake --capability display`
  const lanCommand = `npm run voice:events -- listen --url ${lanWsUrl} --audio --binary --client-id esp32-test --device xiaozhi-esp32 --platform esp32 --capability binary_audio --capability wake --capability display`
  const clientHello = {
    type: 'client:hello',
    clientId: 'esp32-living-room',
    device: 'xiaozhi-esp32',
    app: 'bailongma-bridge',
    version: '0.1.0',
    platform: 'esp32',
    capabilities: ['binary_audio', 'tts_speak', 'wake', 'display'],
  }
  const subscribe = { type: 'subscribe', audio: true, binaryAudio: true }
  return {
    service: 'bailongma.voice.events',
    version: VOICE_EVENTS_PROTOCOL_VERSION,
    urls: {
      localWebSocket: localWsUrl,
      lanWebSocket: lanWsUrl,
      protocol: '/voice/events/protocol',
      clients: '/voice/events/clients',
      history: '/voice/events/history',
      summary: '/voice/events/summary',
      check: '/voice/events/check',
      package: '/voice/events/package',
    },
    commands: { local: localCommand, lan: lanCommand },
    messages: { clientHello, subscribe },
    notes: [
      'LAN devices must replace <Mac局域网IP> with this Mac\'s LAN IP address.',
      tokenConfigured ? 'A token is configured; remote clients should pass ?token=<token> or Authorization: Bearer <token>.' : 'No API token is configured; localhost is open and LAN access still depends on BAILONGMA_ALLOW_LAN.',
      'Send client:hello first, read client:accepted.negotiated.audioMode, then choose subscribe audio options.',
    ],
  }
}

export function getVoiceEventsProtocolMetadata({ ttsSpeakLimits, auth = {} } = {}) {
  const activeTTSSpeakLimits = normalizeVoiceEventsTTSSpeakLimits(ttsSpeakLimits)
  return {
    service: 'bailongma.voice.events',
    version: VOICE_EVENTS_PROTOCOL_VERSION,
    capabilities: [...VOICE_EVENTS_PROTOCOL_CAPABILITIES],
    endpoints: {
      websocket: '/voice/events',
      status: '/voice/events/status',
      clients: '/voice/events/clients',
      history: '/voice/events/history',
      summary: '/voice/events/summary',
      check: '/voice/events/check',
      package: '/voice/events/package',
      onboarding: '/voice/events/onboarding',
      protocol: '/voice/events/protocol',
      publish: '/voice/events/publish',
    },
    auth: {
      requiredForRemote: Boolean(auth.requiredForRemote ?? auth.tokenConfigured ?? false),
      tokenConfigured: Boolean(auth.tokenConfigured || false),
      methods: ['Authorization: Bearer <token>', '?token=<token>'],
      envVar: 'BAILONGMA_API_TOKEN',
      localhostExempt: true,
    },
    clientMessages: ['ping', 'client:hello', 'client:identify', 'subscribe', 'voice:subscribe', 'unsubscribe', 'voice:unsubscribe', 'tts:speak', 'speak', 'tts:cancel', 'cancel'],
    identityFields: ['clientId', 'device', 'app', 'version', 'platform', 'capabilities'],
    diagnosticsFields: ['audio', 'binaryAudio', 'identity', 'negotiated', 'health', 'advice'],
    clientCapabilityExamples: ['binary_audio', 'base64_audio', 'tts_speak', 'wake', 'display'],
    negotiation: {
      audioModes: ['none', 'binary', 'base64'],
      prefer: ['binary_audio', 'base64_audio'],
      returnedIn: 'client:accepted.negotiated',
      autoSubscribe: false,
    },
    errorCodes: ['invalid_json', 'invalid_message', 'missing_type', 'unsupported_type', 'missing_text', 'text_too_long', 'rate_limited'],
    mappedStates: Object.fromEntries(Object.entries(VOICE_EVENTS_PROTOCOL_STATES).map(([key, value]) => [key, [...value]])),
    limits: {
      ttsSpeak: {
        ...activeTTSSpeakLimits,
        scopes: ['connection', 'remoteAddress'],
      },
    },
    audio: {
      defaultContentType: 'audio/mpeg',
      binarySubscribe: { type: 'subscribe', audio: true, binaryAudio: true },
      base64Subscribe: { type: 'subscribe', audio: true },
    },
  }
}

const clients = new Set()
const clientOptions = new WeakMap()
const clientIdentities = new WeakMap()
let clientSerial = 0
const history = []

export function getVoiceEventHistory({ limit = 50, type = '' } = {}) {
  const max = Math.max(1, Math.min(100, Math.round(Number(limit) || 50)))
  const wantedType = String(type || '').trim()
  const items = wantedType
    ? history.filter(item => item.event?.type === wantedType || item.xiaozhi?.type === wantedType)
    : history
  return items.slice(-max).map(item => ({
    type: item.type,
    event: item.event,
    xiaozhi: item.xiaozhi,
  }))
}

export function sendVoiceEventClientJson(ws, payload) {
  safeSend(ws, payload)
}

function safeSend(ws, payload) {
  try {
    if (ws.readyState === 1) ws.send(JSON.stringify(payload))
  } catch {}
}

function safeSendBinary(ws, chunk) {
  try {
    if (ws.readyState === 1) ws.send(chunk)
  } catch {}
}

function getOptions(ws) {
  return clientOptions.get(ws) || { audio: false, binaryAudio: false }
}

function setOptions(ws, next = {}) {
  const prev = getOptions(ws)
  const options = {
    audio: Boolean(next.audio ?? prev.audio),
    binaryAudio: Boolean(next.binaryAudio ?? next.binary ?? prev.binaryAudio),
  }
  clientOptions.set(ws, options)
  return options
}

export function setVoiceEventClientOptions(ws, next = {}) {
  return setOptions(ws, next)
}

export function getVoiceEventClientOptions(ws) {
  return { ...getOptions(ws) }
}

function cleanIdentityValue(value, max = 80) {
  return String(value || '').trim().replace(/[\r\n\t]+/g, ' ').slice(0, max)
}

function sanitizeClientCapabilities(value) {
  const items = Array.isArray(value) ? value : String(value || '').split(/[,，、\s]+/)
  return [...new Set(items.map(item => cleanIdentityValue(item, 40).toLowerCase()).filter(Boolean))].slice(0, 16)
}

export function negotiateVoiceEventClientCapabilities(identity = {}) {
  const capabilities = Array.isArray(identity.capabilities) ? identity.capabilities : sanitizeClientCapabilities(identity.capabilities)
  const audioMode = capabilities.includes('binary_audio')
    ? 'binary'
    : capabilities.includes('base64_audio')
      ? 'base64'
      : 'none'
  return {
    audioMode,
    binaryAudio: audioMode === 'binary',
    base64Audio: audioMode === 'base64',
    shouldSubscribeAudio: false,
    reason: audioMode === 'none' ? 'client_did_not_declare_audio_capability' : 'client_capability',
  }
}

export function sanitizeVoiceEventClientIdentity(msg = {}) {
  const identity = {
    clientId: cleanIdentityValue(msg.clientId || msg.id || msg.name || `client_${Date.now()}`, 96),
    device: cleanIdentityValue(msg.device || msg.deviceName || msg.hardware, 96),
    app: cleanIdentityValue(msg.app || msg.appName || msg.client || 'unknown', 96),
    version: cleanIdentityValue(msg.version || msg.appVersion, 48),
    platform: cleanIdentityValue(msg.platform || msg.os, 48),
    capabilities: sanitizeClientCapabilities(msg.capabilities || msg.features),
    identifiedAt: Date.now(),
  }
  return Object.fromEntries(Object.entries(identity).filter(([, value]) => value !== ''))
}

export function setVoiceEventClientIdentity(ws, identity = {}) {
  const current = clientIdentities.get(ws) || {}
  const next = { ...current, ...identity, updatedAt: Date.now(), lastSeenAt: Date.now() }
  clientIdentities.set(ws, next)
  return { ...next }
}

export function getVoiceEventClientIdentity(ws) {
  return { ...(clientIdentities.get(ws) || {}) }
}

export function touchVoiceEventClient(ws) {
  const current = clientIdentities.get(ws) || {}
  const next = { ...current, lastSeenAt: Date.now() }
  clientIdentities.set(ws, next)
  return { ...next }
}

export function createVoiceEventProtocolError(code, message, extra = {}) {
  return {
    type: 'protocol_error',
    code: String(code || 'protocol_error'),
    message: String(message || 'Voice event protocol error'),
    at: Date.now(),
    ...extra,
  }
}

export function sendVoiceEventProtocolError(ws, code, message, extra = {}) {
  const payload = createVoiceEventProtocolError(code, message, extra)
  safeSend(ws, payload)
  return payload
}

export function validateVoiceEventClientMessage(msg, { limits = VOICE_EVENTS_TTS_SPEAK_LIMITS } = {}) {
  if (!msg || typeof msg !== 'object' || Buffer.isBuffer(msg) || Array.isArray(msg)) {
    return { ok: false, code: 'invalid_message', message: 'Client message must be a JSON object.' }
  }
  if (typeof msg.type !== 'string' || !msg.type.trim()) {
    return { ok: false, code: 'missing_type', message: 'Client message must include a non-empty string type.' }
  }
  const type = msg.type.trim()
  const requestId = msg.requestId || msg.id || undefined
  const supported = new Set(['ping', 'client:hello', 'client:identify', 'subscribe', 'voice:subscribe', 'unsubscribe', 'voice:unsubscribe', 'tts:speak', 'speak', 'tts:cancel', 'cancel'])
  if (!supported.has(type)) {
    return { ok: false, code: 'unsupported_type', message: `Unsupported voice event client message type: ${type}`, receivedType: type, requestId }
  }
  if (type === 'tts:speak' || type === 'speak') {
    const text = String(msg.text || msg.ttsText || '').trim()
    if (!text) {
      return { ok: false, code: 'missing_text', message: 'tts:speak requires non-empty text or ttsText.', receivedType: type, requestId }
    }
    const maxTextChars = Number(limits?.maxTextChars || VOICE_EVENTS_TTS_SPEAK_LIMITS.maxTextChars)
    if (text.length > maxTextChars) {
      return { ok: false, code: 'text_too_long', message: `tts:speak text exceeds ${maxTextChars} characters.`, receivedType: type, requestId, limit: maxTextChars, actual: text.length }
    }
  }
  return { ok: true, type, requestId }
}

export function addVoiceEventClient(ws, { ttsSpeakLimits, auth } = {}) {
  clients.add(ws)
  clientOptions.set(ws, { audio: false, binaryAudio: false })
  clientSerial += 1
  setVoiceEventClientIdentity(ws, { clientId: `ws_${clientSerial}`, app: 'unknown', connectedAt: Date.now() })
  ws.voiceEventsTTSSpeakLimits = normalizeVoiceEventsTTSSpeakLimits(ttsSpeakLimits)
  safeSend(ws, { type: 'hello', ...getVoiceEventsProtocolMetadata({ ttsSpeakLimits: ws.voiceEventsTTSSpeakLimits, auth }), history: history.slice(-20) })
}

export function removeVoiceEventClient(ws) {
  clients.delete(ws)
  clientOptions.delete(ws)
  clientIdentities.delete(ws)
}

function parseClientMessage(raw) {
  if (raw && typeof raw === 'object' && !Buffer.isBuffer(raw)) return raw
  return JSON.parse(raw.toString())
}

export function handleVoiceEventClientMessage(ws, raw) {
  let msg
  try {
    msg = parseClientMessage(raw)
  } catch {
    const error = sendVoiceEventProtocolError(ws, 'invalid_json', 'Client message must be valid JSON.')
    return { handled: true, error }
  }
  const validation = validateVoiceEventClientMessage(msg)
  if (!validation.ok) {
    const error = sendVoiceEventProtocolError(ws, validation.code, validation.message, { requestId: validation.requestId, receivedType: validation.receivedType })
    return { handled: true, error }
  }
  if (msg?.type === 'ping') {
    touchVoiceEventClient(ws)
    safeSend(ws, { type: 'pong', at: Date.now() })
    return { handled: true }
  }
  if (msg?.type === 'client:hello' || msg?.type === 'client:identify') {
    const identity = setVoiceEventClientIdentity(ws, sanitizeVoiceEventClientIdentity(msg))
    const negotiated = negotiateVoiceEventClientCapabilities(identity)
    safeSend(ws, { type: 'client:accepted', service: 'bailongma.voice.events', identity, negotiated })
    return { handled: true, identity, negotiated }
  }
  if (msg?.type === 'subscribe' || msg?.type === 'voice:subscribe') {
    touchVoiceEventClient(ws)
    const options = setOptions(ws, {
      audio: msg.audio === true || msg.ttsAudio === true,
      binaryAudio: msg.binaryAudio === true || msg.binary === true,
    })
    safeSend(ws, { type: 'subscribed', service: 'bailongma.voice.events', options })
    return { handled: true, options }
  }
  if (msg?.type === 'unsubscribe' || msg?.type === 'voice:unsubscribe') {
    touchVoiceEventClient(ws)
    const options = setOptions(ws, {
      audio: msg.audio === false ? false : getOptions(ws).audio,
      binaryAudio: msg.binaryAudio === false || msg.binary === false ? false : getOptions(ws).binaryAudio,
    })
    safeSend(ws, { type: 'subscribed', service: 'bailongma.voice.events', options })
    return { handled: true, options }
  }
  if (msg?.type === 'client:hello' || msg?.type === 'client:identify' || msg?.type === 'tts:speak' || msg?.type === 'speak' || msg?.type === 'tts:cancel' || msg?.type === 'cancel') {
    return { handled: false, message: msg, validation }
  }
  const error = sendVoiceEventProtocolError(ws, 'unsupported_type', `Unsupported voice event client message type: ${msg?.type}`, { receivedType: msg?.type })
  return { handled: true, error }
}

export function mapVoiceEventToXiaozhi(event) {
  const type = event?.type
  const detail = event?.detail || {}
  if (type === 'tts:start') return { type: 'tts', state: 'start', sessionId: detail.sessionId, segmentCount: detail.segmentCount }
  if (type === 'tts:sentence_start') return { type: 'tts', state: 'sentence_start', sessionId: detail.sessionId, index: detail.index, text: detail.text }
  if (type === 'tts:audio_ready') return {
    type: 'tts',
    state: 'audio_ready',
    sessionId: detail.sessionId,
    index: detail.index,
    text: detail.text,
    url: detail.url,
    contentType: detail.contentType || 'audio/mpeg',
  }
  if (type === 'tts:sentence_end') return { type: 'tts', state: 'sentence_end', sessionId: detail.sessionId, index: detail.index, text: detail.text }
  if (type === 'tts:stop') return { type: 'tts', state: 'stop', reason: detail.reason }
  if (type === 'asr:partial') return { type: 'stt', state: 'partial', text: detail.text }
  if (type === 'asr:final') return { type: 'stt', state: 'final', text: detail.text }
  if (type === 'wake:accepted') return { type: 'wake', state: 'accepted', text: detail.text, word: detail.word }
  if (type === 'wake:rejected') return { type: 'wake', state: 'rejected', reason: detail.reason }
  if (type === 'interrupt') return { type: 'interrupt', source: detail.source || 'unknown' }
  return null
}

export function publishVoiceEvent(event) {
  const normalized = {
    type: event?.type || 'unknown',
    seq: Number(event?.seq || 0),
    at: Number(event?.at || Date.now()),
    detail: event?.detail || {},
  }
  const payload = { type: 'voice_event', event: normalized }
  const xiaozhi = mapVoiceEventToXiaozhi(normalized)
  history.push({ ...payload, xiaozhi })
  if (history.length > 100) history.shift()
  for (const ws of clients) {
    safeSend(ws, payload)
    if (xiaozhi) safeSend(ws, xiaozhi)
  }
  return { delivered: clients.size, xiaozhi }
}


export function getVoiceEventMetricsWindow({ since = 0, until = Date.now() } = {}) {
  const start = Number(since || 0)
  const end = Number(until || Date.now())
  const metrics = { total: 0, wakeAccepted: 0, wakeRejected: 0, asrFinal: 0, ttsStop: 0 }
  for (const item of history) {
    const event = item.event || {}
    const at = Number(event.at || event.ts || item.at || 0)
    if (start && at < start) continue
    if (end && at > end) continue
    metrics.total += 1
    if (event.type === 'wake:accepted') metrics.wakeAccepted += 1
    else if (event.type === 'wake:rejected') metrics.wakeRejected += 1
    else if (event.type === 'asr:final') metrics.asrFinal += 1
    else if (event.type === 'tts:stop') metrics.ttsStop += 1
  }
  metrics.acceptanceRate = metrics.wakeAccepted + metrics.wakeRejected > 0
    ? Number((metrics.wakeAccepted / (metrics.wakeAccepted + metrics.wakeRejected)).toFixed(3))
    : null
  return metrics
}

export function sendVoiceEventToClient(ws, event) {
  const normalized = {
    type: event?.type || 'unknown',
    seq: Number(event?.seq || 0),
    at: Number(event?.at || Date.now()),
    detail: event?.detail || {},
  }
  const payload = { type: 'voice_event', event: normalized }
  const xiaozhi = mapVoiceEventToXiaozhi(normalized)
  safeSend(ws, payload)
  if (xiaozhi) safeSend(ws, xiaozhi)
  return { delivered: ws?.readyState === 1 ? 1 : 0, xiaozhi }
}

function audioSubscribers() {
  return [...clients].filter(ws => getOptions(ws).audio)
}

export function publishTTSAudioStart({ sessionId, index, contentType = 'audio/mpeg', targetClient = null } = {}) {
  const payload = { type: 'tts', state: 'audio_start', sessionId, index, contentType, at: Date.now() }
  const subscribers = targetClient ? [targetClient] : audioSubscribers()
  for (const ws of subscribers) safeSend(ws, payload)
  return { delivered: subscribers.length }
}

export function publishTTSAudioChunk({ sessionId, index, chunk, contentType = 'audio/mpeg', targetClient = null } = {}) {
  if (!chunk?.length) return { delivered: 0 }
  let delivered = 0
  const subscribers = targetClient ? [targetClient] : audioSubscribers()
  for (const ws of subscribers) {
    const options = getOptions(ws)
    safeSend(ws, { type: 'tts', state: 'audio_chunk', sessionId, index, contentType, bytes: chunk.length, binary: options.binaryAudio, at: Date.now() })
    if (options.binaryAudio) safeSendBinary(ws, chunk)
    else safeSend(ws, { type: 'tts', state: 'audio_chunk_base64', sessionId, index, contentType, data: Buffer.from(chunk).toString('base64'), at: Date.now() })
    delivered += 1
  }
  return { delivered }
}

export function publishTTSAudioEnd({ sessionId, index, targetClient = null } = {}) {
  const payload = { type: 'tts', state: 'audio_end', sessionId, index, at: Date.now() }
  const subscribers = targetClient ? [targetClient] : audioSubscribers()
  for (const ws of subscribers) safeSend(ws, payload)
  return { delivered: subscribers.length }
}

export function publishTTSAudioError({ sessionId, index, error, targetClient = null } = {}) {
  const payload = { type: 'tts', state: 'audio_error', sessionId, index, error: String(error || 'unknown'), at: Date.now() }
  const subscribers = targetClient ? [targetClient] : audioSubscribers()
  for (const ws of subscribers) safeSend(ws, payload)
  return { delivered: subscribers.length }
}


export function getVoiceEventClientHealth({ identity = {}, options = {}, negotiated = {} } = {}) {
  const capabilities = Array.isArray(identity.capabilities) ? identity.capabilities : sanitizeClientCapabilities(identity.capabilities)
  const advice = []
  if (!identity.clientId || String(identity.clientId).startsWith('ws_')) advice.push('建议发送 client:hello 标识设备')
  if (!capabilities.length) advice.push('未声明 capabilities')
  if (negotiated.audioMode === 'none') advice.push('未声明 binary_audio/base64_audio')
  if (negotiated.audioMode !== 'none' && !options.audio) advice.push('可发送 subscribe 开启音频')
  if (options.audio && negotiated.audioMode === 'binary' && !options.binaryAudio) advice.push('建议 binaryAudio=true')
  const level = advice.length === 0 ? 'ok' : advice.some(item => item.includes('client:hello') || item.includes('capabilities')) ? 'warn' : 'info'
  return {
    level,
    ok: level === 'ok',
    advice: advice.length ? advice : ['链路正常'],
  }
}

export function getVoiceEventClientDetails() {
  return [...clients].map(ws => {
    const identity = getVoiceEventClientIdentity(ws)
    const options = getOptions(ws)
    const negotiated = negotiateVoiceEventClientCapabilities(identity)
    const health = getVoiceEventClientHealth({ identity, options, negotiated })
    return {
      audio: options.audio,
      binaryAudio: options.binaryAudio,
      identity,
      negotiated,
      health,
      advice: health.advice,
    }
  })
}


function wakeRejectAdvice(reason = '') {
  const key = String(reason || 'unknown')
  if (key === 'command too short') return '唤醒后指令太短：降低“最短指令字数”，或说完整命令如“龙马，打开灯”。'
  if (key === 'wake confidence too low') return '唤醒置信度偏低：确认唤醒词在句首，必要时降低“唤醒置信度阈值”。'
  if (key === 'wake cooldown') return '唤醒冷却中：如果连续指令很多，可缩短“唤醒冷却时间”。'
  if (key === 'speaker verification required for wake') return '声纹未通过：重新录入声纹、降低声纹严格度，或关闭“唤醒也必须通过声纹”。'
  if (key === 'repeat suppressed') return '重复误识别已抑制：这是正常保护；如果误抑制，可关闭重复误识别抑制。'
  if (key === 'wake not at prefix') return '严格模式要求唤醒词在句首：请说“龙马，……”，或切到宽松模式。'
  if (key === 'wake missing') return '没有检测到唤醒词：检查唤醒词列表或提高说话清晰度。'
  return '唤醒被拒绝：查看最近语音事件中的 reason/confidence，再调整唤醒词、声纹或视频抗干扰。'
}

function countRecentVoiceEvents({ since = Date.now() - 60000 } = {}) {
  const counts = { total: 0, wakeAccepted: 0, wakeRejected: 0, speakerAccepted: 0, speakerRejected: 0, asrFinal: 0, asrPartial: 0, ttsStart: 0, ttsStop: 0, interrupt: 0, unknown: 0 }
  const wakeRejectedReasons = {}
  const wakeRejectedDetails = []
  const speakerRejectedDetails = []
  for (const item of history) {
    const event = item.event || {}
    const detail = event.detail || {}
    const at = Number(event.at || event.ts || item.at || 0)
    if (at && at < since) continue
    counts.total += 1
    if (event.type === 'wake:accepted') counts.wakeAccepted += 1
    else if (event.type === 'wake:rejected') {
      counts.wakeRejected += 1
      const reason = String(detail.reason || 'unknown')
      wakeRejectedReasons[reason] = (wakeRejectedReasons[reason] || 0) + 1
      wakeRejectedDetails.push({
        reason,
        text: detail.text || '',
        confidence: detail.confidence,
        threshold: detail.threshold,
        minCommandChars: detail.minCommandChars,
        remainingMs: detail.remainingMs,
        advice: wakeRejectAdvice(reason),
      })
    }
    else if (event.type === 'speaker:accepted') counts.speakerAccepted += 1
    else if (event.type === 'speaker:rejected') {
      counts.speakerRejected += 1
      speakerRejectedDetails.push({
        reason: detail.reason || 'speaker verification failed',
        score: detail.score,
        threshold: detail.threshold,
        advice: '声纹拒绝：如果这是你的声音，请降低“声纹严格度”、重新录入 6–8 秒声纹，或暂时关闭“只响应我的声音”。',
      })
    }
    else if (event.type === 'asr:final') counts.asrFinal += 1
    else if (event.type === 'asr:partial') counts.asrPartial += 1
    else if (event.type === 'tts:start') counts.ttsStart += 1
    else if (event.type === 'tts:stop') counts.ttsStop += 1
    else if (event.type === 'interrupt') counts.interrupt += 1
    else counts.unknown += 1
  }
  counts.wakeRejectedReasons = wakeRejectedReasons
  counts.wakeRejectedDetails = wakeRejectedDetails.slice(-8)
  counts.speakerRejectedDetails = speakerRejectedDetails.slice(-8)
  return counts
}

export function getVoiceEventLinkSummary({ windowMs = 60000 } = {}) {
  const now = Date.now()
  const windowSize = Math.max(5000, Math.min(10 * 60 * 1000, Math.round(Number(windowMs) || 60000)))
  const clientDetails = getVoiceEventClientDetails()
  const status = getVoiceEventBusStatus()
  const recent = countRecentVoiceEvents({ since: now - windowSize })
  const issues = []
  const suggestions = []
  if (!clientDetails.length) {
    issues.push('no_clients')
    suggestions.push('没有外部语音客户端连接：先运行本机调试命令或接入 ESP32/手机端。')
  }
  if (clientDetails.length && !status.audioSubscribers) {
    issues.push('no_audio_subscribers')
    suggestions.push('客户端已连接但未订阅音频：发送 subscribe audio=true，二进制设备建议 binaryAudio=true。')
  }
  const unhealthy = clientDetails.filter(client => client.health && client.health.ok === false)
  if (unhealthy.length) {
    issues.push('client_health_warnings')
    suggestions.push('存在未完成握手或 capabilities 不完整的客户端：检查 client:hello、binary_audio/base64_audio。')
  }
  if (recent.wakeRejected > recent.wakeAccepted && recent.wakeRejected >= 2) {
    issues.push('wake_rejected_high')
    const topReject = Object.entries(recent.wakeRejectedReasons || {}).sort((a, b) => b[1] - a[1])[0]
    suggestions.push(topReject ? `最近唤醒拒绝偏多，主要原因：${topReject[0]}（${topReject[1]} 次）。${wakeRejectAdvice(topReject[0])}` : '最近唤醒拒绝偏多：检查唤醒词、声纹阈值和视频抗干扰设置。')
  }
  if (recent.speakerRejected > 0 && recent.speakerRejected >= recent.speakerAccepted) {
    issues.push('speaker_rejected_high')
    suggestions.push('最近声纹拒绝偏多：如果被拒绝的是你本人，请降低“声纹严格度”、重新录入声纹，或暂时关闭“只响应我的声音”。')
  }
  for (const detail of recent.wakeRejectedDetails || []) {
    if (detail.reason && !issues.includes(`wake_guard_${detail.reason.replace(/\W+/g, '_')}`)) {
      issues.push(`wake_guard_${detail.reason.replace(/\W+/g, '_')}`)
      suggestions.push(detail.advice)
    }
  }
  if (recent.asrFinal === 0 && recent.wakeAccepted > 0) {
    issues.push('wake_without_asr_final')
    suggestions.push('有唤醒但没有最终识别：检查麦克风采集、VAD 截断和本地 ASR 服务。')
  }
  if (recent.ttsStart > recent.ttsStop) {
    issues.push('tts_maybe_stuck')
    suggestions.push('TTS start 多于 stop：可能存在播报未结束或取消事件未上报。')
  }
  if (!suggestions.length) suggestions.push('链路整体正常：客户端、订阅、事件历史均可观测。')
  const level = issues.includes('no_clients') ? 'offline' : issues.length ? 'warn' : 'ok'
  return {
    ok: level === 'ok',
    level,
    windowMs: windowSize,
    checkedAt: now,
    status: {
      clients: status.clients,
      audioSubscribers: status.audioSubscribers,
      binaryAudioSubscribers: status.binaryAudioSubscribers,
      history: status.history,
      version: status.version,
    },
    recent,
    issues,
    suggestions,
    clientDetails,
  }
}



export function getVoiceEventsOnboardingPackage({ host = '127.0.0.1', port = 3721, protocol = 'http:', tokenConfigured = false, clientId = 'esp32-test', device = 'xiaozhi-esp32', platform = 'esp32' } = {}) {
  const onboarding = getVoiceEventsOnboarding({ host, port, protocol, tokenConfigured })
  const clientHello = {
    ...onboarding.messages.clientHello,
    clientId: cleanIdentityValue(clientId || onboarding.messages.clientHello.clientId, 96),
    device: cleanIdentityValue(device || onboarding.messages.clientHello.device, 96),
    platform: cleanIdentityValue(platform || onboarding.messages.clientHello.platform, 48),
  }
  const wsUrl = onboarding.urls.lanWebSocket
  const localWsUrl = onboarding.urls.localWebSocket
  const env = [
    `BAILONGMA_VOICE_WS=${wsUrl}`,
    `BAILONGMA_VOICE_CLIENT_ID=${clientHello.clientId}`,
    `BAILONGMA_VOICE_DEVICE=${clientHello.device}`,
    `BAILONGMA_VOICE_PLATFORM=${clientHello.platform}`,
    `BAILONGMA_VOICE_CAPABILITIES=${clientHello.capabilities.join(',')}`,
    tokenConfigured ? 'BAILONGMA_API_TOKEN=<token>' : '# BAILONGMA_API_TOKEN=<token>  # 如服务端启用 token 再填写',
  ].join('\n')
  const nodeExample = `import WebSocket from 'ws'

const url = process.env.BAILONGMA_VOICE_WS || '${wsUrl}'
const ws = new WebSocket(url)

ws.on('open', () => {
  ws.send(JSON.stringify(${JSON.stringify(clientHello, null, 2)}))
  ws.send(JSON.stringify(${JSON.stringify(onboarding.messages.subscribe)}))
})

ws.on('message', (data) => {
  const text = Buffer.isBuffer(data) ? data.toString('utf8') : String(data)
  try { console.log(JSON.parse(text)) } catch { console.log('[binary/audio]', data.length || text.length) }
})
`
  const esp32Pseudo = `// ESP32/Xiaozhi-style bridge pseudo config
voice_ws_url = "${wsUrl}";
client_hello = ${JSON.stringify(clientHello)};
subscribe = ${JSON.stringify(onboarding.messages.subscribe)};
// 连接后先发送 client_hello，再发送 subscribe；收到 tts/audio_chunk 或二进制音频后播放。
`
  const readme = [
    '# BaiLongma Voice Client Onboarding Package',
    '',
    '## 1. 选择连接地址',
    `- 本机调试：${localWsUrl}`,
    `- 局域网设备：${wsUrl}`,
    '',
    '## 2. 先发送 client:hello',
    '```json',
    JSON.stringify(clientHello, null, 2),
    '```',
    '',
    '## 3. 再订阅音频',
    '```json',
    JSON.stringify(onboarding.messages.subscribe, null, 2),
    '```',
    '',
    '## 4. 调试命令',
    '```bash',
    onboarding.commands.local,
    onboarding.commands.lan,
    '```',
    '',
    '## 5. 注意事项',
    ...onboarding.notes.map(note => `- ${note}`),
  ].join('\n')
  return {
    service: 'bailongma.voice.events',
    version: VOICE_EVENTS_PROTOCOL_VERSION,
    generatedAt: Date.now(),
    profile: { clientId: clientHello.clientId, device: clientHello.device, platform: clientHello.platform, capabilities: clientHello.capabilities },
    urls: { ...onboarding.urls, package: '/voice/events/package' },
    commands: onboarding.commands,
    messages: { clientHello, subscribe: onboarding.messages.subscribe },
    files: {
      'README.md': readme,
      '.env.voice': env,
      'client-hello.json': JSON.stringify(clientHello, null, 2),
      'subscribe.json': JSON.stringify(onboarding.messages.subscribe, null, 2),
      'node-client-example.mjs': nodeExample,
      'esp32-bridge-pseudo.txt': esp32Pseudo,
    },
    checklist: [
      'Mac 与设备在同一局域网，防火墙允许访问 BaiLongma API 端口。',
      '设备连接 WebSocket 后先发送 client:hello。',
      '设备根据 client:accepted.negotiated.audioMode 决定 binaryAudio/base64 订阅。',
      'Brain UI 中点击“一键自检”，确认客户端、音频订阅、事件闭环通过。',
    ],
  }
}

export function getVoiceEventLinkSelfCheck({ windowMs = 60000, host = '127.0.0.1', port = 3721, protocol = 'http:', tokenConfigured = false } = {}) {
  const summary = getVoiceEventLinkSummary({ windowMs })
  const onboarding = getVoiceEventsOnboarding({ host, port, protocol, tokenConfigured })
  const protocolMeta = getVoiceEventsProtocolMetadata({ auth: { tokenConfigured } })
  const steps = []
  const addStep = (id, label, status, detail, action = '') => steps.push({ id, label, status, detail, action })
  addStep(
    'protocol',
    '协议能力',
    protocolMeta.capabilities.includes('json_events') && protocolMeta.capabilities.includes('link_summary') ? 'ok' : 'error',
    `协议 v${protocolMeta.version}，能力 ${protocolMeta.capabilities.length} 项`,
    '如果这里异常，请重启桌面应用或检查 /voice/events/protocol。',
  )
  addStep(
    'clients',
    '客户端连接',
    summary.status.clients > 0 ? 'ok' : 'warn',
    summary.status.clients > 0 ? `已连接 ${summary.status.clients} 个客户端` : '还没有外部客户端连接',
    summary.status.clients > 0 ? '保持设备在线。' : onboarding.commands.local,
  )
  addStep(
    'identity',
    '设备握手',
    summary.clientDetails.some(client => client.identity && !String(client.identity.clientId || '').startsWith('ws_')) ? 'ok' : summary.status.clients > 0 ? 'warn' : 'pending',
    summary.status.clients > 0 ? '检查 client:hello / capabilities' : '等待客户端连接后检查握手',
    '设备连接后先发送 client:hello，包含 clientId/device/platform/capabilities。',
  )
  addStep(
    'audio_subscription',
    '音频订阅',
    summary.status.audioSubscribers > 0 ? 'ok' : summary.status.clients > 0 ? 'warn' : 'pending',
    summary.status.audioSubscribers > 0 ? `音频订阅 ${summary.status.audioSubscribers} 个` : '尚未发现音频订阅',
    '发送 subscribe: {"type":"subscribe","audio":true,"binaryAudio":true}。',
  )
  addStep(
    'binary_audio',
    '二进制音频',
    summary.status.binaryAudioSubscribers > 0 ? 'ok' : summary.status.audioSubscribers > 0 ? 'warn' : 'pending',
    summary.status.binaryAudioSubscribers > 0 ? `二进制订阅 ${summary.status.binaryAudioSubscribers} 个` : '未启用二进制音频或未订阅音频',
    'ESP32/局域网设备优先声明 binary_audio，并订阅 binaryAudio=true。',
  )
  addStep(
    'recent_events',
    '最近事件',
    summary.recent.total > 0 ? 'ok' : summary.status.clients > 0 ? 'warn' : 'pending',
    summary.recent.total > 0 ? `最近 ${Math.round(summary.windowMs / 1000)} 秒 ${summary.recent.total} 个事件` : '还没有唤醒/识别/TTS 事件',
    '触发一次唤醒词或发送 POST /voice/events/publish 测试事件。',
  )
  addStep(
    'wake_asr_tts',
    '唤醒→识别→播报闭环',
    summary.recent.wakeAccepted > 0 && summary.recent.asrFinal > 0 && summary.recent.ttsStop > 0 ? 'ok' : summary.recent.wakeAccepted > 0 || summary.recent.asrFinal > 0 || summary.recent.ttsStart > 0 ? 'warn' : 'pending',
    `wake ${summary.recent.wakeAccepted}/${summary.recent.wakeRejected} · asrFinal ${summary.recent.asrFinal} · tts ${summary.recent.ttsStart}/${summary.recent.ttsStop}`,
    '如果缺 ASR，检查麦克风/VAD/本地 ASR；如果缺 TTS stop，检查 TTS session 和音频播放。',
  )
  const errorCount = steps.filter(step => step.status === 'error').length
  const warnCount = steps.filter(step => step.status === 'warn').length
  const pendingCount = steps.filter(step => step.status === 'pending').length
  const overall = errorCount ? 'error' : warnCount ? 'warn' : pendingCount ? 'pending' : 'ok'
  const nextActions = steps.filter(step => step.status !== 'ok').map(step => ({ id: step.id, label: step.label, action: step.action })).slice(0, 4)
  if (!nextActions.length) nextActions.push({ id: 'ready', label: '可以实测', action: '现在可以喊唤醒词并观察最近语音事件时间线。' })
  return {
    ok: overall === 'ok',
    service: 'bailongma.voice.events',
    version: VOICE_EVENTS_PROTOCOL_VERSION,
    checkedAt: Date.now(),
    overall,
    counts: { ok: steps.filter(step => step.status === 'ok').length, warn: warnCount, pending: pendingCount, error: errorCount },
    steps,
    nextActions,
    commands: onboarding.commands,
    messages: onboarding.messages,
    urls: onboarding.urls,
    summary,
  }
}

export function getVoiceEventBusStatus() {
  let audioSubscribers = 0
  let binaryAudioSubscribers = 0
  for (const ws of clients) {
    const options = getOptions(ws)
    if (options.audio) audioSubscribers += 1
    if (options.audio && options.binaryAudio) binaryAudioSubscribers += 1
  }
  return {
    clients: clients.size,
    history: history.length,
    audioSubscribers,
    binaryAudioSubscribers,
    version: VOICE_EVENTS_PROTOCOL_VERSION,
    clientDetails: getVoiceEventClientDetails(),
  }
}
