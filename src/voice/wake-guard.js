export const DEFAULT_WAKE_GUARD_CONFIG = Object.freeze({
  confidenceThreshold: 0.72,
  minCommandChars: 2,
  cooldownMs: 1200,
  requireSpeakerWhenEnabled: true,
})

export function normalizeWakeGuardConfig(input = {}) {
  const confidence = Number(input.confidenceThreshold ?? input.wakeConfidenceThreshold ?? DEFAULT_WAKE_GUARD_CONFIG.confidenceThreshold)
  const minChars = Number(input.minCommandChars ?? input.wakeMinCommandChars ?? DEFAULT_WAKE_GUARD_CONFIG.minCommandChars)
  const cooldown = Number(input.cooldownMs ?? input.wakeCooldownMs ?? DEFAULT_WAKE_GUARD_CONFIG.cooldownMs)
  return {
    confidenceThreshold: Number.isFinite(confidence) ? Math.max(0.50, Math.min(0.98, confidence)) : DEFAULT_WAKE_GUARD_CONFIG.confidenceThreshold,
    minCommandChars: Number.isFinite(minChars) ? Math.max(0, Math.min(20, Math.round(minChars))) : DEFAULT_WAKE_GUARD_CONFIG.minCommandChars,
    cooldownMs: Number.isFinite(cooldown) ? Math.max(0, Math.min(15000, Math.round(cooldown))) : DEFAULT_WAKE_GUARD_CONFIG.cooldownMs,
    requireSpeakerWhenEnabled: typeof input.requireSpeakerWhenEnabled === 'boolean'
      ? input.requireSpeakerWhenEnabled
      : typeof input.wakeRequireSpeakerWhenEnabled === 'boolean'
        ? input.wakeRequireSpeakerWhenEnabled
        : DEFAULT_WAKE_GUARD_CONFIG.requireSpeakerWhenEnabled,
  }
}

export function estimateWakeConfidence({ text = '', normalized = '', word = '', mode = 'strict', remainder = '', source = {} } = {}) {
  const raw = String(text || '')
  const normalizedRaw = String(normalized || raw).trim()
  const wakeWord = String(word || '').trim()
  const command = String(remainder || '').trim()
  let score = mode === 'strict' ? 0.74 : 0.62
  if (wakeWord && raw.includes(wakeWord)) score += 0.08
  if (command.length >= 2) score += 0.07
  if (command.length >= 6) score += 0.04
  if (/[,，。.!！?？:：；;\s]/.test(raw.slice(0, Math.max(wakeWord.length + 4, 4)))) score += 0.03
  if (normalizedRaw.length <= wakeWord.length + 1) score -= 0.05
  if (mode === 'loose') score -= 0.08
  if (Number.isFinite(Number(source.confidence))) score = Math.max(score, Number(source.confidence))
  return Math.max(0, Math.min(1, Number(score.toFixed(3))))
}

export function evaluateWakeGuard({
  accepted = false,
  wokeOnly = false,
  text = '',
  word = '',
  mode = 'strict',
  remainder = '',
  now = Date.now(),
  lastAcceptedAt = 0,
  speakerVerificationEnabled = false,
  speakerAccepted = false,
  source = {},
  config = {},
} = {}) {
  if (!accepted) return { accepted, reason: 'not accepted by wake word', confidence: 0 }
  const cfg = normalizeWakeGuardConfig(config)
  const confidence = estimateWakeConfidence({ text, word, mode, remainder, source })
  if (!wokeOnly && cfg.minCommandChars > 0 && String(remainder || '').trim().length < cfg.minCommandChars) {
    return { accepted: false, reason: 'command too short', confidence, minCommandChars: cfg.minCommandChars }
  }
  if (confidence < cfg.confidenceThreshold) {
    return { accepted: false, reason: 'wake confidence too low', confidence, threshold: cfg.confidenceThreshold }
  }
  if (cfg.cooldownMs > 0 && lastAcceptedAt > 0 && now - lastAcceptedAt < cfg.cooldownMs) {
    return { accepted: false, reason: 'wake cooldown', confidence, cooldownMs: cfg.cooldownMs, remainingMs: cfg.cooldownMs - (now - lastAcceptedAt) }
  }
  if (cfg.requireSpeakerWhenEnabled && speakerVerificationEnabled && !speakerAccepted) {
    return { accepted: false, reason: 'speaker verification required for wake', confidence }
  }
  return { accepted: true, reason: 'wake guard passed', confidence, threshold: cfg.confidenceThreshold }
}
