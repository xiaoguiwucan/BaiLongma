const clients = new Set()
const clientOptions = new WeakMap()
const history = []

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

export function addVoiceEventClient(ws) {
  clients.add(ws)
  clientOptions.set(ws, { audio: false, binaryAudio: false })
  safeSend(ws, { type: 'hello', service: 'bailongma.voice.events', version: 2, capabilities: ['json_events', 'tts_audio_chunks'], history: history.slice(-20) })
}

export function removeVoiceEventClient(ws) {
  clients.delete(ws)
  clientOptions.delete(ws)
}

export function handleVoiceEventClientMessage(ws, raw) {
  const msg = JSON.parse(raw.toString())
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
  return { handled: false }
}

function mapToXiaozhi(event) {
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
  const xiaozhi = mapToXiaozhi(normalized)
  history.push({ ...payload, xiaozhi })
  if (history.length > 100) history.shift()
  for (const ws of clients) {
    safeSend(ws, payload)
    if (xiaozhi) safeSend(ws, xiaozhi)
  }
  return { delivered: clients.size, xiaozhi }
}

function audioSubscribers() {
  return [...clients].filter(ws => getOptions(ws).audio)
}

export function publishTTSAudioStart({ sessionId, index, contentType = 'audio/mpeg' } = {}) {
  const payload = { type: 'tts', state: 'audio_start', sessionId, index, contentType, at: Date.now() }
  const subscribers = audioSubscribers()
  for (const ws of subscribers) safeSend(ws, payload)
  return { delivered: subscribers.length }
}

export function publishTTSAudioChunk({ sessionId, index, chunk, contentType = 'audio/mpeg' } = {}) {
  if (!chunk?.length) return { delivered: 0 }
  let delivered = 0
  for (const ws of audioSubscribers()) {
    const options = getOptions(ws)
    safeSend(ws, { type: 'tts', state: 'audio_chunk', sessionId, index, contentType, bytes: chunk.length, binary: options.binaryAudio, at: Date.now() })
    if (options.binaryAudio) safeSendBinary(ws, chunk)
    else safeSend(ws, { type: 'tts', state: 'audio_chunk_base64', sessionId, index, contentType, data: Buffer.from(chunk).toString('base64'), at: Date.now() })
    delivered += 1
  }
  return { delivered }
}

export function publishTTSAudioEnd({ sessionId, index } = {}) {
  const payload = { type: 'tts', state: 'audio_end', sessionId, index, at: Date.now() }
  const subscribers = audioSubscribers()
  for (const ws of subscribers) safeSend(ws, payload)
  return { delivered: subscribers.length }
}

export function publishTTSAudioError({ sessionId, index, error } = {}) {
  const payload = { type: 'tts', state: 'audio_error', sessionId, index, error: String(error || 'unknown'), at: Date.now() }
  const subscribers = audioSubscribers()
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
  return { clients: clients.size, history: history.length, audioSubscribers, binaryAudioSubscribers, version: 2 }
}
