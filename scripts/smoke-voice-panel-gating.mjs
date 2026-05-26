import fs from 'fs'

const source = fs.readFileSync(new URL('../src/ui/brain-ui/voice-panel.js', import.meta.url), 'utf8')
const checks = []
function check(ok, label) {
  checks.push({ ok, label })
  console.log(`${ok ? '[PASS]' : '[FAIL]'} ${label}`)
}

check(source.includes("emitVoiceEvent(VOICE_EVENT_TYPES.ASR_PARTIAL, { text, gated: false, displayOnly: true })"), 'partial ASR event is explicitly display-only')
check(source.includes('Partial ASR is display/debug only'), 'partial ASR block documents no auto-send before gate')
check(!/ASR_PARTIAL[\s\S]{0,260}lastTranscriptText\s*=/.test(source), 'partial ASR block does not write lastTranscriptText')
check(source.includes('if (msg.is_final) scheduleAutoSend();'), 'auto-send is scheduled only for final transcript branch')
check(source.includes('wakeRejectDisplayText(gated.reason)'), 'wake rejection displays an explicit non-command status')
check(source.includes(`lastTranscriptText = '';
              setStatus(VOICE_STATES.LISTENING, { reason: gated.reason || 'wake rejected'`), 'wake rejection clears pending command text')
check(source.includes("setStatus(VOICE_STATES.LISTENING, { reason: 'filtered hallucination transcript' })"), 'hallucinated final transcript is cleared and reported')

const failed = checks.filter(item => !item.ok)
if (failed.length) {
  console.error(`\nVoice panel gating smoke failed: ${failed.length}/${checks.length}`)
  process.exit(1)
}
console.log(`\nVoice panel gating smoke checks: ${checks.length}/${checks.length} passed`)
