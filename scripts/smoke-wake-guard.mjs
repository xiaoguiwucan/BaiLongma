import { buildSpeakerTuningActions, buildWakeGuardTuningActions, estimateWakeConfidence, evaluateWakeGuard, normalizeWakeGuardConfig, wakeGuardPatchForReason } from '../src/voice/wake-guard.js'

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
const lowConfidencePatch = wakeGuardPatchForReason('wake confidence too low', { wakeConfidenceThreshold: 0.72 })
assert(lowConfidencePatch.patch.wakeConfidenceThreshold === 0.68, 'builds safe patch for low confidence wake')
const tuningActions = buildWakeGuardTuningActions({ summary: { recent: { wakeRejectedDetails: [{ reason: 'command too short', advice: '降低最短指令字数' }] } }, current: { wakeMinCommandChars: 2 } })
assert(tuningActions.length === 1 && tuningActions[0].patch.wakeMinCommandChars === 1, 'builds tuning actions from summary wake reject details')
const speakerActions = buildSpeakerTuningActions({ summary: { recent: { speakerRejectedDetails: [{ score: 0.47, threshold: 0.63, advice: '降低声纹严格度' }] } }, current: { speakerThreshold: 0.63, wakeRequireSpeakerWhenEnabled: true } })
assert(speakerActions.some(item => item.patch.speakerThreshold === 0.5) && speakerActions.some(item => item.patch.wakeRequireSpeakerWhenEnabled === false), 'builds speaker tuning actions from rejection details', JSON.stringify(speakerActions))

const failed = checks.filter(item => !item.ok)
console.log(`\nWake guard smoke checks: ${checks.length - failed.length}/${checks.length} passed`)
if (failed.length) process.exitCode = 1
