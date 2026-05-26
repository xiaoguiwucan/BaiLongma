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

export function wakeGuardPatchForReason(reason = '', current = {}) {
  const cfg = normalizeWakeGuardConfig(current)
  const key = String(reason || '')
  if (key === 'command too short') {
    return {
      patch: { wakeMinCommandChars: Math.max(0, cfg.minCommandChars - 1) },
      label: `降低最短指令字数到 ${Math.max(0, cfg.minCommandChars - 1)} 字`,
    }
  }
  if (key === 'wake confidence too low') {
    return {
      patch: { wakeConfidenceThreshold: Math.max(0.50, Number((cfg.confidenceThreshold - 0.04).toFixed(2))) },
      label: `降低唤醒置信度阈值到 ${Math.max(0.50, Number((cfg.confidenceThreshold - 0.04).toFixed(2))).toFixed(2)}`,
    }
  }
  if (key === 'wake cooldown') {
    return {
      patch: { wakeCooldownMs: Math.max(0, Math.round(cfg.cooldownMs - 500)) },
      label: `缩短唤醒冷却到 ${(Math.max(0, Math.round(cfg.cooldownMs - 500)) / 1000).toFixed(1)} 秒`,
    }
  }
  if (key === 'speaker verification required for wake') {
    return {
      patch: { wakeRequireSpeakerWhenEnabled: false },
      label: '关闭“唤醒也必须通过声纹”',
    }
  }
  if (key === 'wake not at prefix') {
    return {
      patch: { wakeMode: 'loose' },
      label: '切换为宽松唤醒模式',
    }
  }
  if (key === 'wake missing') {
    return {
      patch: {},
      label: '检查唤醒词列表，暂不自动修改',
    }
  }
  if (key === 'repeat suppressed') {
    return {
      patch: { wakeRepeatSuppression: false },
      label: '关闭重复误识别抑制',
    }
  }
  return { patch: {}, label: '暂无自动调参建议' }
}

export function buildWakeGuardTuningActions({ summary = {}, current = {} } = {}) {
  const details = Array.isArray(summary?.recent?.wakeRejectedDetails) ? summary.recent.wakeRejectedDetails : []
  const reasons = []
  for (const item of details) {
    const reason = String(item.reason || '')
    if (reason && !reasons.includes(reason)) reasons.push(reason)
  }
  return reasons.map(reason => {
    const action = wakeGuardPatchForReason(reason, current)
    return {
      reason,
      label: action.label,
      patch: action.patch,
      safe: Object.keys(action.patch || {}).length > 0,
      advice: details.find(item => item.reason === reason)?.advice || '',
    }
  }).filter(item => item.safe)
}

export function buildSpeakerTuningActions({ summary = {}, current = {} } = {}) {
  const details = Array.isArray(summary?.recent?.speakerRejectedDetails) ? summary.recent.speakerRejectedDetails : []
  if (!details.length) return []
  const currentThreshold = Number.isFinite(Number(current.speakerThreshold)) ? Number(current.speakerThreshold) : 0.55
  const lowestScore = details.reduce((min, item) => Number.isFinite(Number(item.score)) ? Math.min(min, Number(item.score)) : min, currentThreshold)
  const target = Math.max(0.45, Math.min(0.80, Number((Math.min(currentThreshold - 0.03, lowestScore + 0.03)).toFixed(2))))
  const actions = []
  if (target < currentThreshold) {
    actions.push({
      reason: 'speaker rejected',
      label: `降低声纹严格度到 ${target.toFixed(2)}`,
      patch: { speakerThreshold: target },
      safe: true,
      advice: details[details.length - 1]?.advice || '如果这是你的声音，请降低声纹严格度或重新录入声纹。',
    })
  }
  if (current.wakeRequireSpeakerWhenEnabled !== false) {
    actions.push({
      reason: 'speaker rejected',
      label: '关闭“唤醒也必须通过声纹”',
      patch: { wakeRequireSpeakerWhenEnabled: false },
      safe: true,
      advice: '先允许唤醒词通过，再在最终识别阶段继续使用声纹过滤。',
    })
  }
  return actions
}
