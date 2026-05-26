#!/usr/bin/env node
import fs from 'fs'
import os from 'os'
import path from 'path'
import { WebSocket } from 'ws'

const DEFAULT_WS = process.env.BAILONGMA_VOICE_WS || 'ws://127.0.0.1:3721/voice/events'
const DEFAULT_HTTP = process.env.BAILONGMA_API || 'http://127.0.0.1:3721'
const PACKAGE_VERSION = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version

function usage() {
  console.log(`BaiLongma voice event WebSocket debug client

Usage:
  node scripts/voice-events-client.mjs status [--api http://127.0.0.1:3721]
  node scripts/voice-events-client.mjs protocol [--api http://127.0.0.1:3721]
  node scripts/voice-events-client.mjs listen [--url ws://127.0.0.1:3721/voice/events] [--audio] [--binary] [--save out.mp3] [identity flags]
  node scripts/voice-events-client.mjs speak "你好" [--url ws://127.0.0.1:3721/voice/events] [--binary] [--save out.mp3] [--timeout 30000] [identity flags]
  node scripts/voice-events-client.mjs cancel [--url ws://127.0.0.1:3721/voice/events] [--request-id id] [identity flags]

Identity flags:
  --client-id id       Client/device id reported by client:hello
  --device name        Hardware/device name, for example xiaozhi-esp32
  --app name           App name reported to the server
  --client-version v   App/firmware version reported to the server
  --platform name      Platform name, for example macos or esp32
  --capability name    Repeatable; also accepts comma/space separated values
  --no-identify        Do not send the default client:hello handshake

Examples:
  npm run voice:events -- status
  npm run voice:events -- protocol
  npm run voice:events -- listen --audio --client-id mac-debug --capability display
  npm run voice:events -- speak "测试白龙马语音服务端" --binary --save tmp/tts.mp3 --client-id mac-debug
  npm run voice:events -- cancel --client-id mac-debug
`)
}

function parseArgs(argv) {
  const args = { _: [] }
  for (let i = 0; i < argv.length; i += 1) {
    const item = argv[i]
    if (!item.startsWith('--')) { args._.push(item); continue }
    const key = item.slice(2)
    if (['audio', 'binary', 'help', 'no-identify'].includes(key)) { args[key] = true; continue }
    const value = argv[i + 1]
    if (key === 'capability') {
      args.capability = [...(Array.isArray(args.capability) ? args.capability : args.capability ? [args.capability] : []), value]
    } else {
      args[key] = value
    }
    i += 1
  }
  return args
}

function logJson(value) {
  console.log(JSON.stringify(value, null, 2))
}

async function getJson(api, endpoint) {
  const res = await fetch(`${api.replace(/\/$/, '')}${endpoint}`)
  const json = await res.json()
  logJson(json)
}

async function status(api) {
  await getJson(api, '/voice/events/status')
}

async function protocol(api) {
  await getJson(api, '/voice/events/protocol')
}


function splitCapabilities(values = []) {
  const source = Array.isArray(values) ? values : [values]
  return [...new Set(source.flatMap(value => String(value || '').split(/[,，、\s]+/)).map(item => item.trim().toLowerCase()).filter(Boolean))]
}

function createIdentity(args = {}, defaults = {}) {
  if (args['no-identify']) return null
  const capabilities = splitCapabilities([
    ...(Array.isArray(args.capability) ? args.capability : args.capability ? [args.capability] : []),
    ...(defaults.capabilities || []),
  ])
  return {
    type: 'client:hello',
    clientId: args['client-id'] || `cli-${os.hostname()}-${process.pid}`,
    device: args.device || 'mac',
    app: args.app || 'bailongma-voice-events-client',
    version: args['client-version'] || PACKAGE_VERSION,
    platform: args.platform || process.platform,
    capabilities,
  }
}

function sendIdentity(ws, identity) {
  if (!identity) return
  ws.send(JSON.stringify(identity))
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

function listen({ url, audio, binary, save, identity }) {
  const out = openOutput(save)
  connect(url, {
    onOpen(ws) {
      console.error(`[connected] ${url}`)
      sendIdentity(ws, identity)
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

function speak({ url, text, binary, save, timeout, identity }) {
  if (!text) throw new Error('Missing speak text')
  const out = openOutput(save)
  const requestId = `cli_${Date.now()}`
  connect(url, {
    timeout,
    onOpen(ws) {
      console.error(`[connected] ${url}`)
      sendIdentity(ws, identity)
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

function cancel({ url, requestId, identity }) {
  connect(url, {
    timeout: 3000,
    onOpen(ws) {
      console.error(`[connected] ${url}`)
      sendIdentity(ws, identity)
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
  else if (cmd === 'protocol') await protocol(args.api || DEFAULT_HTTP)
  else if (cmd === 'listen') listen({ url: args.url || DEFAULT_WS, audio: args.audio, binary: args.binary, save: args.save, identity: createIdentity(args, { capabilities: [args.binary ? 'binary_audio' : args.audio ? 'base64_audio' : 'json_events'] }) })
  else if (cmd === 'speak') speak({ url: args.url || DEFAULT_WS, text: args._.slice(1).join(' '), binary: args.binary, save: args.save, timeout: Number(args.timeout || 30000), identity: createIdentity(args, { capabilities: ['tts_speak', args.binary ? 'binary_audio' : 'base64_audio'] }) })
  else if (cmd === 'cancel') cancel({ url: args.url || DEFAULT_WS, requestId: args['request-id'], identity: createIdentity(args, { capabilities: ['tts_cancel'] }) })
  else { usage(); process.exit(1) }
} catch (err) {
  console.error(`[error] ${err.message}`)
  process.exit(1)
}
