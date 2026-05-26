import { getVoiceConfig, setVoiceConfig } from '../src/config.js'

const checks = []
function assert(condition, label, detail = '') {
  checks.push({ ok: Boolean(condition), label, detail })
  if (condition) console.log(`[PASS] ${label}`)
  else console.error(`[FAIL] ${label}${detail ? `\n  ${detail}` : ''}`)
}

const before = getVoiceConfig()
try {
  setVoiceConfig({
    wakeConfidenceThreshold: 0.99,
    wakeMinCommandChars: 99,
    wakeCooldownMs: 99999,
    wakeRequireSpeakerWhenEnabled: false,
  })
  const clamped = getVoiceConfig()
  assert(clamped.wakeConfidenceThreshold === 0.98, 'wake confidence threshold clamps high', JSON.stringify(clamped))
  assert(clamped.wakeMinCommandChars === 20, 'wake min command chars clamps high', JSON.stringify(clamped))
  assert(clamped.wakeCooldownMs === 15000, 'wake cooldown clamps high', JSON.stringify(clamped))
  assert(clamped.wakeRequireSpeakerWhenEnabled === false, 'wake speaker gate can be disabled', JSON.stringify(clamped))

  setVoiceConfig({
    wakeConfidenceThreshold: 0.42,
    wakeMinCommandChars: -5,
    wakeCooldownMs: -1,
    wakeRequireSpeakerWhenEnabled: true,
  })
  const low = getVoiceConfig()
  assert(low.wakeConfidenceThreshold === 0.50, 'wake confidence threshold clamps low', JSON.stringify(low))
  assert(low.wakeMinCommandChars === 0, 'wake min command chars clamps low', JSON.stringify(low))
  assert(low.wakeCooldownMs === 0, 'wake cooldown clamps low', JSON.stringify(low))
  assert(low.wakeRequireSpeakerWhenEnabled === true, 'wake speaker gate can be enabled', JSON.stringify(low))

  setVoiceConfig({
    wakeAutoTuningEnabled: true,
    wakeAutoTuningMinRejects: 99,
    wakeAutoTuningCooldownMs: 1,
    wakeAutoTuningMaxActionsPerHour: 99,
    wakeAutoTuningLastAppliedAt: 12345,
  })
  const auto = getVoiceConfig()
  assert(auto.wakeAutoTuningEnabled === true, 'wake auto tuning enabled persists')
  assert(auto.wakeAutoTuningMinRejects === 10, 'wake auto tuning min rejects clamps high', JSON.stringify(auto))
  assert(auto.wakeAutoTuningCooldownMs === 60000, 'wake auto tuning cooldown clamps low', JSON.stringify(auto))
  assert(auto.wakeAutoTuningMaxActionsPerHour === 6, 'wake auto tuning hourly limit clamps high', JSON.stringify(auto))
  assert(auto.wakeAutoTuningLastAppliedAt === 12345, 'wake auto tuning last applied timestamp persists', JSON.stringify(auto))
} finally {
  setVoiceConfig(before)
}

const failed = checks.filter(item => !item.ok)
console.log(`\nVoice config smoke checks: ${checks.length - failed.length}/${checks.length} passed`)
if (failed.length) process.exitCode = 1
