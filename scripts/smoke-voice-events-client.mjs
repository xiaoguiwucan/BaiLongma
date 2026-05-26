import { spawn } from 'child_process'
import { WebSocket } from 'ws'
import { startAPI } from '../src/api.js'

const PORT = Number(process.env.BAILONGMA_VOICE_CLIENT_SMOKE_PORT || 39222)
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

function runClient(args, { timeout = 3500 } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['scripts/voice-events-client.mjs', ...args], {
      cwd: process.cwd(),
      env: { ...process.env, BAILONGMA_API: API, BAILONGMA_VOICE_WS: WS },
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let stdout = ''
    let stderr = ''
    const timer = setTimeout(() => {
      child.kill('SIGTERM')
      reject(new Error(`client timeout: ${args.join(' ')}\nstdout=${stdout}\nstderr=${stderr}`))
    }, timeout)
    child.stdout.on('data', chunk => { stdout += chunk.toString() })
    child.stderr.on('data', chunk => { stderr += chunk.toString() })
    child.on('error', err => { clearTimeout(timer); reject(err) })
    child.on('close', code => {
      clearTimeout(timer)
      resolve({ code, stdout, stderr })
    })
  })
}

function parseFirstJson(stdout) {
  return JSON.parse(stdout)
}

function waitForStatusClient(clientId, { timeout = 2500 } = {}) {
  const started = Date.now()
  return new Promise((resolve, reject) => {
    const poll = async () => {
      try {
        const status = await fetch(`${API}/voice/events/status`).then(r => r.json())
        const client = status.clientDetails?.find(item => item.identity?.clientId === clientId)
        if (client) return resolve({ status, client })
        if (Date.now() - started > timeout) return reject(new Error(`timeout waiting for client ${clientId}: ${JSON.stringify(status)}`))
        setTimeout(poll, 50)
      } catch (err) {
        reject(err)
      }
    }
    poll()
  })
}

function openClient(args, { timeout = 4500 } = {}) {
  const child = spawn(process.execPath, ['scripts/voice-events-client.mjs', ...args], {
    cwd: process.cwd(),
    env: { ...process.env, BAILONGMA_API: API, BAILONGMA_VOICE_WS: WS },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let stdout = ''
  let stderr = ''
  child.stdout.on('data', chunk => { stdout += chunk.toString() })
  child.stderr.on('data', chunk => { stderr += chunk.toString() })
  const timer = setTimeout(() => child.kill('SIGTERM'), timeout)
  return { child, get stdout() { return stdout }, get stderr() { return stderr }, stop: () => { clearTimeout(timer); child.kill('SIGTERM') } }
}

const server = startAPI(PORT, { getStateSnapshot: () => ({}) })
try {
  await waitForServer(server)

  const protocolRun = await runClient(['protocol'])
  assert(protocolRun.code === 0, 'CLI protocol command exits successfully', protocolRun.stderr)
  const protocol = parseFirstJson(protocolRun.stdout)
  assert(protocol.ok === true && protocol.endpoints?.websocket === '/voice/events', 'CLI protocol prints protocol metadata', protocolRun.stdout)

  const listener = openClient(['listen', '--audio', '--binary', '--client-id', 'cli-smoke', '--device', 'xiaozhi-esp32', '--app', 'bridge-smoke', '--client-version', '0.2.0', '--platform', 'esp32', '--capability', 'wake,display'])
  const { client } = await waitForStatusClient('cli-smoke')
  assert(client.audio === true && client.binaryAudio === true, 'CLI listen subscribes binary audio when requested', JSON.stringify(client))
  assert(client.identity?.device === 'xiaozhi-esp32' && client.identity?.app === 'bridge-smoke', 'CLI listen sends client:hello identity fields', JSON.stringify(client.identity))
  assert(client.identity?.capabilities?.includes('binary_audio') && client.identity?.capabilities?.includes('wake') && client.identity?.capabilities?.includes('display'), 'CLI listen sends merged capabilities', JSON.stringify(client.identity))
  assert(/"type": "client:accepted"/.test(listener.stdout), 'CLI listen displays client:accepted response', listener.stdout)
  listener.stop()

  const noIdentify = openClient(['listen', '--no-identify'])
  await new Promise(resolve => setTimeout(resolve, 250))
  const statusNoIdentify = await fetch(`${API}/voice/events/status`).then(r => r.json())
  assert(!statusNoIdentify.clientDetails?.some(item => item.identity?.clientId?.startsWith('cli-')), 'CLI --no-identify suppresses default cli identity', JSON.stringify(statusNoIdentify.clientDetails))
  noIdentify.stop()

  await new Promise(resolve => setTimeout(resolve, 100))
  const statusAfter = await fetch(`${API}/voice/events/status`).then(r => r.json())
  assert(statusAfter.ok === true, 'voice events server remains healthy after CLI smoke', JSON.stringify(statusAfter))
} catch (err) {
  assert(false, 'voice events CLI smoke completed without uncaught error', err.stack || err.message)
} finally {
  await closeServer(server)
}

const failed = checks.filter(item => !item.ok)
console.log(`\nVoice event CLI smoke checks: ${checks.length - failed.length}/${checks.length} passed`)
if (failed.length) process.exitCode = 1
