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
check(source.includes("type: 'kws_detect'"), 'voice panel sends local kws_detect requests to the local voice service')
check(source.includes("msg.type === 'kws_result'") && source.includes('applyKwsResult(msg)'), 'voice panel consumes local KWS runtime decisions')
check(source.includes("reason: 'kws window active'"), 'KWS wake window can authorize the following final command')
check(source.includes("'kws not matched'"), 'pure KWS mode rejects ASR text when local KWS has not fired')

const failed = checks.filter(item => !item.ok)
if (failed.length) {
  console.error(`\nVoice panel gating smoke failed: ${failed.length}/${checks.length}`)
  process.exit(1)
}
console.log(`\nVoice panel gating smoke checks: ${checks.length}/${checks.length} passed`)
