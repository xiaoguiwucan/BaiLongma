const clients = new Set()
const history = []

function safeSend(ws, payload) {
  try {
    if (ws.readyState === 1) ws.send(JSON.stringify(payload))
  } catch {}
}

export function addVoiceEventClient(ws) {
  clients.add(ws)
  safeSend(ws, { type: 'hello', service: 'bailongma.voice.events', version: 1, history: history.slice(-20) })
}

export function removeVoiceEventClient(ws) {
  clients.delete(ws)
}

function mapToXiaozhi(event) {
  const type = event?.type
  const detail = event?.detail || {}
  if (type === 'tts:start') return { type: 'tts', state: 'start', sessionId: detail.sessionId, segmentCount: detail.segmentCount }
  if (type === 'tts:sentence_start') return { type: 'tts', state: 'sentence_start', sessionId: detail.sessionId, index: detail.index, text: detail.text }
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

export function getVoiceEventBusStatus() {
  return { clients: clients.size, history: history.length }
}
