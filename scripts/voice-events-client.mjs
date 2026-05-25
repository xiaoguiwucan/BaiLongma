#!/usr/bin/env node
import fs from 'fs'
import path from 'path'
import { WebSocket } from 'ws'

const DEFAULT_WS = process.env.BAILONGMA_VOICE_WS || 'ws://127.0.0.1:3721/voice/events'
const DEFAULT_HTTP = process.env.BAILONGMA_API || 'http://127.0.0.1:3721'

function usage() {
  console.log(`BaiLongma voice event WebSocket debug client

Usage:
  node scripts/voice-events-client.mjs status [--api http://127.0.0.1:3721]
  node scripts/voice-events-client.mjs listen [--url ws://127.0.0.1:3721/voice/events] [--audio] [--binary] [--save out.mp3]
  node scripts/voice-events-client.mjs speak "你好" [--url ws://127.0.0.1:3721/voice/events] [--binary] [--save out.mp3] [--timeout 30000]
  node scripts/voice-events-client.mjs cancel [--url ws://127.0.0.1:3721/voice/events] [--request-id id]

Examples:
  npm run voice:events -- status
  npm run voice:events -- listen --audio
  npm run voice:events -- speak "测试白龙马语音服务端" --binary --save tmp/tts.mp3
  npm run voice:events -- cancel
`)
}

function parseArgs(argv) {
  const args = { _: [] }
  for (let i = 0; i < argv.length; i += 1) {
    const item = argv[i]
    if (!item.startsWith('--')) { args._.push(item); continue }
    const key = item.slice(2)
    if (['audio', 'binary', 'help'].includes(key)) { args[key] = true; continue }
    args[key] = argv[i + 1]
    i += 1
  }
  return args
}

function logJson(value) {
  console.log(JSON.stringify(value, null, 2))
}

async function status(api) {
  const res = await fetch(`${api.replace(/\/$/, '')}/voice/events/status`)
  const json = await res.json()
  logJson(json)
}

function openOutput(file) {
  if (!file) return null
  fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true })
  return fs.createWriteStream(file)
}

function connect(url, { onOpen, onJson, onBinary, onClose, timeout = 0 } = {}) {
  const ws = new WebSocket(url)
  let timer = null
  if (timeout > 0) {
    timer = setTimeout(() => {
      console.error(`[timeout] ${timeout}ms reached, closing`)
      try { ws.close() } catch {}
    }, timeout)
    timer.unref?.()
  }
  ws.on('open', () => onOpen?.(ws))
  ws.on('message', (data, isBinary) => {
    if (isBinary) { onBinary?.(Buffer.from(data)); return }
    const text = data.toString()
    try { onJson?.(JSON.parse(text), ws) } catch { console.log(text) }
  })
  ws.on('close', () => { if (timer) clearTimeout(timer); onClose?.() })
  ws.on('error', err => console.error(`[ws:error] ${err.message}`))
  return ws
}

function listen({ url, audio, binary, save }) {
  const out = openOutput(save)
  connect(url, {
    onOpen(ws) {
      console.error(`[connected] ${url}`)
      if (audio || binary) ws.send(JSON.stringify({ type: 'subscribe', audio: true, binaryAudio: Boolean(binary) }))
    },
    onJson(msg) { logJson(msg) },
    onBinary(chunk) {
      console.log(`[binary] ${chunk.length} bytes`)
      out?.write(chunk)
    },
    onClose() { out?.end(); console.error('[closed]') },
  })
}

function speak({ url, text, binary, save, timeout }) {
  if (!text) throw new Error('Missing speak text')
  const out = openOutput(save)
  const requestId = `cli_${Date.now()}`
  connect(url, {
    timeout,
    onOpen(ws) {
      console.error(`[connected] ${url}`)
      ws.send(JSON.stringify({ type: 'tts:speak', requestId, text, binaryAudio: Boolean(binary) }))
    },
    onJson(msg, ws) {
      logJson(msg)
      if (msg?.type === 'tts' && msg?.state === 'audio_chunk_base64' && msg.data) out?.write(Buffer.from(msg.data, 'base64'))
      if (msg?.type === 'tts' && (msg?.state === 'stop' || msg?.state === 'error')) setTimeout(() => ws.close(), 50)
    },
    onBinary(chunk) {
      console.log(`[binary] ${chunk.length} bytes`)
      out?.write(chunk)
    },
    onClose() { out?.end(); console.error('[closed]') },
  })
}

function cancel({ url, requestId }) {
  connect(url, {
    timeout: 3000,
    onOpen(ws) {
      console.error(`[connected] ${url}`)
      ws.send(JSON.stringify({ type: 'tts:cancel', requestId }))
      setTimeout(() => ws.close(), 300)
    },
    onJson(msg) { logJson(msg) },
  })
}

const args = parseArgs(process.argv.slice(2))
const cmd = args._[0]
try {
  if (args.help) { usage(); process.exit(0) }
  if (!cmd) { usage(); process.exit(1) }
  if (cmd === 'status') await status(args.api || DEFAULT_HTTP)
  else if (cmd === 'listen') listen({ url: args.url || DEFAULT_WS, audio: args.audio, binary: args.binary, save: args.save })
  else if (cmd === 'speak') speak({ url: args.url || DEFAULT_WS, text: args._.slice(1).join(' '), binary: args.binary, save: args.save, timeout: Number(args.timeout || 30000) })
  else if (cmd === 'cancel') cancel({ url: args.url || DEFAULT_WS, requestId: args['request-id'] })
  else { usage(); process.exit(1) }
} catch (err) {
  console.error(`[error] ${err.message}`)
  process.exit(1)
}
