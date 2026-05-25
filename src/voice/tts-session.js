import { randomUUID } from 'crypto'
import { streamTTS } from './tts-providers.js'
import { splitTextForTTS } from './sentence-splitter.js'

const sessions = new Map()
const SESSION_TTL_MS = 10 * 60 * 1000

function cleanupSessions() {
  const now = Date.now()
  for (const [id, session] of sessions.entries()) {
    if (now - session.createdAt > SESSION_TTL_MS || session.status === 'cancelled') sessions.delete(id)
  }
}

export function createTTSSession({ text = '', provider, voiceId, keys = {} } = {}) {
  cleanupSessions()
  const id = `tts_${randomUUID()}`
  const segments = splitTextForTTS(text)
  const session = {
    id,
    status: 'active',
    provider,
    voiceId,
    keys,
    segments,
    createdAt: Date.now(),
  }
  sessions.set(id, session)
  return { id, segments, status: session.status }
}

export function getTTSSession(id) {
  return sessions.get(id) || null
}

export function cancelTTSSession(id) {
  const session = sessions.get(id)
  if (session) session.status = 'cancelled'
  return Boolean(session)
}

export async function streamTTSSegment({ sessionId, index }) {
  const session = sessions.get(sessionId)
  if (!session) throw new Error('TTS session not found')
  if (session.status === 'cancelled') throw new Error('TTS session cancelled')
  const i = Number(index)
  const text = session.segments[i]
  if (!text) throw new Error('TTS segment not found')
  return streamTTS({
    text: text.slice(0, 800),
    provider: session.provider,
    voiceId: session.voiceId,
    keys: session.keys,
  })
}
