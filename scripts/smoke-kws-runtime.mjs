import fs from 'fs'

const panel = fs.readFileSync(new URL('../src/ui/brain-ui/voice-panel.js', import.meta.url), 'utf8')
const server = fs.readFileSync(new URL('../src/voice/sensevoice_server.py', import.meta.url), 'utf8')
const api = fs.readFileSync(new URL('../src/api.js', import.meta.url), 'utf8')

const checks = []
function check(ok, label, detail = '') {
  checks.push({ ok, label, detail })
  console.log(`${ok ? '[PASS]' : '[FAIL]'} ${label}${ok || !detail ? '' : `: ${detail}`}`)
}

check(panel.includes("type: 'kws_detect'"), 'front-end sends kws_detect control messages')
check(panel.includes("msg.type === 'kws_result'") && panel.includes('applyKwsResult(msg)'), 'front-end handles kws_result from local service')
check(panel.includes("reason: 'kws window active'"), 'KWS hit opens a command wake window')
check(panel.includes("cfg.detectionProvider === 'kws'") && panel.includes("reason: 'kws not matched'"), 'pure KWS mode blocks text-only wake when KWS did not fire')
check(panel.includes("emitVoiceEvent('wake:kws'"), 'KWS decisions are observable as voice events')
check(server.includes('OpenWakeWordModel') && server.includes('def detect_kws'), 'local Python service has openWakeWord KWS runtime hook')
check(server.includes('msg.get("type") == "kws_detect"') && server.includes('"type": "kws_result"'), 'local Python service exposes kws_detect/kws_result protocol')
check(server.includes('sherpa-onnx KWS 运行时需要完整 tokens/encoder/decoder/joiner 配置'), 'sherpa-onnx path fails honestly instead of pretending arbitrary onnx works')
check(api.includes('openWakeWord 本地唤醒运行时已接通') && api.includes('KWS 模型路径不存在'), 'doctor/readiness explain configured, missing, and unsupported KWS states')

const failed = checks.filter(item => !item.ok)
if (failed.length) {
  console.error(`\nKWS runtime smoke failed: ${failed.length}/${checks.length}`)
  process.exit(1)
}
console.log(`\nKWS runtime smoke checks: ${checks.length}/${checks.length} passed`)
