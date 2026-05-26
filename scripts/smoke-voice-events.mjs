import { WebSocket } from 'ws'
import { startAPI } from '../src/api.js'
import { VOICE_EVENTS_TTS_SPEAK_LIMITS } from '../src/voice/voice-event-bus.js'

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

function connectAndCollectUrl(url, { onOpen, until, timeout = 2500 } = {}) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url)
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
  })
}

const server = startAPI(PORT, { getStateSnapshot: () => ({}) })
try {
  await waitForServer(server)

  const statusBefore = await fetch(`${API}/voice/events/status`).then(r => r.json())
  assert(statusBefore.ok === true && statusBefore.version >= 3, 'status exposes voice event protocol version', JSON.stringify(statusBefore))

  const protocolMeta = await fetch(`${API}/voice/events/protocol`).then(r => r.json())
  assert(protocolMeta.ok === true && protocolMeta.version >= 3 && protocolMeta.capabilities?.includes('tts_speak') && protocolMeta.capabilities?.includes('protocol_errors') && protocolMeta.capabilities?.includes('tts_speak_limits') && protocolMeta.capabilities?.includes('client_identity') && protocolMeta.capabilities?.includes('audio_negotiation'), 'protocol endpoint exposes version and capabilities', JSON.stringify(protocolMeta))
  assert(protocolMeta.endpoints?.websocket === '/voice/events' && protocolMeta.endpoints?.publish === '/voice/events/publish', 'protocol endpoint exposes websocket and publish endpoints', JSON.stringify(protocolMeta))
  assert(protocolMeta.limits?.ttsSpeak?.maxTextChars === VOICE_EVENTS_TTS_SPEAK_LIMITS.maxTextChars && protocolMeta.limits?.ttsSpeak?.cooldownMs === VOICE_EVENTS_TTS_SPEAK_LIMITS.cooldownMs, 'protocol endpoint exposes tts speak limits', JSON.stringify(protocolMeta.limits))
  assert(protocolMeta.limits?.ttsSpeak?.scopes?.includes('remoteAddress'), 'protocol endpoint exposes remote address tts speak scope', JSON.stringify(protocolMeta.limits))
  assert(protocolMeta.auth?.localhostExempt === true && protocolMeta.auth?.methods?.includes('?token=<token>'), 'protocol endpoint exposes auth metadata', JSON.stringify(protocolMeta.auth))
  assert(protocolMeta.clientMessages?.includes('client:hello') && protocolMeta.identityFields?.includes('clientId'), 'protocol endpoint exposes client identity metadata', JSON.stringify(protocolMeta.identityFields))
  assert(protocolMeta.identityFields?.includes('capabilities') && protocolMeta.clientCapabilityExamples?.includes('binary_audio'), 'protocol endpoint exposes client capability metadata', JSON.stringify(protocolMeta.clientCapabilityExamples))
  assert(protocolMeta.negotiation?.audioModes?.includes('binary') && protocolMeta.negotiation?.autoSubscribe === false, 'protocol endpoint exposes audio negotiation metadata', JSON.stringify(protocolMeta.negotiation))

  await fetch(`${API}/settings/tts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ voiceEventsTtsSpeakMaxTextChars: 120, voiceEventsTtsSpeakCooldownMs: 250 }),
  })
  const configuredTTS = await fetch(`${API}/settings/tts`).then(r => r.json())
  assert(configuredTTS.tts?.voiceEventsTtsSpeakMaxTextChars === 120 && configuredTTS.tts?.voiceEventsTtsSpeakCooldownMs === 250, 'settings/tts persists voice event speak limits', JSON.stringify(configuredTTS.tts))
  const configuredProtocol = await fetch(`${API}/voice/events/protocol`).then(r => r.json())
  assert(configuredProtocol.limits?.ttsSpeak?.maxTextChars === 120 && configuredProtocol.limits?.ttsSpeak?.cooldownMs === 250, 'protocol endpoint reflects configured tts speak limits', JSON.stringify(configuredProtocol.limits))

  const helloMessages = await connectAndCollect({
    until: msg => msg.type === 'hello',
  })
  const hello = helloMessages.find(msg => msg.type === 'hello')
  assert(hello?.service === 'bailongma.voice.events', 'websocket sends hello service', JSON.stringify(hello))
  assert(hello?.version >= 3 && hello?.capabilities?.includes('tts_speak'), 'hello advertises v3 tts_speak capability', JSON.stringify(hello))
  assert(hello?.limits?.ttsSpeak?.maxTextChars === 120 && hello?.limits?.ttsSpeak?.cooldownMs === 250, 'hello reflects configured tts speak limits', JSON.stringify(hello?.limits))
  assert(hello?.auth?.localhostExempt === true && Array.isArray(hello?.auth?.methods), 'hello advertises auth metadata', JSON.stringify(hello?.auth))

  const tokenMessages = await connectAndCollectUrl(`${WS}?token=smoke-token`, {
    until: msg => msg.type === 'hello',
  })
  assert(tokenMessages.some(msg => msg.type === 'hello' && msg.auth?.methods?.includes('?token=<token>')), 'websocket accepts query token and sends auth metadata')

  const identifyMessages = await connectAndCollect({
    onOpen: ws => ws.send(JSON.stringify({ type: 'client:hello', clientId: 'esp32-smoke', device: 'xiaozhi-esp32', app: 'smoke-client', version: '1.0.0', platform: 'esp32', capabilities: ['binary_audio', 'tts_speak', 'tts_speak'] })),
    until: msg => msg.type === 'client:accepted',
  })
  const acceptedIdentity = identifyMessages.find(msg => msg.type === 'client:accepted')?.identity
  assert(acceptedIdentity?.clientId === 'esp32-smoke' && acceptedIdentity?.device === 'xiaozhi-esp32', 'client:hello receives sanitized client:accepted identity', JSON.stringify(acceptedIdentity))
  assert(acceptedIdentity?.capabilities?.includes('binary_audio') && acceptedIdentity?.capabilities?.includes('tts_speak'), 'client:accepted includes sanitized capabilities', JSON.stringify(acceptedIdentity))
  const acceptedNegotiation = identifyMessages.find(msg => msg.type === 'client:accepted')?.negotiated
  assert(acceptedNegotiation?.audioMode === 'binary' && acceptedNegotiation?.binaryAudio === true && acceptedNegotiation?.shouldSubscribeAudio === false, 'client:accepted includes negotiated binary audio recommendation', JSON.stringify(acceptedNegotiation))

  const statusWithIdentityPromise = connectAndCollect({
    onOpen: async ws => {
      ws.send(JSON.stringify({ type: 'client:hello', clientId: 'status-client', app: 'smoke-status' }))
      await new Promise(resolve => setTimeout(resolve, 80))
      const status = await fetch(`${API}/voice/events/status`).then(r => r.json())
      ws.send(JSON.stringify({ type: 'ping', statusSnapshot: status }))
    },
    until: (msg, messages) => msg.type === 'pong' && messages.some(item => item.type === 'client:accepted'),
  })
  await statusWithIdentityPromise
  const statusWithIdentity = await fetch(`${API}/voice/events/status`).then(r => r.json())
  assert(Array.isArray(statusWithIdentity.clientDetails), 'status exposes clientDetails array', JSON.stringify(statusWithIdentity))
  assert(statusWithIdentity.clientDetails.every(item => item.identity?.lastSeenAt), 'status clientDetails include lastSeenAt diagnostics', JSON.stringify(statusWithIdentity.clientDetails))

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

  const invalidJsonMessages = await connectAndCollect({
    onOpen: ws => ws.send('{bad json'),
    until: msg => msg.type === 'protocol_error' && msg.code === 'invalid_json',
  })
  assert(invalidJsonMessages.some(msg => msg.type === 'protocol_error' && msg.code === 'invalid_json'), 'invalid JSON receives protocol_error invalid_json')

  const unsupportedMessages = await connectAndCollect({
    onOpen: ws => ws.send(JSON.stringify({ type: 'unknown:thing', requestId: 'bad-type' })),
    until: msg => msg.type === 'protocol_error' && msg.code === 'unsupported_type',
  })
  const unsupported = unsupportedMessages.find(msg => msg.type === 'protocol_error' && msg.code === 'unsupported_type')
  assert(unsupported?.receivedType === 'unknown:thing' && unsupported?.requestId === 'bad-type', 'unsupported type receives structured protocol_error', JSON.stringify(unsupported))

  const invalidSpeakMessages = await connectAndCollect({
    onOpen: ws => ws.send(JSON.stringify({ type: 'tts:speak', requestId: 'empty-speak', text: '' })),
    until: msg => msg.type === 'protocol_error' && msg.code === 'missing_text',
  })
  const invalidSpeak = invalidSpeakMessages.find(msg => msg.type === 'protocol_error' && msg.code === 'missing_text')
  assert(invalidSpeak?.requestId === 'empty-speak', 'empty tts:speak receives missing_text protocol_error', JSON.stringify(invalidSpeak))

  const tooLongMessages = await connectAndCollect({
    onOpen: ws => ws.send(JSON.stringify({ type: 'tts:speak', requestId: 'too-long-speak', text: 'x'.repeat(121) })),
    until: msg => msg.type === 'protocol_error' && msg.code === 'text_too_long',
  })
  const tooLong = tooLongMessages.find(msg => msg.type === 'protocol_error' && msg.code === 'text_too_long')
  assert(tooLong?.requestId === 'too-long-speak' && tooLong?.limit === 120, 'overlong tts:speak receives text_too_long protocol_error', JSON.stringify(tooLong))

  const rateLimitMessages = await connectAndCollect({
    onOpen: ws => {
      ws.send(JSON.stringify({ type: 'tts:speak', requestId: 'rate-1', text: '第一句' }))
      ws.send(JSON.stringify({ type: 'tts:speak', requestId: 'rate-2', text: '第二句' }))
    },
    until: msg => msg.type === 'protocol_error' && msg.code === 'rate_limited',
  })
  const rateLimited = rateLimitMessages.find(msg => msg.type === 'protocol_error' && msg.code === 'rate_limited')
  assert(rateLimited?.requestId === 'rate-2' && rateLimited?.retryAfterMs > 0 && rateLimited?.limitMs === 250 && rateLimited?.scope === 'connection', 'rapid tts:speak receives connection rate_limited protocol_error', JSON.stringify(rateLimited))

  const remoteRateFirst = new WebSocket(WS)
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout waiting remote rate first open')), 1500)
    remoteRateFirst.on('open', () => {
      remoteRateFirst.send(JSON.stringify({ type: 'tts:speak', requestId: 'remote-rate-1', text: '第一句' }))
      setTimeout(() => { try { remoteRateFirst.close() } catch {}; clearTimeout(timer); resolve() }, 30)
    })
    remoteRateFirst.on('error', err => { clearTimeout(timer); reject(err) })
  })
  const remoteRateMessages = await connectAndCollect({
    onOpen: ws => ws.send(JSON.stringify({ type: 'tts:speak', requestId: 'remote-rate-2', text: '第二句' })),
    until: msg => msg.type === 'protocol_error' && msg.code === 'rate_limited' && msg.scope === 'remote',
  })
  const remoteRateLimited = remoteRateMessages.find(msg => msg.type === 'protocol_error' && msg.code === 'rate_limited' && msg.scope === 'remote')
  assert(remoteRateLimited?.requestId === 'remote-rate-2' && remoteRateLimited?.retryAfterMs > 0 && remoteRateLimited?.limitMs === 250, 'second connection receives remote rate_limited protocol_error', JSON.stringify(remoteRateLimited))

  await new Promise(resolve => setTimeout(resolve, 280))

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
        { type: 'tts:start', seq: 79, at: Date.now(), detail: { sessionId: 'tts_smoke', segmentCount: 1 } },
        { type: 'tts:sentence_start', seq: 80, at: Date.now(), detail: { sessionId: 'tts_smoke', index: 0, text: '你好' } },
        { type: 'tts:audio_ready', seq: 81, at: Date.now(), detail: { sessionId: 'tts_smoke', index: 0, text: '你好', url: '/tts/session/tts_smoke/audio/0', contentType: 'audio/mpeg' } },
        { type: 'tts:sentence_end', seq: 82, at: Date.now(), detail: { sessionId: 'tts_smoke', index: 0, text: '你好' } },
        { type: 'tts:stop', seq: 83, at: Date.now(), detail: { reason: 'completed' } },
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
      && messages.some(item => item.type === 'tts' && item.state === 'start' && item.sessionId === 'tts_smoke' && item.segmentCount === 1)
      && messages.some(item => item.type === 'tts' && item.state === 'sentence_start' && item.sessionId === 'tts_smoke' && item.index === 0 && item.text === '你好')
      && messages.some(item => item.type === 'tts' && item.state === 'audio_ready' && item.sessionId === 'tts_smoke' && item.url === '/tts/session/tts_smoke/audio/0')
      && messages.some(item => item.type === 'tts' && item.state === 'sentence_end' && item.sessionId === 'tts_smoke' && item.index === 0 && item.text === '你好')
      && messages.some(item => item.type === 'tts' && item.state === 'stop' && item.reason === 'completed'),
  })
  const publishMessages = await publishMessagesPromise
  assert(publishMessages.some(msg => msg.type === 'voice_event' && msg.event?.type === 'asr:final'), 'publish broadcasts raw voice_event', JSON.stringify(publishMessages))
  assert(publishMessages.some(msg => msg.type === 'stt' && msg.state === 'final' && msg.text === '烟雾测试'), 'publish maps asr:final to Xiaozhi-style stt final', JSON.stringify(publishMessages))
  assert(publishMessages.some(msg => msg.type === 'wake' && msg.state === 'accepted' && msg.word === '小白龙'), 'publish maps wake:accepted to Xiaozhi-style wake accepted', JSON.stringify(publishMessages))
  assert(publishMessages.some(msg => msg.type === 'tts' && msg.state === 'start' && msg.sessionId === 'tts_smoke' && msg.segmentCount === 1), 'publish maps tts:start to Xiaozhi-style tts start', JSON.stringify(publishMessages))
  assert(publishMessages.some(msg => msg.type === 'tts' && msg.state === 'sentence_start' && msg.sessionId === 'tts_smoke' && msg.index === 0 && msg.text === '你好'), 'publish maps tts:sentence_start to Xiaozhi-style sentence_start', JSON.stringify(publishMessages))
  assert(publishMessages.some(msg => msg.type === 'tts' && msg.state === 'audio_ready' && msg.sessionId === 'tts_smoke' && msg.url === '/tts/session/tts_smoke/audio/0'), 'publish maps tts:audio_ready to Xiaozhi-style audio_ready', JSON.stringify(publishMessages))
  assert(publishMessages.some(msg => msg.type === 'tts' && msg.state === 'sentence_end' && msg.sessionId === 'tts_smoke' && msg.index === 0 && msg.text === '你好'), 'publish maps tts:sentence_end to Xiaozhi-style sentence_end', JSON.stringify(publishMessages))
  assert(publishMessages.some(msg => msg.type === 'tts' && msg.state === 'stop' && msg.reason === 'completed'), 'publish maps tts:stop to Xiaozhi-style tts stop', JSON.stringify(publishMessages))

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
