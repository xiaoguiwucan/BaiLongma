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

  setVoiceConfig({ speakerThreshold: 0.99 })
  const speakerHigh = getVoiceConfig()
  assert(speakerHigh.speakerThreshold === 0.80, 'speaker threshold clamps high', JSON.stringify(speakerHigh))
  setVoiceConfig({ speakerThreshold: 0.1 })
  const speakerLow = getVoiceConfig()
  assert(speakerLow.speakerThreshold === 0.45, 'speaker threshold clamps low', JSON.stringify(speakerLow))
  setVoiceConfig({ speakerThreshold: 0.62 })
  const speakerSaved = getVoiceConfig()
  assert(speakerSaved.speakerThreshold === 0.62, 'speaker threshold persists', JSON.stringify(speakerSaved))

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

  setVoiceConfig({
    videoVoiceDuckEnabled: false,
    videoVoicePttEnabled: false,
    videoVoiceAecEnabled: false,
    videoVoiceDuckLevel: 0.001,
    videoVoiceDuckHoldMs: 99999,
    videoVoiceDuckSensitivity: 99,
  })
  const video = getVoiceConfig()
  assert(video.videoVoiceDuckEnabled === false, 'video voice duck can be disabled', JSON.stringify(video))
  assert(video.videoVoicePttEnabled === false, 'video voice ptt can be disabled', JSON.stringify(video))
  assert(video.videoVoiceAecEnabled === false, 'video voice aec can be disabled', JSON.stringify(video))
  assert(video.videoVoiceDuckLevel === 0.02, 'video voice duck level clamps low', JSON.stringify(video))
  assert(video.videoVoiceDuckHoldMs === 8000, 'video voice duck hold clamps high', JSON.stringify(video))
  assert(video.videoVoiceDuckSensitivity === 1.6, 'video voice duck sensitivity clamps high', JSON.stringify(video))
} finally {
  setVoiceConfig(before)
}

const failed = checks.filter(item => !item.ok)
console.log(`\nVoice config smoke checks: ${checks.length - failed.length}/${checks.length} passed`)
if (failed.length) process.exitCode = 1
