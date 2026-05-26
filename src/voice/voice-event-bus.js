export const VOICE_EVENTS_PROTOCOL_VERSION = 3
export const VOICE_EVENTS_PROTOCOL_CAPABILITIES = Object.freeze(['json_events', 'tts_audio_chunks', 'tts_speak', 'protocol_errors', 'tts_speak_limits'])
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

export function getVoiceEventsProtocolMetadata({ ttsSpeakLimits, auth = {} } = {}) {
  const activeTTSSpeakLimits = normalizeVoiceEventsTTSSpeakLimits(ttsSpeakLimits)
  return {
    service: 'bailongma.voice.events',
    version: VOICE_EVENTS_PROTOCOL_VERSION,
    capabilities: [...VOICE_EVENTS_PROTOCOL_CAPABILITIES],
    endpoints: {
      websocket: '/voice/events',
      status: '/voice/events/status',
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
    clientMessages: ['ping', 'subscribe', 'voice:subscribe', 'unsubscribe', 'voice:unsubscribe', 'tts:speak', 'speak', 'tts:cancel', 'cancel'],
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
const history = []

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
  const supported = new Set(['ping', 'subscribe', 'voice:subscribe', 'unsubscribe', 'voice:unsubscribe', 'tts:speak', 'speak', 'tts:cancel', 'cancel'])
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
  ws.voiceEventsTTSSpeakLimits = normalizeVoiceEventsTTSSpeakLimits(ttsSpeakLimits)
  safeSend(ws, { type: 'hello', ...getVoiceEventsProtocolMetadata({ ttsSpeakLimits: ws.voiceEventsTTSSpeakLimits, auth }), history: history.slice(-20) })
}

export function removeVoiceEventClient(ws) {
  clients.delete(ws)
  clientOptions.delete(ws)
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
    safeSend(ws, { type: 'pong', at: Date.now() })
    return { handled: true }
  }
  if (msg?.type === 'subscribe' || msg?.type === 'voice:subscribe') {
    const options = setOptions(ws, {
      audio: msg.audio === true || msg.ttsAudio === true,
      binaryAudio: msg.binaryAudio === true || msg.binary === true,
    })
    safeSend(ws, { type: 'subscribed', service: 'bailongma.voice.events', options })
    return { handled: true, options }
  }
  if (msg?.type === 'unsubscribe' || msg?.type === 'voice:unsubscribe') {
    const options = setOptions(ws, {
      audio: msg.audio === false ? false : getOptions(ws).audio,
      binaryAudio: msg.binaryAudio === false || msg.binary === false ? false : getOptions(ws).binaryAudio,
    })
    safeSend(ws, { type: 'subscribed', service: 'bailongma.voice.events', options })
    return { handled: true, options }
  }
  if (msg?.type === 'tts:speak' || msg?.type === 'speak' || msg?.type === 'tts:cancel' || msg?.type === 'cancel') {
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

export function getVoiceEventBusStatus() {
  let audioSubscribers = 0
  let binaryAudioSubscribers = 0
  for (const ws of clients) {
    const options = getOptions(ws)
    if (options.audio) audioSubscribers += 1
    if (options.audio && options.binaryAudio) binaryAudioSubscribers += 1
  }
  return { clients: clients.size, history: history.length, audioSubscribers, binaryAudioSubscribers, version: VOICE_EVENTS_PROTOCOL_VERSION }
}
