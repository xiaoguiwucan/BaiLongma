import net from 'net'
import { startVoiceServer, stopVoiceServer, getVoiceStatus, detectExternalVoiceServer } from '../src/voice/manager.js'

const checks = []
function assert(condition, label, detail = '') {
  checks.push({ ok: !!condition, label, detail })
  if (condition) console.log(`[PASS] ${label}`)
  else console.error(`[FAIL] ${label}${detail ? `\n  ${detail}` : ''}`)
}

const blocker = net.createServer(socket => socket.end())
let ownsBlocker = false
await new Promise((resolve, reject) => {
  blocker.once('error', err => {
    if (err?.code === 'EADDRINUSE') resolve()
    else reject(err)
  })
  blocker.listen(3723, '127.0.0.1', () => {
    ownsBlocker = true
    resolve()
  })
})

function canConnectVoicePort() {
  return new Promise(resolve => {
    const socket = net.createConnection({ host: '127.0.0.1', port: 3723 })
    let settled = false
    const finish = value => {
      if (settled) return
      settled = true
      try { socket.destroy() } catch {}
      resolve(value)
    }
    socket.setTimeout(300)
    socket.once('connect', () => finish(true))
    socket.once('timeout', () => finish(false))
    socket.once('error', () => finish(false))
  })
}

try {
  const detected = await detectExternalVoiceServer({ model: 'sensevoice-small', profile: 'balanced' })
  assert(detected.status === 'running' && detected.external === true && detected.reason === 'detected_existing_port', 'detectExternalVoiceServer adopts existing local voice port', JSON.stringify(detected))

  const started = startVoiceServer({ localAsrModel: 'sensevoice-small', profile: 'balanced' })
  assert(started.status === 'running' && started.external === true && started.pid === null, 'startVoiceServer reuses already adopted external service instead of spawning duplicate', JSON.stringify(started))

  const stopped = stopVoiceServer()
  assert(stopped.status === 'stopped', 'stopVoiceServer clears externally adopted service tracking without killing unrelated process', JSON.stringify(stopped))

  assert(await canConnectVoicePort(), 'external port owner remains alive after stop tracking')
} finally {
  if (ownsBlocker) await new Promise(resolve => blocker.close(resolve))
}

const failed = checks.filter(item => !item.ok)
if (failed.length) {
  console.error(`\nVoice manager smoke checks: ${checks.length - failed.length}/${checks.length} passed`)
  process.exit(1)
}
console.log(`\nVoice manager smoke checks: ${checks.length}/${checks.length} passed`)
