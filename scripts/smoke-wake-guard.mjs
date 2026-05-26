import { estimateWakeConfidence, evaluateWakeGuard, normalizeWakeGuardConfig } from '../src/voice/wake-guard.js'

const checks = []
function assert(condition, label, detail = '') {
  checks.push({ ok: Boolean(condition), label, detail })
  if (condition) console.log(`[PASS] ${label}`)
  else console.error(`[FAIL] ${label}${detail ? `\n  ${detail}` : ''}`)
}

const cfg = normalizeWakeGuardConfig({ confidenceThreshold: 0.99, minCommandChars: 99, cooldownMs: 99999, requireSpeakerWhenEnabled: false })
assert(cfg.confidenceThreshold === 0.98 && cfg.minCommandChars === 20 && cfg.cooldownMs === 15000 && cfg.requireSpeakerWhenEnabled === false, 'normalizes and clamps wake guard config', JSON.stringify(cfg))

const strictScore = estimateWakeConfidence({ text: '龙马，打开灯光', normalized: '龙马打开灯光', word: '龙马', mode: 'strict', remainder: '打开灯光' })
const looseScore = estimateWakeConfidence({ text: '我刚才说龙马打开灯光', normalized: '我刚才说龙马打开灯光', word: '龙马', mode: 'loose', remainder: '打开灯光' })
assert(strictScore > looseScore, 'strict prefix wake scores higher than loose in-sentence wake', `${strictScore} <= ${looseScore}`)

assert(evaluateWakeGuard({ accepted: true, remainder: '开灯', config: { confidenceThreshold: 0.50, minCommandChars: 3 } }).reason === 'command too short', 'rejects command shorter than configured minimum')
assert(evaluateWakeGuard({ accepted: true, text: '随便龙马', word: '龙马', mode: 'loose', remainder: '开灯', config: { confidenceThreshold: 0.95, minCommandChars: 1 } }).reason === 'wake confidence too low', 'rejects low confidence wake')
assert(evaluateWakeGuard({ accepted: true, text: '龙马打开灯', word: '龙马', mode: 'strict', remainder: '打开灯', now: 2000, lastAcceptedAt: 1500, config: { confidenceThreshold: 0.50, cooldownMs: 1200 } }).reason === 'wake cooldown', 'rejects wake during cooldown')
assert(evaluateWakeGuard({ accepted: true, text: '龙马打开灯', word: '龙马', mode: 'strict', remainder: '打开灯', speakerVerificationEnabled: true, speakerAccepted: false, config: { confidenceThreshold: 0.50, requireSpeakerWhenEnabled: true } }).reason === 'speaker verification required for wake', 'requires speaker acceptance when configured')
assert(evaluateWakeGuard({ accepted: true, text: '龙马打开灯', word: '龙马', mode: 'strict', remainder: '打开灯', speakerVerificationEnabled: true, speakerAccepted: true, config: { confidenceThreshold: 0.50, requireSpeakerWhenEnabled: true } }).accepted === true, 'accepts wake after speaker acceptance')

const failed = checks.filter(item => !item.ok)
console.log(`\nWake guard smoke checks: ${checks.length - failed.length}/${checks.length} passed`)
if (failed.length) process.exitCode = 1
