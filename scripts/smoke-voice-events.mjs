import { WebSocket } from 'ws'
import { startAPI } from '../src/api.js'

const PORT = Number(process.env.BAILONGMA_VOICE_SMOKE_PORT || 39221)
const API = `http://127.0.0.1:${PORT}`
const WS = `ws://127.0.0.1:${PORT}/voice/events`
const checks = []

function assert(condition, label, detail = '') {
  checks.push({ ok: !!condition, label, detail })
  if (condition) console.log(`[PASS] ${label}`)
  else console.error(`[FAIL] ${label}${detail ? `\n  ${detail}` : ''}`)
}

function waitForServer(server) {
  if (server.listening) return Promise.resolve()
  return new Promise(resolve => server.once('listening', resolve))
}

function closeServer(server) {
  return new Promise(resolve => server.close(() => resolve()))
}

function connectAndCollect({ onOpen, until, timeout = 2500 } = {}) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(WS)
    const messages = []
    const timer = setTimeout(() => {
      try { ws.close() } catch {}
      reject(new Error(`timeout waiting for ${until || 'messages'}`))
    }, timeout)
    ws.on('open', () => onOpen?.(ws))
    ws.on('message', (data, isBinary) => {
      const item = isBinary ? { binary: true, bytes: data.length } : JSON.parse(data.toString())
      messages.push(item)
      if (until?.(item, messages, ws)) {
        clearTimeout(timer)
        try { ws.close() } catch {}
        ws.once('close', () => resolve(messages))
      }
    })
    ws.on('error', err => { clearTimeout(timer); reject(err) })
    ws.on('close', () => {})
  })
}

const server = startAPI(PORT, { getStateSnapshot: () => ({}) })
try {
  await waitForServer(server)

  const statusBefore = await fetch(`${API}/voice/events/status`).then(r => r.json())
  assert(statusBefore.ok === true && statusBefore.version >= 3, 'status exposes voice event protocol version', JSON.stringify(statusBefore))

  const helloMessages = await connectAndCollect({
    until: msg => msg.type === 'hello',
  })
  const hello = helloMessages.find(msg => msg.type === 'hello')
  assert(hello?.service === 'bailongma.voice.events', 'websocket sends hello service', JSON.stringify(hello))
  assert(hello?.version >= 3 && hello?.capabilities?.includes('tts_speak'), 'hello advertises v3 tts_speak capability', JSON.stringify(hello))

  const pingMessages = await connectAndCollect({
    onOpen: ws => ws.send(JSON.stringify({ type: 'ping' })),
    until: msg => msg.type === 'pong',
  })
  assert(pingMessages.some(msg => msg.type === 'pong'), 'ping receives pong')

  const subMessages = await connectAndCollect({
    onOpen: ws => ws.send(JSON.stringify({ type: 'subscribe', audio: true, binaryAudio: true })),
    until: msg => msg.type === 'subscribed',
  })
  const subscribed = subMessages.find(msg => msg.type === 'subscribed')
  assert(subscribed?.options?.audio === true && subscribed?.options?.binaryAudio === true, 'subscribe enables audio and binary options', JSON.stringify(subscribed))

  const cancelMessages = await connectAndCollect({
    onOpen: ws => ws.send(JSON.stringify({ type: 'tts:cancel', requestId: 'smoke-no-active' })),
    until: msg => msg.type === 'tts' && msg.state === 'cancelled',
  })
  const cancelled = cancelMessages.find(msg => msg.type === 'tts' && msg.state === 'cancelled')
  assert(cancelled?.cancelled === false && cancelled?.reason === 'no_active_session', 'cancel without active speak returns structured no_active_session', JSON.stringify(cancelled))

  const publishMessagesPromise = connectAndCollect({
    onOpen: async () => {
      await new Promise(resolve => setTimeout(resolve, 30))
      const events = [
        { type: 'asr:final', seq: 77, at: Date.now(), detail: { text: '烟雾测试' } },
        { type: 'wake:accepted', seq: 78, at: Date.now(), detail: { text: '小白龙', word: '小白龙' } },
        { type: 'tts:audio_ready', seq: 79, at: Date.now(), detail: { sessionId: 'tts_smoke', index: 0, text: '你好', url: '/tts/session/tts_smoke/audio/0', contentType: 'audio/mpeg' } },
      ]
      for (const event of events) {
        await fetch(`${API}/voice/events/publish`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ event }),
        })
      }
    },
    until: (msg, messages) => messages.some(item => item.type === 'voice_event' && item.event?.type === 'asr:final')
      && messages.some(item => item.type === 'stt' && item.state === 'final' && item.text === '烟雾测试')
      && messages.some(item => item.type === 'wake' && item.state === 'accepted' && item.word === '小白龙')
      && messages.some(item => item.type === 'tts' && item.state === 'audio_ready' && item.sessionId === 'tts_smoke' && item.url === '/tts/session/tts_smoke/audio/0'),
  })
  const publishMessages = await publishMessagesPromise
  assert(publishMessages.some(msg => msg.type === 'voice_event' && msg.event?.type === 'asr:final'), 'publish broadcasts raw voice_event', JSON.stringify(publishMessages))
  assert(publishMessages.some(msg => msg.type === 'stt' && msg.state === 'final' && msg.text === '烟雾测试'), 'publish maps asr:final to Xiaozhi-style stt final', JSON.stringify(publishMessages))
  assert(publishMessages.some(msg => msg.type === 'wake' && msg.state === 'accepted' && msg.word === '小白龙'), 'publish maps wake:accepted to Xiaozhi-style wake accepted', JSON.stringify(publishMessages))
  assert(publishMessages.some(msg => msg.type === 'tts' && msg.state === 'audio_ready' && msg.sessionId === 'tts_smoke' && msg.url === '/tts/session/tts_smoke/audio/0'), 'publish maps tts:audio_ready to Xiaozhi-style audio_ready', JSON.stringify(publishMessages))

  await new Promise(resolve => setTimeout(resolve, 50))
  const statusAfter = await fetch(`${API}/voice/events/status`).then(r => r.json())
  assert(statusAfter.ok === true && statusAfter.clients === 0, 'status returns zero clients after smoke sockets close', JSON.stringify(statusAfter))
} catch (err) {
  assert(false, 'voice events smoke completed without uncaught error', err.stack || err.message)
} finally {
  await closeServer(server)
}

const failed = checks.filter(item => !item.ok)
console.log(`\nVoice event smoke checks: ${checks.length - failed.length}/${checks.length} passed`)
if (failed.length) process.exitCode = 1
