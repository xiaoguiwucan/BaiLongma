import http from 'http'
import fs from 'fs'
import path from 'path'
import net from 'net'
import { fileURLToPath } from 'url'
import { WebSocketServer } from 'ws'
import { pushMessage } from './queue.js'
import { getDB, getConfig, setConfig, insertUISignal, upsertMediaHistory, getMediaHistory, updateLastJarvisConversationContent } from './db.js'
import { emitEvent, addSSEClient, removeSSEClient, addACUIClient, removeACUIClient, removeActiveUICard, emitUICommand, flushStickyEvents, setStickyEvent } from './events.js'
import { getQuotaStatus } from './quota.js'
import { isRunning, stopLoop, startLoop } from './control.js'
import { buildHeartbeatSystemPromptPreview } from './system-prompt-preview.js'
import { paths } from './paths.js'
import { config, activate as activateLLM, getActivationStatus, switchModel, setTemperature, getMinimaxKey, setMinimaxKey, getSocialConfig, setSocialConfig, getVoiceConfig, setVoiceConfig, getTTSConfig, setTTSConfig, getTTSCredentials, getProviderSummaries, getSecurity, setSecurity, getEmbeddingConfig, setEmbeddingConfig, EMBEDDING_PROVIDER_PRESETS, getWebSearchConfig, setWebSearchConfig } from './config.js'
import { streamTTS, TTS_PROVIDERS, TTS_VOICES } from './voice/tts-providers.js'
import { createTTSSession, cancelTTSSession, streamTTSSegment, getTTSSession } from './voice/tts-session.js'
import { addVoiceEventClient, removeVoiceEventClient, handleVoiceEventClientMessage, sendVoiceEventClientJson, sendVoiceEventToClient, getVoiceEventClientOptions, setVoiceEventClientOptions, publishVoiceEvent, getVoiceEventBusStatus, getVoiceEventClientDetails, getVoiceEventHistory, getVoiceEventMetricsWindow, getVoiceEventLinkSummary, getVoiceEventLinkSelfCheck, getVoiceEventsOnboardingPackage, getVoiceEventsOnboarding, getVoiceEventsProtocolMetadata, validateVoiceEventClientMessage, sendVoiceEventProtocolError, normalizeVoiceEventsTTSSpeakLimits, publishTTSAudioStart, publishTTSAudioChunk, publishTTSAudioEnd, publishTTSAudioError } from './voice/voice-event-bus.js'
import { getVoiceStatus, startVoiceServer, stopVoiceServer, restartVoiceServer } from './voice/manager.js'
import { restartConnector } from './social/index.js'
import { replaceProvider } from './providers/registry.js'
import { persistAppState } from './capabilities/executor.js'
import { MinimaxProvider } from './providers/minimax.js'
import { handleSocialWebhook, isSocialWebhookPath } from './social/webhooks.js'
import { getClawbotQR, logoutClawbot } from './social/wechat-clawbot.js'
import { createCloudASRSession } from './voice/cloud-asr.js'
import { getHotspots, setHotspotPanelState, getHotspotPanelState } from './hotspots.js'
import { buildSpeakerTuningActions, buildWakeGuardTuningActions } from './voice/wake-guard.js'
import { getPersonCard, setPersonCardPanelState, getPersonCardPanelState } from './person-cards.js'
import { setDocPanelState, getDocPanelState, DOC_TOPICS } from './docs.js'

export { emitEvent }

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const INDEX_PATH         = paths.indexHtml
const DASHBOARD_PATH     = paths.dashboardHtml
const BRAIN_PATH         = paths.brainHtml
const BRAIN_UI_PATH      = paths.brainUiHtml
const WEBSITE_PATH       = paths.websiteHtml
const SYSTEM_PROMPT_PATH = paths.systemPromptHtml
const ACTIVATION_PATH    = paths.activationHtml
const BRAIN_UI_ASSET_ROOT = paths.brainUiAssetRoot
const D3_VENDOR_PATH     = path.join(paths.resourcesDir, 'node_modules', 'd3', 'dist', 'd3.min.js')
const SANDBOX_PATH       = paths.sandboxDir
const DEFAULT_AGENT_NAME = '小白龙'
const DEFAULT_API_HOST = '127.0.0.1'


const VOICE_STABILITY_PRESETS = Object.freeze([
  {
    id: 'quiet-room',
    label: '安静环境',
    description: '响应更自然，适合近距离安静说话。',
    patch: {
      wakeMode: 'strict',
      wakeConfidenceThreshold: 0.68,
      wakeMinCommandChars: 1,
      wakeCooldownMs: 800,
      wakeRequireSpeakerWhenEnabled: false,
      speakerThreshold: 0.55,
      videoVoiceDuckEnabled: true,
      videoVoicePttEnabled: true,
      videoVoiceAecEnabled: true,
      videoVoiceDuckLevel: 0.12,
      videoVoiceDuckHoldMs: 2200,
      videoVoiceDuckSensitivity: 1.0,
    },
  },
  {
    id: 'video-guard',
    label: '视频抗干扰',
    description: '优先防止视频/别人说话误唤醒，并保留按住说话兜底。',
    patch: {
      wakeMode: 'strict',
      wakeConfidenceThreshold: 0.78,
      wakeMinCommandChars: 2,
      wakeCooldownMs: 1600,
      wakeRepeatSuppression: true,
      wakeRequireSpeakerWhenEnabled: true,
      speakerThreshold: 0.58,
      videoVoiceDuckEnabled: true,
      videoVoicePttEnabled: true,
      videoVoiceAecEnabled: true,
      videoVoiceDuckLevel: 0.08,
      videoVoiceDuckHoldMs: 3200,
      videoVoiceDuckSensitivity: 0.85,
    },
  },
  {
    id: 'strict-speaker',
    label: '严格声纹',
    description: '只响应本人声音，适合多人环境；如果误拒绝请重新录入或切回均衡。',
    patch: {
      wakeMode: 'strict',
      wakeConfidenceThreshold: 0.76,
      wakeMinCommandChars: 2,
      wakeCooldownMs: 1400,
      wakeRequireSpeakerWhenEnabled: true,
      speakerVerificationEnabled: true,
      speakerThreshold: 0.66,
      videoVoiceDuckEnabled: true,
      videoVoicePttEnabled: true,
      videoVoiceAecEnabled: true,
      videoVoiceDuckLevel: 0.10,
      videoVoiceDuckHoldMs: 2600,
      videoVoiceDuckSensitivity: 1.0,
    },
  },
  {
    id: 'balanced',
    label: '均衡推荐',
    description: '默认推荐：兼顾速度、误唤醒和声纹误拒绝。',
    patch: {
      wakeMode: 'strict',
      wakeConfidenceThreshold: 0.72,
      wakeMinCommandChars: 2,
      wakeCooldownMs: 1200,
      wakeRepeatSuppression: true,
      wakeRequireSpeakerWhenEnabled: true,
      speakerThreshold: 0.55,
      videoVoiceDuckEnabled: true,
      videoVoicePttEnabled: true,
      videoVoiceAecEnabled: true,
      videoVoiceDuckLevel: 0.10,
      videoVoiceDuckHoldMs: 2200,
      videoVoiceDuckSensitivity: 1.0,
    },
  },
])

function publicVoiceStabilityPresets() {
  return VOICE_STABILITY_PRESETS.map(item => ({ id: item.id, label: item.label, description: item.description, patch: { ...item.patch } }))
}

function getVoiceStabilityPreset(id = '') {
  return VOICE_STABILITY_PRESETS.find(item => item.id === String(id || '').trim()) || null
}

function voicePresetPatchMatchesConfig(patch = {}, voice = {}) {
  const keys = Object.keys(patch || {})
  if (!keys.length) return false
  return keys.every(key => {
    const a = patch[key]
    const b = voice[key]
    if (typeof a === 'number' || typeof b === 'number') return Math.abs(Number(a) - Number(b)) < 0.0001
    return a === b
  })
}

function getCurrentVoiceStabilityPreset(voice = getVoiceConfig()) {
  const exact = VOICE_STABILITY_PRESETS.find(item => voicePresetPatchMatchesConfig(item.patch, voice))
  if (exact) return { id: exact.id, label: exact.label, reason: '当前设置与该预设完全一致。', exact: true }
  let best = null
  for (const item of VOICE_STABILITY_PRESETS) {
    const keys = Object.keys(item.patch || {})
    const matched = keys.filter(key => {
      const a = item.patch[key]
      const b = voice[key]
      if (typeof a === 'number' || typeof b === 'number') return Math.abs(Number(a) - Number(b)) < 0.0001
      return a === b
    }).length
    const score = keys.length ? matched / keys.length : 0
    if (!best || score > best.score) best = { id: item.id, label: item.label, score }
  }
  return best && best.score >= 0.7 ? { ...best, reason: '当前设置大部分接近该预设。', exact: false } : null
}

function recommendVoiceStabilityPreset({ summary = null, voice = getVoiceConfig() } = {}) {
  const recent = summary?.recent || {}
  const issues = Array.isArray(summary?.issues) ? summary.issues : []
  const wakeRejected = Number(recent.wakeRejected || 0)
  const speakerRejected = Number(recent.speakerRejected || 0)
  const asrFinal = Number(recent.asrFinal || 0)
  const ttsStop = Number(recent.ttsStop || 0)
  const videoProtectionOff = voice.videoVoiceDuckEnabled === false || voice.videoVoicePttEnabled === false || voice.videoVoiceAecEnabled === false
  if (speakerRejected >= 2 || issues.includes('speaker_rejected_high')) {
    return { id: 'balanced', label: '均衡推荐', reason: '最近出现多次声纹误拒，先回到较稳的声纹阈值，再重新测试。' }
  }
  if (wakeRejected >= 2 || issues.some(item => String(item).startsWith('wake_guard_')) || videoProtectionOff) {
    return { id: 'video-guard', label: '视频抗干扰', reason: '最近有唤醒拒绝/视频保护未全开，建议先启用更抗干扰的整组参数。' }
  }
  if (voice.speakerVerificationEnabled && voice.speakerThreshold >= 0.62) {
    return { id: 'strict-speaker', label: '严格声纹', reason: '你已启用较严格声纹，适合多人环境继续使用严格声纹预设。' }
  }
  if (asrFinal > 0 && ttsStop > 0 && wakeRejected === 0 && speakerRejected === 0) {
    return { id: 'quiet-room', label: '安静环境', reason: '最近链路正常且没有拒绝记录，可以使用响应更自然的安静环境预设。' }
  }
  return { id: 'balanced', label: '均衡推荐', reason: '没有足够异常证据时，默认使用均衡推荐作为稳定基线。' }
}

function buildVoiceStabilityPresetResponse({ windowMs = 60000 } = {}) {
  const voice = getVoiceConfig()
  let summary = null
  try { summary = getVoiceEventLinkSummary({ windowMs }) } catch (_) {}
  return {
    ok: true,
    presets: publicVoiceStabilityPresets(),
    current: voice,
    currentPreset: getCurrentVoiceStabilityPreset(voice),
    recommended: recommendVoiceStabilityPreset({ summary, voice }),
    summary: summary ? { level: summary.level, recent: summary.recent, issues: summary.issues } : null,
  }
}


function buildVoiceLocalDoctor({ windowMs = 60000 } = {}) {
  const voice = getVoiceConfig()
  const local = getVoiceStatus()
  let summary = null
  try { summary = getVoiceEventLinkSummary({ windowMs }) } catch (_) {}
  const checks = []
  const add = (id, label, status, detail, action = '', fixAction = null) => checks.push({ id, label, status, detail, action, ...(fixAction ? { fixAction } : {}) })
  add(
    'provider',
    '识别服务商',
    voice.asrProvider === 'local' ? 'ok' : 'warn',
    voice.asrProvider === 'local' ? '当前使用本地 ASR，音频不会上传云端。' : `当前服务商是 ${voice.asrProvider || 'unknown'}，本地声纹/离线识别不会作为主路径。`,
    voice.asrProvider === 'local' ? '保持本地模式。' : '在设置中把“服务商”切换为“本地模型”。',
    voice.asrProvider === 'local' ? null : 'use_local_sensevoice',
  )
  add(
    'engine',
    '本地模型',
    voice.localAsrModel === 'sensevoice-small' ? 'ok' : 'warn',
    voice.localAsrModel === 'sensevoice-small' ? 'SenseVoiceSmall 已作为中文优先模型。' : `当前本地模型是 ${voice.localAsrModel || voice.whisperModel || 'unknown'}。`,
    voice.localAsrModel === 'sensevoice-small' ? '保持 SenseVoiceSmall。' : '建议切到 SenseVoiceSmall，Whisper 仅作为备用。',
    voice.localAsrModel === 'sensevoice-small' ? null : 'use_local_sensevoice',
  )
  add(
    'process',
    '本地 ASR 进程',
    local.status === 'running' ? 'ok' : local.status === 'starting' ? 'pending' : 'warn',
    local.status === 'running' ? `运行中：${local.engine || 'engine'} / ${local.model || 'model'} / port ${local.port}` : `${local.status || 'stopped'}：${local.message || '本地语音服务未运行'}`,
    local.status === 'running' ? '可以开始麦克风测试。' : '点击“启动本地语音服务”或重新保存语音设置后再试。',
    local.status === 'running' ? null : 'start_local_voice',
  )
  add(
    'wake',
    '唤醒保护',
    voice.wakeWordEnabled === false ? 'warn' : 'ok',
    voice.wakeWordEnabled === false ? '唤醒词已关闭，视频/他人说话更容易误触发输入。' : `唤醒词开启，模式 ${voice.wakeMode || 'strict'}，阈值 ${voice.wakeConfidenceThreshold ?? '—'}。`,
    voice.wakeWordEnabled === false ? '开启唤醒词，并使用严格模式。' : '说“龙马，具体指令”进行测试。',
    voice.wakeWordEnabled === false ? 'enable_wake_guard' : null,
  )
  const videoOk = voice.videoVoiceDuckEnabled && voice.videoVoicePttEnabled && voice.videoVoiceAecEnabled
  add(
    'video_guard',
    '视频抗干扰',
    videoOk ? 'ok' : 'warn',
    videoOk ? '视频降音、按住说话、AEC 都已开启。' : '视频播放场景下仍有保护项未开启。',
    videoOk ? '播放视频时优先使用唤醒词，也可按住空格说话。' : '应用“视频抗干扰”预设，或手动开启视频降音/PTT/AEC。',
    videoOk ? null : 'apply_video_guard',
  )
  const speakerConfiguredHint = voice.speakerVerificationEnabled ? '已启用，只响应我的声音。' : '未启用，任何清晰唤醒词都可能触发。'
  add(
    'speaker_gate',
    '声纹门控',
    voice.speakerVerificationEnabled ? 'ok' : 'info',
    `${speakerConfiguredHint} 当前严格度 ${voice.speakerThreshold ?? '—'}。`,
    voice.speakerVerificationEnabled ? '如果本人被拒绝，降低严格度或重新录入。' : '如需只响应你本人，请录入声纹并开启“只响应我的声音”。',
  )
  if (summary) {
    const recent = summary.recent || {}
    add(
      'recent_loop',
      '最近闭环',
      recent.wakeAccepted > 0 && recent.asrFinal > 0 ? 'ok' : recent.wakeRejected > 0 || recent.speakerRejected > 0 ? 'warn' : 'pending',
      `wake ${recent.wakeAccepted || 0}/${recent.wakeRejected || 0} · speaker拒绝 ${recent.speakerRejected || 0} · asrFinal ${recent.asrFinal || 0} · tts ${recent.ttsStart || 0}/${recent.ttsStop || 0}`,
      '按一次唤醒词并说完整指令，然后观察这里是否出现 wake/asr/tts。',
    )
  }
  const severity = checks.some(item => item.status === 'warn' || item.status === 'error') ? 'warn' : checks.some(item => item.status === 'pending') ? 'pending' : 'ok'
  return {
    ok: true,
    level: severity,
    checkedAt: Date.now(),
    voice,
    local,
    summary: summary ? { level: summary.level, recent: summary.recent, issues: summary.issues, suggestions: summary.suggestions } : null,
    recentFixes: Array.isArray(voice.voiceLocalDoctorHistory) ? voice.voiceLocalDoctorHistory.slice(-5).reverse() : [],
    checks,
    nextActions: checks.filter(item => item.status !== 'ok').map(item => ({ id: item.id, label: item.label, action: item.action, fixAction: item.fixAction || null })).slice(0, 5),
  }
}


function localDoctorFixLabel(action = '') {
  const labels = {
    use_local_sensevoice: '切换到本地 SenseVoiceSmall',
    enable_wake_guard: '开启唤醒保护',
    apply_video_guard: '应用视频抗干扰预设',
    start_local_voice: '启动本地语音服务',
  }
  return labels[action] || action
}

function appendVoiceLocalDoctorHistory(record = {}) {
  const current = getVoiceConfig()
  const history = Array.isArray(current.voiceLocalDoctorHistory) ? current.voiceLocalDoctorHistory : []
  const next = [...history, { id: `voice_doctor_${Date.now()}_${history.length + 1}`, at: Date.now(), ...record }].slice(-20)
  setVoiceConfig({ voiceLocalDoctorHistory: next })
  return getVoiceConfig().voiceLocalDoctorHistory.slice(-1)[0] || null
}

function applyVoiceLocalDoctorFix(action = '') {
  const id = String(action || '').trim()
  const before = getVoiceConfig()
  let applied = {}
  let started = null
  if (id === 'use_local_sensevoice') {
    applied = { asrProvider: 'local', localAsrModel: 'sensevoice-small', whisperModel: 'small', asrProfile: 'balanced' }
    setVoiceConfig(applied)
  } else if (id === 'enable_wake_guard') {
    applied = { wakeWordEnabled: true, wakeMode: 'strict', wakeRepeatSuppression: true, wakeConfidenceThreshold: 0.72, wakeMinCommandChars: 2, wakeCooldownMs: 1200 }
    setVoiceConfig(applied)
  } else if (id === 'apply_video_guard') {
    const preset = getVoiceStabilityPreset('video-guard')
    applied = preset ? { ...preset.patch } : {}
    setVoiceConfig(applied)
  } else if (id === 'start_local_voice') {
    const current = getVoiceConfig()
    if (current.asrProvider !== 'local' || current.localAsrModel !== 'sensevoice-small') {
      applied = { asrProvider: 'local', localAsrModel: 'sensevoice-small', whisperModel: 'small', asrProfile: current.asrProfile || 'balanced' }
      setVoiceConfig(applied)
    }
    const voice = getVoiceConfig()
    started = startVoiceServer({ model: voice.localAsrModel || 'sensevoice-small', localAsrModel: voice.localAsrModel || 'sensevoice-small', profile: voice.asrProfile || 'balanced' })
  } else {
    const err = new Error('Unknown local voice doctor fix action.')
    err.statusCode = 404
    throw err
  }
  const after = getVoiceConfig()
  const record = appendVoiceLocalDoctorHistory({ action: id, label: localDoctorFixLabel(id), applied, before, after, status: started?.status || 'ok' })
  const voice = getVoiceConfig()
  return { action: id, applied, started, record, voice, doctor: buildVoiceLocalDoctor() }
}

const wakeTuningHistory = getVoiceConfig().wakeTuningHistory || []


function getWakeAutoTuningPolicy() {
  const voice = getVoiceConfig()
  return {
    enabled: Boolean(voice.wakeAutoTuningEnabled),
    minRejects: Number(voice.wakeAutoTuningMinRejects || 3),
    cooldownMs: Number(voice.wakeAutoTuningCooldownMs || 5 * 60 * 1000),
    maxActionsPerHour: Number(voice.wakeAutoTuningMaxActionsPerHour || 3),
    lastAppliedAt: Number(voice.wakeAutoTuningLastAppliedAt || 0),
  }
}
function countWakeAutoActionsSince(since = Date.now() - 3600000) {
  return wakeTuningHistory.filter(item => item.auto === true && Number(item.at || 0) >= since).length
}
function evaluateWakeAutoTuning({ windowMs = 60000 } = {}) {
  const summary = getVoiceEventLinkSummary({ windowMs })
  const current = getVoiceConfig()
  const actions = [...buildWakeGuardTuningActions({ summary, current }), ...buildSpeakerTuningActions({ summary, current })]
  const reasons = { ...(summary?.recent?.wakeRejectedReasons || {}) }
  const speakerRejected = Number(summary?.recent?.speakerRejected || 0)
  if (speakerRejected > 0) reasons['speaker rejected'] = speakerRejected
  const topReason = Object.entries(reasons).sort((a, b) => b[1] - a[1])[0] || null
  const topAction = topReason ? actions.find(item => item.reason === topReason[0]) || actions[0] : actions[0]
  const now = Date.now()
  const hourlyCount = countWakeAutoActionsSince(now - 3600000)
  const blocked = []
  const policy = getWakeAutoTuningPolicy()
  if (!policy.enabled) blocked.push('auto_disabled')
  if (!topReason || topReason[1] < policy.minRejects) blocked.push('not_enough_rejections')
  if (now - policy.lastAppliedAt < policy.cooldownMs) blocked.push('cooldown')
  if (hourlyCount >= policy.maxActionsPerHour) blocked.push('hourly_limit')
  if (!actions.length) blocked.push('no_safe_action')
  return {
    enabled: policy.enabled,
    policy: { minRejects: policy.minRejects, cooldownMs: policy.cooldownMs, maxActionsPerHour: policy.maxActionsPerHour, lastAppliedAt: policy.lastAppliedAt },
    topReason: topReason ? { reason: topReason[0], count: topReason[1] } : null,
    hourlyCount,
    blocked,
    eligible: blocked.length === 0,
    action: topAction || null,
    summary,
  }
}
function evaluateWakeTuningRecord(item, now = Date.now()) {
  if (!item || item.reason === 'rollback') return null
  const windowMs = Math.max(30000, Math.min(10 * 60 * 1000, Number(item.windowMs || 60000)))
  const before = item.beforeMetrics || getVoiceEventMetricsWindow({ since: item.at - windowMs, until: item.at })
  const after = getVoiceEventMetricsWindow({ since: item.at, until: now })
  const wakeImproved = after.wakeRejected < before.wakeRejected || (after.acceptanceRate != null && before.acceptanceRate != null && after.acceptanceRate > before.acceptanceRate)
  const speakerImproved = after.speakerRejected < before.speakerRejected || (after.speakerAcceptanceRate != null && before.speakerAcceptanceRate != null && after.speakerAcceptanceRate > before.speakerAcceptanceRate)
  const wakeWorse = after.wakeRejected > before.wakeRejected
  const speakerWorse = after.speakerRejected > before.speakerRejected
  const verdict = wakeImproved || speakerImproved
    ? 'improved'
    : after.total === 0
      ? 'pending'
      : wakeWorse || speakerWorse
        ? 'worse'
        : 'unchanged'
  return { windowMs, before, after, verdict }
}

function wakeTuningEvaluationAdvice(evaluation) {
  const verdict = evaluation?.verdict || 'pending'
  const before = evaluation?.before || {}
  const after = evaluation?.after || {}
  const speakerChanged = Number(before.speakerRejected || 0) !== Number(after.speakerRejected || 0) || before.speakerAcceptanceRate !== after.speakerAcceptanceRate
  if (verdict === 'improved') return { level: 'ok', action: 'keep', text: speakerChanged ? '调参后声纹拒绝减少或通过率变好，建议暂时保持当前参数并继续观察。' : '调参后唤醒表现变好，建议暂时保持当前参数并继续观察。' }
  if (verdict === 'worse') return { level: 'warn', action: 'rollback', text: speakerChanged ? '调参后声纹拒绝变多，建议立即回滚上一次声纹调参。' : '调参后唤醒拒绝变多，建议立即回滚上一次调参。' }
  if (verdict === 'unchanged') return { level: 'info', action: 'observe', text: '调参后效果变化不明显，建议继续观察或只做一次小幅调整。' }
  return { level: 'pending', action: 'wait', text: '调参后样本不足，先继续使用一段时间再判断。' }
}
function enrichWakeTuningEvaluation(item) {
  const evaluation = evaluateWakeTuningRecord(item)
  return evaluation ? { ...evaluation, advice: wakeTuningEvaluationAdvice(evaluation) } : null
}
function publicWakeTuningHistory() {
  return wakeTuningHistory.slice(-12).map(item => ({ ...item, before: { ...(item.before || {}) }, after: { ...(item.after || {}) }, applied: { ...(item.applied || {}) }, evaluation: enrichWakeTuningEvaluation(item) }))
}
function persistWakeTuningHistory() {
  setVoiceConfig({ wakeTuningHistory })
}
function pushWakeTuningRecord(record) {
  wakeTuningHistory.push({ id: `wake_tune_${Date.now()}_${wakeTuningHistory.length + 1}`, at: Date.now(), ...record })
  if (wakeTuningHistory.length > 30) wakeTuningHistory.shift()
  persistWakeTuningHistory()
  return wakeTuningHistory[wakeTuningHistory.length - 1]
}
function clearWakeTuningHistory() {
  const cleared = wakeTuningHistory.length
  wakeTuningHistory.splice(0, wakeTuningHistory.length)
  persistWakeTuningHistory()
  return cleared
}


// card.action signals that are lifecycle/system-internal — stored in DB for passive injector use only, not pushed to the agent queue
const SILENT_CARD_ACTIONS = new Set([
  'card.dismissed',  // card closed (components should use acui:dismiss; this is a fallback guard)
  'card.mounted',    // mount complete
  'card.dwell',      // dwell heartbeat
  'card.error',      // render error (already handled by the card.error type signal)
])

function getApiHost() {
  return String(globalThis.process?.env?.BAILONGMA_HOST || DEFAULT_API_HOST).trim() || DEFAULT_API_HOST
}

function isLanAccessEnabled() {
  return /^(1|true|yes|on)$/i.test(String(globalThis.process?.env?.BAILONGMA_ALLOW_LAN || '').trim())
}

function normalizeRemoteAddress(address = '') {
  const value = String(address || '').trim().toLowerCase()
  if (value.startsWith('::ffff:')) return value.slice('::ffff:'.length)
  return value
}

function isLoopbackAddress(address = '') {
  const value = normalizeRemoteAddress(address)
  return value === '127.0.0.1'
    || value === '::1'
    || value === 'localhost'
}

function isLoopbackRequest(req) {
  return isLoopbackAddress(req.socket?.remoteAddress)
}

function isPrivateLanAddress(address = '') {
  const value = normalizeRemoteAddress(address)
  if (!value) return false

  if (net.isIP(value) === 4) {
    const [a, b] = value.split('.').map(part => Number(part))
    return a === 10
      || (a === 172 && b >= 16 && b <= 31)
      || (a === 192 && b === 168)
      || (a === 169 && b === 254)
  }

  if (net.isIP(value) === 6) {
    return value.startsWith('fc') || value.startsWith('fd') || value.startsWith('fe80:')
  }

  return false
}

function isLanRequest(req) {
  return isLanAccessEnabled() && isPrivateLanAddress(req.socket?.remoteAddress)
}

function isLoopbackOrigin(origin = '') {
  if (!origin || origin === 'null') return true
  try {
    const parsed = new URL(origin)
    return ['127.0.0.1', 'localhost', '::1'].includes(parsed.hostname)
  } catch {
    return false
  }
}

function isAllowedOrigin(origin = '') {
  if (isLoopbackOrigin(origin)) return true
  if (!isLanAccessEnabled()) return false
  try {
    const parsed = new URL(origin)
    return isPrivateLanAddress(parsed.hostname)
  } catch {
    return false
  }
}

function getAuthToken() {
  return String(globalThis.process?.env?.BAILONGMA_API_TOKEN || '').trim()
}

function hasValidAuthToken(req, url) {
  const expected = getAuthToken()
  if (!expected) return false
  const header = req.headers.authorization || ''
  const bearer = header.match(/^Bearer\s+(.+)$/i)?.[1]?.trim()
  const queryToken = url.searchParams.get('token')
  return bearer === expected || queryToken === expected
}

function requireLocalOrToken(req, res, url) {
  if (hasAllowedAccess(req, url)) return true
  jsonResponse(res, 403, { ok: false, error: 'forbidden' })
  return false
}

function hasAllowedAccess(req, url) {
  return isLoopbackRequest(req) || hasValidAuthToken(req, url) || isLanRequest(req)
}

function getVoiceEventsAuthMetadata() {
  return {
    tokenConfigured: Boolean(getAuthToken()),
    requiredForRemote: Boolean(getAuthToken()),
  }
}

function isSensitivePath(pathname) {
  return pathname === '/activate'
    || pathname === '/settings'
    || pathname.startsWith('/settings/')
    || pathname.startsWith('/admin/')
    || pathname.startsWith('/memories/')
}

function isPathInside(parentDir, candidatePath) {
  const parent = path.resolve(parentDir)
  const candidate = path.resolve(candidatePath)
  const relative = path.relative(parent, candidate)
  return relative === '' || (!!relative && !relative.startsWith('..') && !path.isAbsolute(relative))
}

function jsonResponse(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(body))
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', chunk => chunks.push(chunk))
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf-8')
        resolve(raw ? JSON.parse(raw) : {})
      } catch (err) {
        reject(err)
      }
    })
    req.on('error', reject)
  })
}

function contentTypeFor(filePath) {
  switch (path.extname(filePath).toLowerCase()) {
    case '.js':
      return 'text/javascript; charset=utf-8'
    case '.css':
      return 'text/css; charset=utf-8'
    case '.json':
      return 'application/json; charset=utf-8'
    case '.svg':
      return 'image/svg+xml'
    default:
      return 'text/plain; charset=utf-8'
  }
}

function getAgentName() {
  return (getConfig('agent_name') || '').trim() || DEFAULT_AGENT_NAME
}

function stripAssistantHistoryLabels(content) {
  return String(content || '')
    .trim()
    .replace(/^(?:\s*\[assistant(?:\s+to\s+[^\]\r\n]+)?(?:\s+\d{4}-\d{2}-\d{2}T[^\]\r\n]+)?\]\s*)+/giu, '')
    .trim()
}

export function startAPI(port = 3721, { getStateSnapshot = null, onActivated = null } = {}) {
  const onActivatedCallback = onActivated
  const host = getApiHost()

  // 启动时把 DB 里的当前 agent_name 写进 sticky，
  // 这样后续每个新连上的 SSE 客户端（含 brain-ui 首次加载）能立即拿到正确名字
  try {
    const storedName = (getConfig('agent_name') || '').trim()
    if (storedName) setStickyEvent('agent_name_updated', { name: storedName })
  } catch {}
  const server = http.createServer(async (req, res) => {
    const base = `http://localhost:${port}`
    const url = new URL(req.url, base)
    const origin = req.headers.origin

    // GET /social/wechat-clawbot/qr — get current QR code status and URL
    if (req.method === 'GET' && url.pathname === '/social/wechat-clawbot/qr') {
      if (!hasAllowedAccess(req, url)) return jsonResponse(res, 403, { ok: false, error: 'forbidden' })
      return jsonResponse(res, 200, { ok: true, ...getClawbotQR() })
    }

    // POST /social/wechat-clawbot/logout — clear credentials and disconnect
    if (req.method === 'POST' && url.pathname === '/social/wechat-clawbot/logout') {
      if (!requireLocalOrToken(req, res, url)) return
      logoutClawbot()
      emitEvent('social_status', { platform: 'wechat-clawbot', status: 'idle' })
      return jsonResponse(res, 200, { ok: true })
    }

    if (isSocialWebhookPath(url.pathname)) {
      return handleSocialWebhook(req, res, url)
    }

    if (origin && !isAllowedOrigin(origin)) {
      return jsonResponse(res, 403, { ok: false, error: 'forbidden origin' })
    }

    if (!hasAllowedAccess(req, url)) {
      return jsonResponse(res, 403, { ok: false, error: 'forbidden' })
    }

    if (isAllowedOrigin(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin || 'null')
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

    if (req.method !== 'OPTIONS' && isSensitivePath(url.pathname) && !requireLocalOrToken(req, res, url)) return

    if (req.method === 'OPTIONS') {
      res.writeHead(204)
      res.end()
      return
    }

    // POST /message — send message to agent
    if (req.method === 'POST' && url.pathname === '/message') {
      const chunks = []
      req.on('data', chunk => chunks.push(chunk))
      req.on('end', () => {
        try {
          const body = Buffer.concat(chunks).toString('utf-8')
          const { from_id = 'ID:000001', content, channel = 'API' } = JSON.parse(body)
          if (!content?.trim()) return jsonResponse(res, 400, { error: 'content required' })
          const trimmed = content.trim()
          pushMessage(from_id, trimmed, channel)
          emitEvent('message_in', { from_id, content: trimmed, channel, timestamp: new Date().toISOString() })
          jsonResponse(res, 200, { ok: true, agent_name: getAgentName() })
        } catch (e) {
          jsonResponse(res, 400, { error: e.message })
        }
      })
      return
    }

    // GET /events — SSE real-time event stream (outbound channel for bidirectional communication)
    if (req.method === 'GET' && url.pathname === '/events') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      })
      res.write(`data: ${JSON.stringify({ type: 'connected', ts: new Date().toISOString() })}\n\n`)
      flushStickyEvents(res)
      addSSEClient(res)
      const keepAlive = setInterval(() => {
        try { res.write(': ping\n\n') } catch (_) { clearInterval(keepAlive); removeSSEClient(res) }
      }, 15000)
      req.on('close', () => {
        clearInterval(keepAlive)
        removeSSEClient(res)
      })
      return
    }

    // GET /memories?limit=20&search=keyword
    if (req.method === 'GET' && url.pathname === '/memories') {
      const db = getDB()
      const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 100)
      const search = url.searchParams.get('search')
      let rows
      if (search) {
        try {
          rows = db.prepare(`
            SELECT m.* FROM memories m
            JOIN memories_fts ON memories_fts.rowid = m.id
            WHERE memories_fts MATCH ?
            ORDER BY bm25(memories_fts), m.created_at DESC LIMIT ?
          `).all(search, limit)
        } catch {
          rows = db.prepare(`SELECT * FROM memories WHERE content LIKE ? OR detail LIKE ? ORDER BY created_at DESC LIMIT ?`)
            .all(`%${search}%`, `%${search}%`, limit)
        }
      } else {
        rows = db.prepare('SELECT * FROM memories ORDER BY created_at DESC LIMIT ?').all(limit)
      }
      jsonResponse(res, 200, rows)
      return
    }

    // GET /conversations?limit=60 — chat history (ascending by time, most recent last)
    // Admin/debug endpoint: returns FULL history including focus_absorbed rows.
    // The absorbed flag (dynamic memory pool 3.5) only filters main-line injection
    // in injector.js; here the operator needs to see everything for debugging.
    if (req.method === 'GET' && url.pathname === '/conversations') {
      const db = getDB()
      const limit = Math.min(parseInt(url.searchParams.get('limit') || '60'), 500)
      const rows = db.prepare(`
        SELECT id, role, from_id, to_id, content, timestamp, channel, external_party_id, focus_absorbed
        FROM conversations
        ORDER BY id DESC
        LIMIT ?
      `).all(limit)
      jsonResponse(res, 200, rows.reverse().map(row => (
        row.role === 'jarvis'
          ? { ...row, content: stripAssistantHistoryLabels(row.content) }
          : row
      )))
      return
    }

    // GET /status
    if (req.method === 'GET' && url.pathname === '/status') {
      const db = getDB()
      const { n } = db.prepare('SELECT COUNT(*) as n FROM memories').get()
      jsonResponse(res, 200, { ok: true, memory_count: n, running: isRunning() })
      return
    }

    // GET /quota
    if (req.method === 'GET' && url.pathname === '/quota') {
      jsonResponse(res, 200, getQuotaStatus())
      return
    }

    // GET /hotspots — unified trending data, 30-minute cache by default
    if (req.method === 'GET' && url.pathname === '/hotspots') {
      getHotspots({
        force: /^(1|true|yes)$/i.test(url.searchParams.get('refresh') || ''),
        viewed: /^(1|true|yes)$/i.test(url.searchParams.get('viewed') || ''),
      })
        .then((hotspots) => jsonResponse(res, 200, hotspots))
        .catch((err) => jsonResponse(res, 502, {
          ok: false,
          error: err.message,
          refreshMinutes: 30,
          platforms: {},
        }))
      return
    }

    if (url.pathname === '/hotspot-state') {
      if (req.method === 'GET') {
        jsonResponse(res, 200, { ok: true, state: getHotspotPanelState() })
        return
      }
      if (req.method === 'POST') {
        readJsonBody(req)
          .then((body) => {
            const active = typeof body.active === 'boolean'
              ? body.active
              : /^(1|true|yes|open|show)$/i.test(String(body.active || ''))
            const state = setHotspotPanelState({ active, source: body.source || 'brain-ui' })
            jsonResponse(res, 200, { ok: true, state })
          })
          .catch((err) => jsonResponse(res, 400, { ok: false, error: err.message }))
        return
      }
    }

    // GET /doc-panel-state — document panel state
    // POST /doc-panel-state — set document panel state { active, topicId, source }
    if (url.pathname === '/doc-panel-state') {
      if (req.method === 'GET') {
        jsonResponse(res, 200, { ok: true, state: getDocPanelState() })
        return
      }
      if (req.method === 'POST') {
        readJsonBody(req)
          .then((body) => {
            const active = typeof body.active === 'boolean'
              ? body.active
              : /^(1|true|yes|open|show)$/i.test(String(body.active || ''))
            const state = setDocPanelState({ active, topicId: body.topicId || null, source: body.source || 'brain-ui' })
            jsonResponse(res, 200, { ok: true, state })
          })
          .catch((err) => jsonResponse(res, 400, { ok: false, error: err.message }))
        return
      }
    }

    // GET /docs/:topicId — get content for a specific document topic
    if (req.method === 'GET' && url.pathname.startsWith('/docs/')) {
      const topicId = url.pathname.slice(6)
      const doc = DOC_TOPICS[topicId]
      if (!doc) {
        jsonResponse(res, 404, { ok: false, error: `unknown topic: ${topicId}` })
        return
      }
      jsonResponse(res, 200, { ok: true, doc })
      return
    }

    // GET /docs — list all document topics
    if (req.method === 'GET' && url.pathname === '/docs') {
      const topics = Object.values(DOC_TOPICS).map(({ id, title, subtitle, icon, summary }) => ({ id, title, subtitle, icon, summary }))
      jsonResponse(res, 200, { ok: true, topics })
      return
    }

    if (req.method === 'GET' && url.pathname === '/person-card') {
      const name = url.searchParams.get('name') || url.searchParams.get('q') || ''
      jsonResponse(res, 200, { ok: true, card: getPersonCard(name) })
      return
    }

    if (url.pathname === '/person-card-state') {
      if (req.method === 'GET') {
        jsonResponse(res, 200, { ok: true, state: getPersonCardPanelState() })
        return
      }
      if (req.method === 'POST') {
        readJsonBody(req)
          .then((body) => {
            const active = typeof body.active === 'boolean'
              ? body.active
              : /^(1|true|yes|open|show)$/i.test(String(body.active || ''))
            const state = setPersonCardPanelState({
              active,
              source: body.source || 'brain-ui',
              card: body.card || null,
              name: body.name || '',
            })
            jsonResponse(res, 200, { ok: true, state })
          })
          .catch((err) => jsonResponse(res, 400, { ok: false, error: err.message }))
        return
      }
    }

    if (req.method === 'GET' && url.pathname === '/system-prompt-preview') {
      Promise.resolve()
        .then(() => buildHeartbeatSystemPromptPreview({
          stateSnapshot: typeof getStateSnapshot === 'function' ? getStateSnapshot() : {},
        }))
        .then((preview) => jsonResponse(res, 200, preview))
        .catch((err) => jsonResponse(res, 500, { error: err.message }))
      return
    }

    if (req.method === 'GET' && url.pathname === '/agent-profile') {
      jsonResponse(res, 200, { name: getAgentName() })
      return
    }

    // GET /media/history?limit=30
    if (req.method === 'GET' && url.pathname === '/media/history') {
      const limit = Math.min(parseInt(url.searchParams.get('limit') || '30'), 100)
      jsonResponse(res, 200, getMediaHistory(limit))
      return
    }

    // POST /media/history — { kind, url, title, videoId, platform }
    if (req.method === 'POST' && url.pathname === '/media/history') {
      const chunks = []
      req.on('data', c => chunks.push(c))
      req.on('end', () => {
        try {
          const body = JSON.parse(Buffer.concat(chunks).toString())
          if (!body.url || !body.kind) return jsonResponse(res, 400, { ok: false, error: 'url and kind required' })
          upsertMediaHistory(body)
          jsonResponse(res, 200, { ok: true })
        } catch (e) {
          jsonResponse(res, 400, { ok: false, error: e.message })
        }
      })
      return
    }

    // GET /favicon.ico ? silence the browser's automatic favicon request
    if (req.method === 'GET' && url.pathname === '/favicon.ico') {
      res.writeHead(204)
      res.end()
      return
    }

    // DELETE /memories/:id — delete a memory
    if (req.method === 'DELETE' && url.pathname.startsWith('/memories/')) {
      const id = parseInt(url.pathname.split('/')[2])
      if (!id) return jsonResponse(res, 400, { error: 'invalid id' })
      const db = getDB()
      db.prepare('DELETE FROM memories WHERE id = ?').run(id)
      jsonResponse(res, 200, { ok: true })
      return
    }

    // PATCH /memories/:id — update memory content/detail
    if (req.method === 'PATCH' && url.pathname.startsWith('/memories/')) {
      const id = parseInt(url.pathname.split('/')[2])
      if (!id) return jsonResponse(res, 400, { error: 'invalid id' })
      const chunks = []
      req.on('data', chunk => chunks.push(chunk))
      req.on('end', () => {
        try {
          const { content, detail } = JSON.parse(Buffer.concat(chunks).toString('utf-8'))
          const db = getDB()
          if (content !== undefined) db.prepare('UPDATE memories SET content = ? WHERE id = ?').run(content, id)
          if (detail !== undefined) db.prepare('UPDATE memories SET detail = ? WHERE id = ?').run(detail, id)
          jsonResponse(res, 200, { ok: true })
        } catch (e) {
          jsonResponse(res, 400, { error: e.message })
        }
      })
      return
    }

    // GET /media/music/:filename — serve musicDir audio files (avoids file:// cross-origin restriction)
    if (req.method === 'GET' && url.pathname.startsWith('/media/music/')) {
      const raw = url.pathname.slice('/media/music/'.length)
      const filename = path.basename(decodeURIComponent(raw))
      const filePath = path.join(paths.musicDir, filename)
      const resolvedFile = path.resolve(filePath)
      const resolvedDir  = path.resolve(paths.musicDir)
      if (!resolvedFile.startsWith(resolvedDir + path.sep) && resolvedFile !== resolvedDir) {
        res.writeHead(403); res.end('forbidden'); return
      }
      const mimeMap = {
        '.mp3': 'audio/mpeg', '.flac': 'audio/flac', '.wav': 'audio/wav',
        '.aac': 'audio/aac',  '.ogg': 'audio/ogg',   '.m4a': 'audio/mp4',
        '.opus': 'audio/ogg; codecs=opus',
      }
      const contentType = mimeMap[path.extname(filename).toLowerCase()] || 'audio/mpeg'
      try {
        const stat = fs.statSync(filePath)
        const total = stat.size
        const rangeHeader = req.headers.range
        if (rangeHeader) {
          const m = rangeHeader.match(/bytes=(\d*)-(\d*)/)
          const start = m[1] ? parseInt(m[1]) : 0
          const end   = m[2] ? parseInt(m[2]) : total - 1
          res.writeHead(206, {
            'Content-Type': contentType,
            'Content-Range': `bytes ${start}-${end}/${total}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': end - start + 1,
            'Cache-Control': 'no-cache',
          })
          fs.createReadStream(filePath, { start, end }).pipe(res)
        } else {
          res.writeHead(200, {
            'Content-Type': contentType,
            'Content-Length': total,
            'Accept-Ranges': 'bytes',
            'Cache-Control': 'no-cache',
          })
          fs.createReadStream(filePath).pipe(res)
        }
      } catch {
        res.writeHead(404); res.end('music file not found')
      }
      return
    }

    // GET /media/video?path=/absolute/video.mp4 — serve local video files for the Electron UI.
    // This avoids file:// playback restrictions while keeping the endpoint video-only.
    if (req.method === 'GET' && url.pathname === '/media/video') {
      const rawPath = url.searchParams.get('path') || ''
      const filePath = path.resolve(rawPath)
      const ext = path.extname(filePath).toLowerCase()
      const mimeMap = {
        '.mp4': 'video/mp4',
        '.m4v': 'video/mp4',
        '.webm': 'video/webm',
        '.mov': 'video/quicktime',
        '.ogv': 'video/ogg',
        '.ogg': 'video/ogg',
      }
      const contentType = mimeMap[ext]
      if (!rawPath || !contentType) {
        res.writeHead(400)
        res.end('unsupported or missing video path')
        return
      }
      try {
        const stat = fs.statSync(filePath)
        if (!stat.isFile()) throw new Error('not a file')
        const total = stat.size
        const rangeHeader = req.headers.range
        if (rangeHeader) {
          const m = rangeHeader.match(/bytes=(\d*)-(\d*)/)
          const start = m?.[1] ? parseInt(m[1], 10) : 0
          const end = m?.[2] ? parseInt(m[2], 10) : total - 1
          if (start >= total || end >= total || start > end) {
            res.writeHead(416, { 'Content-Range': `bytes */${total}` })
            res.end()
            return
          }
          res.writeHead(206, {
            'Content-Type': contentType,
            'Content-Range': `bytes ${start}-${end}/${total}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': end - start + 1,
            'Cache-Control': 'no-cache',
          })
          fs.createReadStream(filePath, { start, end }).pipe(res)
        } else {
          res.writeHead(200, {
            'Content-Type': contentType,
            'Content-Length': total,
            'Accept-Ranges': 'bytes',
            'Cache-Control': 'no-cache',
          })
          fs.createReadStream(filePath).pipe(res)
        }
      } catch {
        res.writeHead(404)
        res.end('video file not found')
      }
      return
    }

    // GET /audio/:filename — serve sandbox audio files
    if (req.method === 'GET' && url.pathname.startsWith('/audio/')) {
      const filename = path.basename(url.pathname)
      const filePath = path.join(SANDBOX_PATH, 'audio', filename)
      try {
        const stat = fs.statSync(filePath)
        res.writeHead(200, {
          'Content-Type': 'audio/mpeg',
          'Content-Length': stat.size,
          'Cache-Control': 'no-cache',
        })
        fs.createReadStream(filePath).pipe(res)
      } catch {
        res.writeHead(404)
        res.end('audio not found')
      }
      return
    }

    // GET /activation-status — check whether the system is activated
    if (req.method === 'GET' && url.pathname === '/activation-status') {
      jsonResponse(res, 200, getActivationStatus())
      return
    }

    // POST /activate — submit API key to complete activation
    if (req.method === 'POST' && url.pathname === '/activate') {
      const chunks = []
      req.on('data', chunk => chunks.push(chunk))
      req.on('end', async () => {
        try {
          const body = Buffer.concat(chunks).toString('utf-8')
          const { apiKey, model, provider, baseURL, agentName } = JSON.parse(body || '{}')

          const trimmedName = String(agentName || '').trim()
          if (trimmedName) {
            if (trimmedName.length > 32) {
              return jsonResponse(res, 400, { ok: false, error: 'AI 名字不能超过 32 个字符' })
            }
            if (!/^[一-龥A-Za-z0-9 _-]+$/.test(trimmedName)) {
              return jsonResponse(res, 400, { ok: false, error: 'AI 名字只允许中文、英文字母、数字、空格、下划线、短横线' })
            }
          }

          const info = await activateLLM({ provider, apiKey, model, baseURL })

          if (trimmedName) {
            try {
              setConfig('agent_name', trimmedName)
              setStickyEvent('agent_name_updated', { name: trimmedName })
              emitEvent('agent_name_updated', { name: trimmedName })
            } catch (err) {
              console.error('[API] save agent_name failed:', err)
            }
          }

          emitEvent('activated', info)
          // Notify index.js to start the main loop
          if (typeof onActivatedCallback === 'function') {
            try { onActivatedCallback() } catch (err) { console.error('[API] onActivated callback error:', err) }
          }
          jsonResponse(res, 200, { ok: true, ...info, agent_name: getAgentName() })
        } catch (err) {
          jsonResponse(res, 400, { ok: false, error: err.message })
        }
      })
      return
    }

    // GET /settings — return current LLM + MiniMax configuration status
    if (req.method === 'GET' && url.pathname === '/settings') {
      const status = getActivationStatus()
      const minimaxKey = getMinimaxKey()
      jsonResponse(res, 200, {
        llm: {
          activated: status.activated,
          provider: status.provider,
          model: status.model,
          baseURL: status.baseURL,
          models: status.models,
          temperature: config.temperature,
        },
        providers: getProviderSummaries(),
        minimax: {
          configured: !!(globalThis.process?.env?.MINIMAX_API_KEY || minimaxKey),
        },
      })
      return
    }

    // POST /settings/model — switch model only (no need to re-enter the key)
    if (req.method === 'POST' && url.pathname === '/settings/model') {
      const chunks = []
      req.on('data', chunk => chunks.push(chunk))
      req.on('end', () => {
        try {
          const { model } = JSON.parse(Buffer.concat(chunks).toString('utf-8') || '{}')
          const result = switchModel(model)
          emitEvent('model_switched', result)
          jsonResponse(res, 200, { ok: true, ...result })
        } catch (err) {
          jsonResponse(res, 400, { ok: false, error: err.message })
        }
      })
      return
    }

    // POST /settings/temperature — set LLM temperature
    if (req.method === 'POST' && url.pathname === '/settings/temperature') {
      const chunks = []
      req.on('data', chunk => chunks.push(chunk))
      req.on('end', () => {
        try {
          const { temperature } = JSON.parse(Buffer.concat(chunks).toString('utf-8') || '{}')
          const result = setTemperature(temperature)
          jsonResponse(res, 200, { ok: true, ...result })
        } catch (err) {
          jsonResponse(res, 400, { ok: false, error: err.message })
        }
      })
      return
    }

    // GET /settings/security — read security sandbox configuration
    if (req.method === 'GET' && url.pathname === '/settings/security') {
      if (!hasAllowedAccess(req, url)) return jsonResponse(res, 403, { ok: false, error: 'forbidden' })
      jsonResponse(res, 200, { ok: true, security: getSecurity() })
      return
    }

    // POST /settings/security — save security sandbox configuration
    if (req.method === 'POST' && url.pathname === '/settings/security') {
      if (!requireLocalOrToken(req, res, url)) return
      const chunks = []
      req.on('data', chunk => chunks.push(chunk))
      req.on('end', () => {
        try {
          const updates = JSON.parse(Buffer.concat(chunks).toString('utf-8') || '{}')
          const result = setSecurity(updates)
          jsonResponse(res, 200, { ok: true, security: result })
        } catch (err) {
          jsonResponse(res, 400, { ok: false, error: err.message })
        }
      })
      return
    }

    // GET /settings/social — read per-platform configuration status (plaintext keys not returned)
    if (req.method === 'GET' && url.pathname === '/settings/social') {
      jsonResponse(res, 200, { ok: true, social: getSocialConfig() })
      return
    }

    // POST /settings/social — save platform credentials and hot-restart affected connectors
    if (req.method === 'POST' && url.pathname === '/settings/social') {
      const chunks = []
      req.on('data', chunk => chunks.push(chunk))
      req.on('end', async () => {
        try {
          const updates = JSON.parse(Buffer.concat(chunks).toString('utf-8') || '{}')
          setSocialConfig(updates)
          // Restart the connector for each platform whose key was updated
          const PLATFORM_KEYS = {
            discord: ['DISCORD_BOT_TOKEN'],
          }
          for (const [platform, keys] of Object.entries(PLATFORM_KEYS)) {
            if (keys.some(k => updates[k])) {
              restartConnector(platform, { pushMessage, emitEvent }).catch(err =>
                console.warn(`[social] restart ${platform} failed:`, err.message)
              )
            }
          }
          // Restart the ClawBot connector when the user clicks "Connect WeChat"
          if (updates._clawbot_connect) {
            restartConnector('wechat-clawbot', { pushMessage, emitEvent }).catch(err =>
              console.warn('[social] restart wechat-clawbot failed:', err.message)
            )
          }
          jsonResponse(res, 200, { ok: true, social: getSocialConfig() })
        } catch (err) {
          jsonResponse(res, 400, { ok: false, error: err.message })
        }
      })
      return
    }

    // POST /settings/minimax — set MiniMax API key
    if (req.method === 'POST' && url.pathname === '/settings/minimax') {
      const chunks = []
      req.on('data', chunk => chunks.push(chunk))
      req.on('end', () => {
        try {
          const { apiKey } = JSON.parse(Buffer.concat(chunks).toString('utf-8') || '{}')
          const trimmed = String(apiKey || '').trim()
          if (!trimmed) throw new Error('API key cannot be empty')
          setMinimaxKey(trimmed)
          replaceProvider(new MinimaxProvider({ apiKey: trimmed }))
          jsonResponse(res, 200, { ok: true, configured: true })
        } catch (err) {
          jsonResponse(res, 400, { ok: false, error: err.message })
        }
      })
      return
    }

    // GET /activation — activation guide page
    if (req.method === 'GET' && (url.pathname === '/activation' || url.pathname === '/activation.html')) {
      try {
        const html = fs.readFileSync(ACTIVATION_PATH, 'utf-8')
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
        res.end(html)
      } catch {
        res.writeHead(404)
        res.end('activation.html not found')
      }
      return
    }

    // GET / — redirect to activation page if not activated, brain-ui if activated
    if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
      if (config.needsActivation) {
        res.writeHead(302, { Location: '/activation' })
        res.end()
        return
      }
      try {
        const html = fs.readFileSync(INDEX_PATH, 'utf-8')
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
        res.end(html)
      } catch {
        // No index.html — go directly to brain-ui
        res.writeHead(302, { Location: '/brain-ui' })
        res.end()
      }
      return
    }

    if (req.method === 'GET' && url.pathname === '/dashboard.html') {
      try {
        const html = fs.readFileSync(DASHBOARD_PATH, 'utf-8')
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
        res.end(html)
      } catch {
        res.writeHead(404)
        res.end('dashboard.html not found')
      }
      return
    }

    // GET /brain.html — Brain Monitor
    if (req.method === 'GET' && url.pathname === '/brain.html') {
      try {
        const html = fs.readFileSync(BRAIN_PATH, 'utf-8')
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
        res.end(html)
      } catch {
        res.writeHead(404)
        res.end('brain.html not found')
      }
      return
    }

    // GET /brain-ui — Brain UI (memory graph + thought stream + chat)
    if (req.method === 'GET' && (url.pathname === '/site' || url.pathname === '/site.html')) {
      try {
        const html = fs.readFileSync(WEBSITE_PATH, 'utf-8')
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
        res.end(html)
      } catch {
        res.writeHead(404)
        res.end('website.html not found')
      }
      return
    }

    if (req.method === 'GET' && (url.pathname === '/brain-ui' || url.pathname === '/brain-ui.html')) {
      if (config.needsActivation) {
        res.writeHead(302, { Location: '/activation' })
        res.end()
        return
      }
      try {
        const html = fs.readFileSync(BRAIN_UI_PATH, 'utf-8')
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
        res.end(html)
      } catch {
        res.writeHead(404)
        res.end('brain-ui.html not found')
      }
      return
    }

    if (req.method === 'GET' && url.pathname === '/systemPrompt.html') {
      try {
        const html = fs.readFileSync(SYSTEM_PROMPT_PATH, 'utf-8')
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
        res.end(html)
      } catch {
        res.writeHead(404)
        res.end('systemPrompt.html not found')
      }
      return
    }

    if (req.method === 'GET' && url.pathname === '/vendor/d3/d3.min.js') {
      try {
        const stat = fs.statSync(D3_VENDOR_PATH)
        res.writeHead(200, {
          'Content-Type': contentTypeFor(D3_VENDOR_PATH),
          'Content-Length': stat.size,
          'Cache-Control': 'public, max-age=31536000, immutable',
        })
        fs.createReadStream(D3_VENDOR_PATH).pipe(res)
      } catch {
        res.writeHead(404)
        res.end('d3.min.js not found')
      }
      return
    }

    if (req.method === 'GET' && url.pathname.startsWith('/src/ui/brain-ui/')) {
      const relativePath = decodeURIComponent(url.pathname.slice('/src/ui/brain-ui/'.length))
      const assetRoot = path.resolve(BRAIN_UI_ASSET_ROOT)
      const assetPath = path.resolve(BRAIN_UI_ASSET_ROOT, relativePath)

      if (!isPathInside(assetRoot, assetPath)) {
        res.writeHead(403)
        res.end('forbidden')
        return
      }

      try {
        const stat = fs.statSync(assetPath)
        if (!stat.isFile()) {
          res.writeHead(404)
          res.end('asset not found')
          return
        }

        res.writeHead(200, {
          'Content-Type': contentTypeFor(assetPath),
          'Content-Length': stat.size,
          'Cache-Control': 'no-cache',
        })
        fs.createReadStream(assetPath).pipe(res)
      } catch {
        res.writeHead(404)
        res.end('asset not found')
      }
      return
    }

    // POST /admin/stop — pause the consciousness loop (keep HTTP service running)
    if (req.method === 'POST' && url.pathname === '/admin/stop') {
      stopLoop()
      emitEvent('admin', { action: 'stop', running: false })
      jsonResponse(res, 200, { ok: true, running: false })
      return
    }

    // POST /admin/start — resume the consciousness loop
    if (req.method === 'POST' && url.pathname === '/admin/start') {
      startLoop()
      emitEvent('admin', { action: 'start', running: true })
      jsonResponse(res, 200, { ok: true, running: true })
      return
    }

    // POST /admin/restart — request a normal Electron relaunch when available.
    if (req.method === 'POST' && url.pathname === '/admin/restart') {
      jsonResponse(res, 200, { ok: true, message: 'Restarting…' })
      setTimeout(() => {
        const restart = globalThis.bailongmaAppControl?.restart
        if (typeof restart === 'function') {
          restart()
          return
        }
        process.exit(0)
      }, 500)
      return
    }

    // POST /admin/reset-memories — clear all memories and conversations
    if (req.method === 'POST' && url.pathname === '/admin/reset-memories') {
      const db = getDB()
      db.prepare('DELETE FROM memories').run()
      db.prepare('DELETE FROM conversations').run()
      db.prepare("DELETE FROM config WHERE key != 'birth_time'").run()
      db.prepare('DELETE FROM entities').run()
      db.exec("INSERT INTO memories_fts(memories_fts) VALUES('rebuild')")
      emitEvent('admin', { action: 'reset-memories' })
      jsonResponse(res, 200, { ok: true })
      return
    }

    // POST /admin/reset-files — clear sandbox user files (keeping readme.txt and world.txt)
    if (req.method === 'POST' && url.pathname === '/admin/reset-files') {
      const sandboxPath = SANDBOX_PATH
      const KEEP = new Set(['readme.txt', 'world.txt'])
      function clearDir(dir) {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          const full = path.join(dir, entry.name)
          if (entry.isDirectory()) {
            clearDir(full)
            try { fs.rmdirSync(full) } catch (_) {}
          } else if (!KEEP.has(entry.name.toLowerCase())) {
            fs.unlinkSync(full)
          }
        }
      }
      try { clearDir(sandboxPath) } catch (_) {}
      emitEvent('admin', { action: 'reset-files' })
      jsonResponse(res, 200, { ok: true })
      return
    }

    // GET /settings/voice — read voice configuration (credentials returned as configured-status only)
    if (req.method === 'GET' && url.pathname === '/settings/voice') {
      jsonResponse(res, 200, { ok: true, voice: getVoiceConfig() })
      return
    }

    // POST /settings/voice — save voice configuration { whisperModel?, aliyunApiKey?, ... }
    if (req.method === 'POST' && url.pathname === '/settings/voice') {
      const chunks = []
      req.on('data', chunk => chunks.push(chunk))
      req.on('end', () => {
        try {
          const body = JSON.parse(Buffer.concat(chunks).toString('utf-8') || '{}')
          setVoiceConfig(body)
          jsonResponse(res, 200, { ok: true, voice: getVoiceConfig() })
        } catch (err) {
          jsonResponse(res, 400, { ok: false, error: err.message })
        }
      })
      return
    }

    // GET /settings/voice/presets — recommended voice stability presets
    if (req.method === 'GET' && url.pathname === '/settings/voice/presets') {
      const windowMs = Math.max(10000, Math.min(10 * 60 * 1000, Number(url.searchParams.get('windowMs') || 60000) || 60000))
      jsonResponse(res, 200, buildVoiceStabilityPresetResponse({ windowMs }))
      return
    }

    // POST /settings/voice/preset/apply — apply one recommended voice stability preset
    if (req.method === 'POST' && url.pathname === '/settings/voice/preset/apply') {
      const chunks = []
      req.on('data', chunk => chunks.push(chunk))
      req.on('end', () => {
        try {
          const body = JSON.parse(Buffer.concat(chunks).toString('utf-8') || '{}')
          const preset = getVoiceStabilityPreset(body.id || body.preset || '')
          if (!preset) {
            jsonResponse(res, 404, { ok: false, error: 'Unknown voice stability preset.' })
            return
          }
          setVoiceConfig(preset.patch)
          const voice = getVoiceConfig()
          jsonResponse(res, 200, { ok: true, preset: { id: preset.id, label: preset.label, description: preset.description, patch: { ...preset.patch } }, voice, currentPreset: getCurrentVoiceStabilityPreset(voice), recommended: recommendVoiceStabilityPreset({ voice }) })
        } catch (err) {
          jsonResponse(res, 400, { ok: false, error: err.message })
        }
      })
      return
    }


    // GET /voice/events/status — experimental voice event WebSocket status
    if (req.method === 'GET' && url.pathname === '/voice/events/status') {
      jsonResponse(res, 200, { ok: true, ...getVoiceEventBusStatus() })
      return
    }

    // GET /voice/events/clients — focused connected-client diagnostics
    if (req.method === 'GET' && url.pathname === '/voice/events/clients') {
      const clientDetails = getVoiceEventClientDetails()
      jsonResponse(res, 200, {
        ok: true,
        service: 'bailongma.voice.events',
        version: getVoiceEventBusStatus().version,
        clients: clientDetails.length,
        clientDetails,
      })
      return
    }



    // GET /voice/events/history — recent raw and Xiaozhi-mapped voice events
    if (req.method === 'GET' && url.pathname === '/voice/events/history') {
      const limit = Number(url.searchParams.get('limit') || 50)
      const type = url.searchParams.get('type') || ''
      const events = getVoiceEventHistory({ limit, type })
      jsonResponse(res, 200, {
        ok: true,
        service: 'bailongma.voice.events',
        version: getVoiceEventBusStatus().version,
        total: events.length,
        limit: Math.max(1, Math.min(100, Math.round(Number(limit) || 50))),
        events,
      })
      return
    }



    // GET /voice/wake/tuning/auto — safe auto-tuning policy and eligibility
    if (req.method === 'GET' && url.pathname === '/voice/wake/tuning/auto') {
      const windowMs = Number(url.searchParams.get('windowMs') || 60000)
      jsonResponse(res, 200, { ok: true, service: 'bailongma.voice.wake.auto_tuning', ...evaluateWakeAutoTuning({ windowMs }) })
      return
    }

    // POST /voice/wake/tuning/auto — update safe auto-tuning policy
    if (req.method === 'POST' && url.pathname === '/voice/wake/tuning/auto') {
      const chunks = []
      req.on('data', chunk => chunks.push(chunk))
      req.on('end', () => {
        try {
          const body = JSON.parse(Buffer.concat(chunks).toString('utf-8') || '{}')
          const patch = {}
          if (typeof body.enabled === 'boolean') patch.wakeAutoTuningEnabled = body.enabled
          if (Number.isFinite(Number(body.minRejects))) patch.wakeAutoTuningMinRejects = body.minRejects
          if (Number.isFinite(Number(body.cooldownMs))) patch.wakeAutoTuningCooldownMs = body.cooldownMs
          if (Number.isFinite(Number(body.maxActionsPerHour))) patch.wakeAutoTuningMaxActionsPerHour = body.maxActionsPerHour
          if (Object.keys(patch).length) setVoiceConfig(patch)
          jsonResponse(res, 200, { ok: true, service: 'bailongma.voice.wake.auto_tuning', ...evaluateWakeAutoTuning({ windowMs: Number(body.windowMs || 60000) }) })
        } catch (err) {
          jsonResponse(res, 400, { ok: false, error: err.message })
        }
      })
      return
    }

    // POST /voice/wake/tuning/auto/apply — apply one eligible safe auto-tuning action
    if (req.method === 'POST' && url.pathname === '/voice/wake/tuning/auto/apply') {
      const windowMs = Number(url.searchParams.get('windowMs') || 60000)
      const decision = evaluateWakeAutoTuning({ windowMs })
      if (!decision.eligible || !decision.action?.patch) {
        jsonResponse(res, 409, { ok: false, error: 'Auto tuning is not eligible.', decision })
        return
      }
      const before = getVoiceConfig()
      setVoiceConfig(decision.action.patch)
      const after = getVoiceConfig()
      setVoiceConfig({ wakeAutoTuningLastAppliedAt: Date.now() })
      const record = pushWakeTuningRecord({ reason: decision.action.reason, label: `[自动] ${decision.action.label}`, before, after, applied: decision.action.patch, windowMs, beforeMetrics: decision.summary.recent, auto: true })
      jsonResponse(res, 200, { ok: true, applied: decision.action.patch, record, voice: after, decision: evaluateWakeAutoTuning({ windowMs }), history: publicWakeTuningHistory() })
      return
    }

    // GET /voice/wake/tuning — suggested safe setting patches from recent wake rejection diagnostics
    if (req.method === 'GET' && url.pathname === '/voice/wake/tuning') {
      const windowMs = Number(url.searchParams.get('windowMs') || 60000)
      const summary = getVoiceEventLinkSummary({ windowMs })
      jsonResponse(res, 200, {
        ok: true,
        service: 'bailongma.voice.wake.tuning',
        current: getVoiceConfig(),
        summary,
        actions: [...buildWakeGuardTuningActions({ summary, current: getVoiceConfig() }), ...buildSpeakerTuningActions({ summary, current: getVoiceConfig() })],
        history: publicWakeTuningHistory(),
      })
      return
    }

    // POST /voice/wake/tuning/apply — apply one safe wake tuning patch
    if (req.method === 'POST' && url.pathname === '/voice/wake/tuning/apply') {
      const chunks = []
      req.on('data', chunk => chunks.push(chunk))
      req.on('end', () => {
        try {
          const body = JSON.parse(Buffer.concat(chunks).toString('utf-8') || '{}')
          const patch = body.patch && typeof body.patch === 'object' ? body.patch : {}
          const allowed = new Set(['wakeConfidenceThreshold', 'wakeMinCommandChars', 'wakeCooldownMs', 'wakeRequireSpeakerWhenEnabled', 'wakeMode', 'wakeRepeatSuppression', 'speakerThreshold'])
          const safePatch = Object.fromEntries(Object.entries(patch).filter(([key]) => allowed.has(key)))
          if (!Object.keys(safePatch).length) {
            jsonResponse(res, 400, { ok: false, error: 'No safe wake tuning fields provided.' })
            return
          }
          const before = getVoiceConfig()
          setVoiceConfig(safePatch)
          const after = getVoiceConfig()
          const record = pushWakeTuningRecord({ reason: body.reason || '', label: body.label || '', before, after, applied: safePatch, windowMs: Number(body.windowMs || 60000), beforeMetrics: getVoiceEventMetricsWindow({ since: Date.now() - Number(body.windowMs || 60000), until: Date.now() }) })
          jsonResponse(res, 200, { ok: true, applied: safePatch, voice: after, record, history: publicWakeTuningHistory() })
        } catch (err) {
          jsonResponse(res, 400, { ok: false, error: err.message })
        }
      })
      return
    }


    // GET /voice/wake/tuning/evaluate — compare before/after wake metrics for tuning records
    if (req.method === 'GET' && url.pathname === '/voice/wake/tuning/evaluate') {
      const id = url.searchParams.get('id') || ''
      const items = id ? wakeTuningHistory.filter(item => item.id === id) : wakeTuningHistory.filter(item => item.reason !== 'rollback').slice(-6)
      jsonResponse(res, 200, { ok: true, evaluations: items.map(item => ({ id: item.id, label: item.label, reason: item.reason, at: item.at, evaluation: enrichWakeTuningEvaluation(item) })) })
      return
    }

    // POST /voice/wake/tuning/clear — clear persisted tuning history without changing voice settings
    if (req.method === 'POST' && url.pathname === '/voice/wake/tuning/clear') {
      const cleared = clearWakeTuningHistory()
      jsonResponse(res, 200, { ok: true, cleared, history: publicWakeTuningHistory(), voice: getVoiceConfig() })
      return
    }

    // POST /voice/wake/tuning/rollback — rollback latest or selected wake tuning record
    if (req.method === 'POST' && url.pathname === '/voice/wake/tuning/rollback') {
      const chunks = []
      req.on('data', chunk => chunks.push(chunk))
      req.on('end', () => {
        try {
          const body = JSON.parse(Buffer.concat(chunks).toString('utf-8') || '{}')
          const target = body.id ? wakeTuningHistory.find(item => item.id === body.id) : wakeTuningHistory[wakeTuningHistory.length - 1]
          if (!target) {
            jsonResponse(res, 404, { ok: false, error: 'No wake tuning record to rollback.' })
            return
          }
          setVoiceConfig(target.before || {})
          const rolledBack = pushWakeTuningRecord({ reason: 'rollback', label: `回滚 ${target.label || target.id}`, before: target.after, after: getVoiceConfig(), applied: target.before || {}, rollbackOf: target.id })
          jsonResponse(res, 200, { ok: true, rolledBack: target.id, record: rolledBack, voice: getVoiceConfig(), history: publicWakeTuningHistory() })
        } catch (err) {
          jsonResponse(res, 400, { ok: false, error: err.message })
        }
      })
      return
    }

    // GET /voice/events/summary — consolidated voice link health and troubleshooting summary
    if (req.method === 'GET' && url.pathname === '/voice/events/summary') {
      const windowMs = Number(url.searchParams.get('windowMs') || 60000)
      jsonResponse(res, 200, {
        ok: true,
        service: 'bailongma.voice.events',
        version: getVoiceEventBusStatus().version,
        summary: getVoiceEventLinkSummary({ windowMs }),
      })
      return
    }



    // GET /voice/events/package — copyable device onboarding package for LAN/ESP32 bridges
    if (req.method === 'GET' && url.pathname === '/voice/events/package') {
      jsonResponse(res, 200, {
        ok: true,
        ...getVoiceEventsOnboardingPackage({
          host: url.hostname || req.headers.host?.split(':')[0] || '127.0.0.1',
          port: Number(req.headers.host?.split(':').pop() || 3721) || 3721,
          protocol: 'http:',
          tokenConfigured: Boolean(getAuthToken()),
          clientId: url.searchParams.get('clientId') || 'esp32-test',
          device: url.searchParams.get('device') || 'xiaozhi-esp32',
          platform: url.searchParams.get('platform') || 'esp32',
        }),
      })
      return
    }

    // GET /voice/events/check — one-click voice link self-check and device onboarding actions
    if (req.method === 'GET' && url.pathname === '/voice/events/check') {
      const windowMs = Number(url.searchParams.get('windowMs') || 60000)
      jsonResponse(res, 200, getVoiceEventLinkSelfCheck({
        windowMs,
        host: url.hostname || req.headers.host?.split(':')[0] || '127.0.0.1',
        port: Number(req.headers.host?.split(':').pop() || 3721) || 3721,
        protocol: 'http:',
        tokenConfigured: Boolean(getAuthToken()),
      }))
      return
    }

    // GET /voice/events/onboarding — device/client onboarding hints
    if (req.method === 'GET' && url.pathname === '/voice/events/onboarding') {
      jsonResponse(res, 200, {
        ok: true,
        ...getVoiceEventsOnboarding({
          host: url.hostname || req.headers.host?.split(':')[0] || '127.0.0.1',
          port: Number(req.headers.host?.split(':').pop() || 3721) || 3721,
          protocol: 'http:',
          tokenConfigured: Boolean(getAuthToken()),
        }),
      })
      return
    }

    // GET /voice/events/protocol — current voice event protocol metadata
    if (req.method === 'GET' && url.pathname === '/voice/events/protocol') {
      jsonResponse(res, 200, { ok: true, ...getVoiceEventsProtocolMetadata({ ttsSpeakLimits: getConfiguredVoiceEventsTTSSpeakLimits(), auth: getVoiceEventsAuthMetadata() }) })
      return
    }

    // POST /voice/events/publish — browser voice-event bridge to backend WebSocket clients
    if (req.method === 'POST' && url.pathname === '/voice/events/publish') {
      const chunks = []
      req.on('data', chunk => chunks.push(chunk))
      req.on('end', () => {
        try {
          const body = JSON.parse(Buffer.concat(chunks).toString('utf-8') || '{}')
          const result = publishVoiceEvent(body.event || body)
          jsonResponse(res, 200, { ok: true, ...result })
        } catch (err) {
          jsonResponse(res, 400, { ok: false, error: err.message })
        }
      })
      return
    }


    // GET /voice/local/doctor — local voice readiness and human troubleshooting checklist
    if (req.method === 'GET' && url.pathname === '/voice/local/doctor') {
      const windowMs = Math.max(10000, Math.min(10 * 60 * 1000, Number(url.searchParams.get('windowMs') || 60000) || 60000))
      jsonResponse(res, 200, buildVoiceLocalDoctor({ windowMs }))
      return
    }


    // POST /voice/local/doctor/fix — apply one safe local voice readiness fix
    if (req.method === 'POST' && url.pathname === '/voice/local/doctor/fix') {
      const chunks = []
      req.on('data', chunk => chunks.push(chunk))
      req.on('end', () => {
        try {
          const body = JSON.parse(Buffer.concat(chunks).toString('utf-8') || '{}')
          const result = applyVoiceLocalDoctorFix(body.action || body.id || '')
          jsonResponse(res, 200, { ok: true, ...result })
        } catch (err) {
          jsonResponse(res, err.statusCode || 400, { ok: false, error: err.message })
        }
      })
      return
    }

    // GET /voice/local/status — local ASR server status
    if (req.method === 'GET' && url.pathname === '/voice/local/status') {
      jsonResponse(res, 200, { ok: true, ...getVoiceStatus() })
      return
    }

    // POST /voice/local/start — start local ASR server on ws://127.0.0.1:3723
    if (req.method === 'POST' && url.pathname === '/voice/local/start') {
      const chunks = []
      req.on('data', chunk => chunks.push(chunk))
      req.on('end', () => {
        try {
          const body = JSON.parse(Buffer.concat(chunks).toString('utf-8') || '{}')
          const model = String(body.localAsrModel || body.model || body.whisperModel || 'sensevoice-small').trim() || 'sensevoice-small'
          const profile = String(body.asrProfile || body.profile || 'balanced').trim() || 'balanced'
          const status = startVoiceServer({ model, localAsrModel: model, profile })
          jsonResponse(res, 200, { ok: true, ...status })
        } catch (err) {
          jsonResponse(res, 400, { ok: false, error: err.message })
        }
      })
      return
    }

    // POST /voice/local/restart — restart local ASR with a selected model
    if (req.method === 'POST' && url.pathname === '/voice/local/restart') {
      const chunks = []
      req.on('data', chunk => chunks.push(chunk))
      req.on('end', () => {
        try {
          const body = JSON.parse(Buffer.concat(chunks).toString('utf-8') || '{}')
          const model = String(body.localAsrModel || body.model || body.whisperModel || 'sensevoice-small').trim() || 'sensevoice-small'
          const profile = String(body.asrProfile || body.profile || 'balanced').trim() || 'balanced'
          const status = restartVoiceServer(model, profile)
          jsonResponse(res, 200, { ok: true, ...status })
        } catch (err) {
          jsonResponse(res, 400, { ok: false, error: err.message })
        }
      })
      return
    }

    // POST /voice/local/stop — stop local ASR server
    if (req.method === 'POST' && url.pathname === '/voice/local/stop') {
      jsonResponse(res, 200, { ok: true, ...stopVoiceServer() })
      return
    }

    // GET /settings/tts — read TTS configuration status (plaintext keys not returned)
    if (req.method === 'GET' && url.pathname === '/settings/tts') {
      jsonResponse(res, 200, { ok: true, tts: getTTSConfig(), providers: TTS_PROVIDERS, voices: TTS_VOICES })
      return
    }

    // POST /settings/tts — save TTS configuration
    if (req.method === 'POST' && url.pathname === '/settings/tts') {
      const chunks = []
      req.on('data', chunk => chunks.push(chunk))
      req.on('end', () => {
        try {
          const body = JSON.parse(Buffer.concat(chunks).toString('utf-8') || '{}')
          setTTSConfig(body)
          jsonResponse(res, 200, { ok: true, tts: getTTSConfig() })
        } catch (err) {
          jsonResponse(res, 400, { ok: false, error: err.message })
        }
      })
      return
    }

    // GET /settings/web-search — read web search configuration (plaintext keys not returned)
    if (req.method === 'GET' && url.pathname === '/settings/web-search') {
      jsonResponse(res, 200, { ok: true, webSearch: getWebSearchConfig() })
      return
    }

    // POST /settings/web-search — save web search configuration
    if (req.method === 'POST' && url.pathname === '/settings/web-search') {
      const chunks = []
      req.on('data', chunk => chunks.push(chunk))
      req.on('end', () => {
        try {
          const body = JSON.parse(Buffer.concat(chunks).toString('utf-8') || '{}')
          setWebSearchConfig(body)
          jsonResponse(res, 200, { ok: true, webSearch: getWebSearchConfig() })
        } catch (err) {
          jsonResponse(res, 400, { ok: false, error: err.message })
        }
      })
      return
    }

    // GET /settings/embedding — read embedding configuration status (plaintext apiKey not returned)
    if (req.method === 'GET' && url.pathname === '/settings/embedding') {
      jsonResponse(res, 200, {
        ok: true,
        embedding: getEmbeddingConfig(),
        presets: EMBEDDING_PROVIDER_PRESETS,
      })
      return
    }

    // POST /settings/embedding — save embedding configuration
    if (req.method === 'POST' && url.pathname === '/settings/embedding') {
      const chunks = []
      for await (const chunk of req) chunks.push(chunk)
      try {
        const body = JSON.parse(Buffer.concat(chunks).toString('utf-8') || '{}')
        setEmbeddingConfig(body)
        // 写入配置后清掉 embedding 模块的 LRU 缓存（key 是 sha256(text+model)，model 变了旧缓存无效）
        try {
          const { clearEmbeddingCache } = await import('./embedding.js')
          clearEmbeddingCache()
        } catch {}
        jsonResponse(res, 200, { ok: true, embedding: getEmbeddingConfig() })
      } catch (err) {
        jsonResponse(res, 400, { ok: false, error: err.message })
      }
      return
    }

    // POST /settings/embedding/test — connectivity probe: compute one embedding to verify provider/key
    if (req.method === 'POST' && url.pathname === '/settings/embedding/test') {
      try {
        const { computeEmbedding, isEmbeddingConfigured } = await import('./embedding.js')
        if (!isEmbeddingConfigured()) {
          jsonResponse(res, 200, { ok: false, error: 'embedding not configured — save provider/model/apiKey first' })
          return
        }
        const t0 = Date.now()
        const buf = await computeEmbedding('embedding connectivity test')
        if (!buf) {
          jsonResponse(res, 200, { ok: false, error: 'computeEmbedding returned null — check apiKey / baseURL / model name; see server log if any' })
          return
        }
        const elapsed = Date.now() - t0
        const dims = buf.byteLength / 4 // Float32 = 4 bytes
        jsonResponse(res, 200, { ok: true, dims, elapsedMs: elapsed })
      } catch (err) {
        jsonResponse(res, 500, { ok: false, error: err.message })
      }
      return
    }

    // GET /memory/embedding-backfill — current backfill status
    if (req.method === 'GET' && url.pathname === '/memory/embedding-backfill') {
      try {
        const { getBackfillStatus } = await import('./memory/embedding-backfill.js')
        jsonResponse(res, 200, { ok: true, status: getBackfillStatus() })
      } catch (err) {
        jsonResponse(res, 500, { ok: false, error: err.message })
      }
      return
    }

    // POST /memory/embedding-backfill — fire-and-forget trigger backfill
    if (req.method === 'POST' && url.pathname === '/memory/embedding-backfill') {
      try {
        const { runBackfill, getBackfillStatus } = await import('./memory/embedding-backfill.js')
        const { isEmbeddingConfigured } = await import('./embedding.js')
        if (!isEmbeddingConfigured()) {
          jsonResponse(res, 200, { ok: false, error: 'embedding not configured' })
          return
        }
        const beforeStatus = getBackfillStatus()
        if (beforeStatus.running) {
          jsonResponse(res, 200, { ok: true, started: false, reason: 'already running', status: beforeStatus })
          return
        }
        // fire-and-forget：不 await，立即响应
        runBackfill({ batchSize: 20, throttleMs: 200 }).catch(() => {})
        jsonResponse(res, 200, { ok: true, started: true, status: getBackfillStatus() })
      } catch (err) {
        jsonResponse(res, 500, { ok: false, error: err.message })
      }
      return
    }

    // DELETE /memory/embedding-backfill — request cancel of running backfill
    if (req.method === 'DELETE' && url.pathname === '/memory/embedding-backfill') {
      try {
        const { cancelBackfill } = await import('./memory/embedding-backfill.js')
        cancelBackfill()
        jsonResponse(res, 200, { ok: true, cancelled: true })
      } catch (err) {
        jsonResponse(res, 500, { ok: false, error: err.message })
      }
      return
    }


    // POST /tts/session — create sentence-level TTS session
    if (req.method === 'POST' && url.pathname === '/tts/session') {
      const chunks = []
      req.on('data', chunk => chunks.push(chunk))
      req.on('end', () => {
        try {
          const body = JSON.parse(Buffer.concat(chunks).toString('utf-8') || '{}')
          const text = String(body.text || '').trim()
          if (!text) { jsonResponse(res, 400, { ok: false, error: 'Missing text parameter' }); return }
          const creds = getTTSCredentials()
          const session = createTTSSession({
            text,
            provider: creds.provider,
            voiceId: body.voiceId || creds.voiceId || undefined,
            keys: {
              doubaoKey: creds.doubaoKey, doubaoAppId: creds.doubaoAppId, doubaoAccessKey: creds.doubaoAccessKey, doubaoResourceId: creds.doubaoResourceId,
              minimaxKey: creds.minimaxKey, openaiKey: creds.openaiKey, openaiBaseURL: creds.openaiBaseURL,
              elevenLabsKey: creds.elevenLabsKey, volcanoAppId: creds.volcanoAppId, volcanoToken: creds.volcanoToken,
            },
          })
          jsonResponse(res, 200, { ok: true, sessionId: session.id, segments: session.segments })
        } catch (err) {
          jsonResponse(res, 500, { ok: false, error: err.message })
        }
      })
      return
    }

    // POST /tts/session/:id/cancel — cancel a sentence-level TTS session
    if (req.method === 'POST' && /^\/tts\/session\/[^/]+\/cancel$/.test(url.pathname)) {
      const sessionId = decodeURIComponent(url.pathname.split('/')[3] || '')
      jsonResponse(res, 200, { ok: true, cancelled: cancelTTSSession(sessionId) })
      return
    }

    // GET /tts/session/:id/audio/:index — stream one TTS segment
    if (req.method === 'GET' && /^\/tts\/session\/[^/]+\/audio\/\d+$/.test(url.pathname)) {
      try {
        const parts = url.pathname.split('/')
        const sessionId = decodeURIComponent(parts[3] || '')
        const index = Number(parts[5] || 0)
        const contentType = 'audio/mpeg'
        const audioStream = await streamTTSSegment({ sessionId, index })
        res.writeHead(200, {
          'Content-Type': contentType,
          'Transfer-Encoding': 'chunked',
          'Cache-Control': 'no-cache',
          'Access-Control-Allow-Origin': '*',
        })
        publishTTSAudioStart({ sessionId, index, contentType })
        audioStream.on('data', chunk => {
          publishTTSAudioChunk({ sessionId, index, chunk, contentType })
          res.write(chunk)
        })
        audioStream.on('end', () => {
          publishTTSAudioEnd({ sessionId, index })
          res.end()
        })
        audioStream.on('error', err => {
          console.warn('[TTS] Segment stream error:', err.message)
          publishTTSAudioError({ sessionId, index, error: err.message })
          try { res.end() } catch {}
        })
      } catch (err) {
        if (!res.headersSent) jsonResponse(res, 500, { ok: false, error: err.message })
        else try { res.end() } catch {}
      }
      return
    }

    // POST /tts/stream — streaming TTS synthesis, returns audio/mpeg stream
    if (req.method === 'POST' && url.pathname === '/tts/stream') {
      const chunks = []
      req.on('data', chunk => chunks.push(chunk))
      req.on('end', async () => {
        try {
          const body = JSON.parse(Buffer.concat(chunks).toString('utf-8') || '{}')
          const { text } = body
          if (!text?.trim()) { jsonResponse(res, 400, { ok: false, error: 'Missing text parameter' }); return }
          const creds = getTTSCredentials()
          const audioStream = await streamTTS({
            text: text.slice(0, 800),
            provider: creds.provider,
            voiceId:  body.voiceId || creds.voiceId || undefined,
            keys: {
              doubaoKey:     creds.doubaoKey,
              doubaoAppId:   creds.doubaoAppId,
              doubaoAccessKey: creds.doubaoAccessKey,
              doubaoResourceId: creds.doubaoResourceId,
              minimaxKey:    creds.minimaxKey,
              openaiKey:     creds.openaiKey,
              openaiBaseURL: creds.openaiBaseURL,
              elevenLabsKey: creds.elevenLabsKey,
              volcanoAppId:  creds.volcanoAppId,
              volcanoToken:  creds.volcanoToken,
            },
          })
          let headersWritten = false
          let responseDone = false
          let streamError = null
          const finishRes = () => { if (!responseDone) { responseDone = true; res.end() } }
          const errorRes = (msg) => { if (!responseDone) { responseDone = true; jsonResponse(res, 500, { ok: false, error: msg }) } }
          audioStream.on('data', (chunk) => {
            if (!headersWritten) {
              headersWritten = true
              res.writeHead(200, {
                'Content-Type': 'audio/mpeg',
                'Transfer-Encoding': 'chunked',
                'Cache-Control': 'no-cache',
                'Access-Control-Allow-Origin': '*',
              })
            }
            res.write(chunk)
          })
          audioStream.on('end', () => {
            if (!headersWritten) {
              const errMsg = streamError?.message || 'TTS synthesis failed: API returned no audio — check whether the voice ID is enabled on your account'
              console.warn('[TTS] Empty stream:', errMsg)
              errorRes(errMsg)
            } else {
              finishRes()
            }
          })
          audioStream.on('error', (err) => {
            console.warn('[TTS] Audio stream error:', err.message)
            streamError = err
            if (!headersWritten) {
              errorRes(err.message)
            } else {
              finishRes()
            }
          })
        } catch (err) {
          console.warn('[TTS] Streaming synthesis failed:', err.message)
          if (!res.headersSent) jsonResponse(res, 500, { ok: false, error: err.message })
          else try { res.end() } catch {}
        }
      })
      return
    }

    // POST /tts/interrupted — TTS interrupted by user; trim the last jarvis message to the spoken portion
    if (req.method === 'POST' && url.pathname === '/tts/interrupted') {
      const chunks = []
      req.on('data', chunk => chunks.push(chunk))
      req.on('end', () => {
        try {
          const body = JSON.parse(Buffer.concat(chunks).toString('utf-8') || '{}')
          const { spokenContent } = body
          if (typeof spokenContent !== 'string') { jsonResponse(res, 400, { error: 'spokenContent required' }); return }
          const updated = updateLastJarvisConversationContent(spokenContent)
          emitEvent('tts_interrupted', { spokenContent })
          jsonResponse(res, 200, { ok: true, updated })
        } catch (e) {
          jsonResponse(res, 500, { error: e.message })
        }
      })
      return
    }

    jsonResponse(res, 404, { error: 'not found' })
  })

  // Cloud ASR WebSocket channel: frontend PCM → backend proxy → cloud ASR
  const cloudWss = new WebSocketServer({ noServer: true })
  cloudWss.on('connection', (ws) => {
    let session = null
    let configured = false

    ws.on('message', (raw) => {
      // First frame must be a JSON config frame
      if (!configured) {
        try {
          const msg = JSON.parse(raw.toString())
          if (msg.type !== 'config') return
          // Read raw credentials from config.json
          let rawCfg = {}
          try { rawCfg = JSON.parse(fs.readFileSync(paths.configFile, 'utf-8'))?.voice || {} } catch {}
          session = createCloudASRSession(
            { provider: msg.provider || 'aliyun', lang: msg.lang || 'zh', ...rawCfg },
            (text, isFinal) => {
              try { ws.send(JSON.stringify({ type: 'transcript', text, is_final: isFinal })) } catch {}
            },
            (errMsg) => {
              try { ws.send(JSON.stringify({ type: 'error', message: errMsg })) } catch {}
            },
            () => { try { ws.close() } catch {} }
          )
          configured = true
        } catch {}
        return
      }
      // Subsequent frames are PCM binary
      if (raw instanceof Buffer) {
        session?.sendAudio(raw)
      } else {
        try {
          const msg = JSON.parse(raw.toString())
          if (msg.type === 'flush') session?.flush()
        } catch {}
      }
    })

    ws.on('close', () => { session?.close(); session = null })
    ws.on('error', () => { session?.close(); session = null })
  })

  const voiceEventsRemoteSpeakAt = new Map()

  function pruneVoiceEventsRemoteSpeakAt(now = Date.now()) {
    const ttl = Math.max(60000, getConfiguredVoiceEventsTTSSpeakLimits().cooldownMs * 10)
    for (const [key, at] of voiceEventsRemoteSpeakAt.entries()) {
      if (now - Number(at || 0) > ttl) voiceEventsRemoteSpeakAt.delete(key)
    }
  }

  function getVoiceEventRemoteKey(req) {
    return normalizeRemoteAddress(req?.socket?.remoteAddress || 'unknown') || 'unknown'
  }

  function getConfiguredVoiceEventsTTSSpeakLimits() {
    const ttsConfig = getTTSConfig()
    return normalizeVoiceEventsTTSSpeakLimits({
      maxTextChars: ttsConfig.voiceEventsTtsSpeakMaxTextChars,
      cooldownMs: ttsConfig.voiceEventsTtsSpeakCooldownMs,
    })
  }

  async function streamTTSSegmentToVoiceClient(ws, { sessionId, index, requestId, contentType = 'audio/mpeg' }) {
    publishTTSAudioStart({ sessionId, index, contentType, targetClient: ws })
    try {
      const audioStream = await streamTTSSegment({ sessionId, index })
      await new Promise((resolve, reject) => {
        const finishIfCancelled = () => {
          const current = getTTSSession(sessionId)
          if (!current || current.status === 'cancelled' || ws.activeTTSSpeak?.requestId !== requestId || ws.readyState !== 1) {
            try { audioStream.destroy?.() } catch {}
            resolve()
            return true
          }
          return false
        }
        audioStream.on('data', chunk => {
          if (finishIfCancelled()) return
          publishTTSAudioChunk({ sessionId, index, chunk, contentType, targetClient: ws })
        })
        audioStream.on('end', resolve)
        audioStream.on('error', reject)
      })
      publishTTSAudioEnd({ sessionId, index, targetClient: ws })
    } catch (err) {
      publishTTSAudioError({ sessionId, index, error: err.message, targetClient: ws })
      throw err
    }
  }

  function cancelVoiceEventTTSSpeak(ws, reason = 'cancelled', requestId = null) {
    const active = ws.activeTTSSpeak
    if (!active) {
      sendVoiceEventClientJson(ws, { type: 'tts', state: 'cancelled', requestId, cancelled: false, reason: 'no_active_session' })
      return false
    }
    cancelTTSSession(active.sessionId)
    ws.activeTTSSpeak = null
    sendVoiceEventToClient(ws, { type: 'tts:stop', detail: { requestId: active.requestId, sessionId: active.sessionId, reason } })
    sendVoiceEventClientJson(ws, { type: 'tts', state: 'cancelled', requestId: active.requestId, sessionId: active.sessionId, cancelled: true, reason })
    return true
  }

  async function handleVoiceEventTTSSpeak(ws, msg = {}) {
    const text = String(msg.text || msg.ttsText || '').trim()
    const requestId = String(msg.requestId || msg.id || `tts_req_${Date.now()}`)
    if (!text) {
      sendVoiceEventClientJson(ws, { type: 'tts', state: 'error', requestId, error: 'Missing text' })
      return
    }
    cancelVoiceEventTTSSpeak(ws, 'replaced_by_new_speak', requestId)
    const previousOptions = getVoiceEventClientOptions(ws)
    setVoiceEventClientOptions(ws, {
      audio: true,
      binaryAudio: msg.binaryAudio === true || msg.binary === true,
    })
    const creds = getTTSCredentials()
    const session = createTTSSession({
      text,
      provider: creds.provider,
      voiceId: msg.voiceId || creds.voiceId || undefined,
      keys: {
        doubaoKey: creds.doubaoKey, doubaoAppId: creds.doubaoAppId, doubaoAccessKey: creds.doubaoAccessKey, doubaoResourceId: creds.doubaoResourceId,
        minimaxKey: creds.minimaxKey, openaiKey: creds.openaiKey, openaiBaseURL: creds.openaiBaseURL,
        elevenLabsKey: creds.elevenLabsKey, volcanoAppId: creds.volcanoAppId, volcanoToken: creds.volcanoToken,
      },
    })
    ws.activeTTSSpeak = { requestId, sessionId: session.id }
    sendVoiceEventClientJson(ws, { type: 'tts', state: 'session', requestId, sessionId: session.id, segments: session.segments })
    sendVoiceEventToClient(ws, { type: 'tts:start', detail: { requestId, sessionId: session.id, segmentCount: session.segments.length } })
    const contentType = 'audio/mpeg'
    try {
      for (let index = 0; index < session.segments.length; index += 1) {
        if (ws.readyState !== 1 || ws.activeTTSSpeak?.requestId !== requestId) break
        const current = getTTSSession(session.id)
        if (!current || current.status === 'cancelled') break
        const segmentText = session.segments[index]
        sendVoiceEventToClient(ws, { type: 'tts:sentence_start', detail: { requestId, sessionId: session.id, index, text: segmentText } })
        sendVoiceEventToClient(ws, { type: 'tts:audio_ready', detail: { requestId, sessionId: session.id, index, text: segmentText, contentType } })
        await streamTTSSegmentToVoiceClient(ws, { sessionId: session.id, index, requestId, contentType })
        sendVoiceEventToClient(ws, { type: 'tts:sentence_end', detail: { requestId, sessionId: session.id, index, text: segmentText } })
      }
      const finalSession = getTTSSession(session.id)
      const stopReason = finalSession?.status === 'cancelled' ? 'cancelled' : 'completed'
      if (ws.activeTTSSpeak?.requestId === requestId) sendVoiceEventToClient(ws, { type: 'tts:stop', detail: { requestId, sessionId: session.id, reason: stopReason } })
    } catch (err) {
      sendVoiceEventToClient(ws, { type: 'error', detail: { requestId, sessionId: session.id, service: 'tts', error: err.message } })
      sendVoiceEventClientJson(ws, { type: 'tts', state: 'error', requestId, sessionId: session.id, error: err.message })
    } finally {
      if (ws.activeTTSSpeak?.requestId === requestId) ws.activeTTSSpeak = null
      setVoiceEventClientOptions(ws, previousOptions)
    }
  }

  // Experimental voice event WebSocket channel: JSON lifecycle events and opt-in TTS audio for external clients
  const voiceEventWss = new WebSocketServer({ noServer: true })
  voiceEventWss.on('connection', (ws, req) => {
    ws.voiceEventRemoteKey = getVoiceEventRemoteKey(req)
    addVoiceEventClient(ws, { ttsSpeakLimits: getConfiguredVoiceEventsTTSSpeakLimits(), auth: getVoiceEventsAuthMetadata() })
    const cleanupVoiceClient = () => {
      cancelVoiceEventTTSSpeak(ws, 'client_disconnected')
      removeVoiceEventClient(ws)
    }
    ws.on('close', cleanupVoiceClient)
    ws.on('error', cleanupVoiceClient)
    ws.on('message', (raw) => {
      let msg
      try {
        msg = JSON.parse(raw.toString())
      } catch {
        sendVoiceEventProtocolError(ws, 'invalid_json', 'Client message must be valid JSON.')
        return
      }
      const activeTTSSpeakLimits = getConfiguredVoiceEventsTTSSpeakLimits()
      const validation = validateVoiceEventClientMessage(msg, { limits: activeTTSSpeakLimits })
      if (!validation.ok) {
        sendVoiceEventProtocolError(ws, validation.code, validation.message, { requestId: validation.requestId, receivedType: validation.receivedType, limit: validation.limit, actual: validation.actual })
        return
      }
      if (msg?.type === 'client:hello' || msg?.type === 'client:identify') {
        handleVoiceEventClientMessage(ws, msg)
        return
      }
      if (msg?.type === 'tts:speak' || msg?.type === 'speak') {
        const now = Date.now()
        pruneVoiceEventsRemoteSpeakAt(now)
        const lastAt = Number(ws.lastTTSSpeakAt || 0)
        const retryAfterMs = Math.max(0, activeTTSSpeakLimits.cooldownMs - (now - lastAt))
        if (retryAfterMs > 0) {
          sendVoiceEventProtocolError(ws, 'rate_limited', `tts:speak is limited to one request every ${activeTTSSpeakLimits.cooldownMs} ms.`, {
            requestId: msg.requestId || msg.id || undefined,
            receivedType: msg.type,
            limitMs: activeTTSSpeakLimits.cooldownMs,
            retryAfterMs,
            scope: 'connection',
          })
          return
        }
        const remoteKey = ws.voiceEventRemoteKey || 'unknown'
        const remoteLastAt = Number(voiceEventsRemoteSpeakAt.get(remoteKey) || 0)
        const remoteRetryAfterMs = Math.max(0, activeTTSSpeakLimits.cooldownMs - (now - remoteLastAt))
        if (remoteRetryAfterMs > 0) {
          sendVoiceEventProtocolError(ws, 'rate_limited', `tts:speak is limited per remote address to one request every ${activeTTSSpeakLimits.cooldownMs} ms.`, {
            requestId: msg.requestId || msg.id || undefined,
            receivedType: msg.type,
            limitMs: activeTTSSpeakLimits.cooldownMs,
            retryAfterMs: remoteRetryAfterMs,
            scope: 'remote',
          })
          return
        }
        ws.lastTTSSpeakAt = now
        voiceEventsRemoteSpeakAt.set(remoteKey, now)
        handleVoiceEventTTSSpeak(ws, msg).catch(err => sendVoiceEventClientJson(ws, { type: 'tts', state: 'error', error: err.message }))
        return
      }
      if (msg?.type === 'tts:cancel' || msg?.type === 'cancel') {
        cancelVoiceEventTTSSpeak(ws, msg.reason || 'client_cancelled', msg.requestId || msg.id || null)
        return
      }
      handleVoiceEventClientMessage(ws, msg)
    })
  })

  // ACUI WebSocket channel: bidirectional control + perception
  const acuiWss = new WebSocketServer({ noServer: true })
  acuiWss.on('connection', (ws) => {
    addACUIClient(ws)
    try { ws.send(JSON.stringify({ v: 1, kind: 'acui:hello' })) } catch {}

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString())
        if (msg?.kind === 'ui.signal') {
          const id = insertUISignal({
            type: msg.type,
            target: msg.target || null,
            payload: msg.payload || {},
            ts: msg.ts || Date.now(),
          })
          emitEvent('ui_signal', { id, type: msg.type, target: msg.target, payload: msg.payload })
          // card.dismissed: remove from server-side active card table
          if (msg.type === 'card.dismissed') {
            removeActiveUICard(msg.target)
          }
          // Only push to the agent queue on explicit user interaction (card.action).
          // Lifecycle signals like card.dismissed are already persisted by insertUISignal for passive injector use.
          if (msg.type === 'card.action') {
            const appId = msg.target || 'ui'
            const action = msg.payload?.action || 'unknown'
            const payload = msg.payload?.payload || msg.payload || {}
            if (action === 'app:saveState') {
              // Auto-reported state snapshot from the component: persist directly, do not trigger agent
              persistAppState(appId, payload)
            } else if (action === 'confirm_security_change') {
              // User confirmed a security settings change: apply directly, do not push to agent queue
              const updates = {}
              if (payload.file_sandbox !== undefined) updates.fileSandbox = String(payload.file_sandbox) === 'true'
              if (payload.exec_sandbox !== undefined) updates.execSandbox = String(payload.exec_sandbox) === 'true'
              if (Object.keys(updates).length > 0) setSecurity(updates)
              emitUICommand({ op: 'unmount', id: appId })
              removeActiveUICard(appId)
              const desc = Object.entries(updates).map(([k, v]) => `${k}=${v}`).join(', ')
              pushMessage('SYSTEM', `[security settings updated] User confirmed changes: ${desc}`, 'APP_SIGNAL')
            } else if (action === 'cancel_security_change') {
              // User cancelled — close the card, do not apply changes
              emitUICommand({ op: 'unmount', id: appId })
              removeActiveUICard(appId)
              pushMessage('SYSTEM', '[security settings change] User cancelled — settings unchanged', 'APP_SIGNAL')
            } else if (action.startsWith('app:') || SILENT_CARD_ACTIONS.has(action)) {
              // app: prefix = system-internal signal; SILENT_CARD_ACTIONS = lifecycle signals.
              // Both are already written to DB by insertUISignal; injector picks them up passively on the next tick.
            } else {
              const signalContent = `[App signal app=${appId} action=${action}]\n${JSON.stringify(payload, null, 2)}`
              pushMessage(`APP:${appId}`, signalContent, 'APP_SIGNAL')
            }
          }
        } else if (msg?.kind === 'pong') {
          // ignore
        }
      } catch (e) {
        // Reject non-JSON frames
      }
    })

    ws.on('close', () => removeACUIClient(ws))
    ws.on('error', () => removeACUIClient(ws))
  })

  server.on('upgrade', (req, socket, head) => {
    const url = new URL(req.url, `http://localhost:${port}`)
    if (url.pathname === '/acui') {
      const origin = req.headers.origin
      if (origin && !isAllowedOrigin(origin)) {
        socket.write('HTTP/1.1 403 Forbidden\r\n\r\n')
        socket.destroy()
        return
      }
      if (!hasAllowedAccess(req, url)) {
        socket.write('HTTP/1.1 403 Forbidden\r\n\r\n')
        socket.destroy()
        return
      }
      acuiWss.handleUpgrade(req, socket, head, (ws) => acuiWss.emit('connection', ws, req))
    } else if (url.pathname === '/voice/events') {
      const origin = req.headers.origin
      if (origin && !isAllowedOrigin(origin)) {
        socket.write('HTTP/1.1 403 Forbidden\r\n\r\n')
        socket.destroy()
        return
      }
      if (!hasAllowedAccess(req, url)) {
        socket.write('HTTP/1.1 403 Forbidden\r\n\r\n')
        socket.destroy()
        return
      }
      voiceEventWss.handleUpgrade(req, socket, head, (ws) => voiceEventWss.emit('connection', ws, req))
    } else if (url.pathname === '/voice/cloud') {
      cloudWss.handleUpgrade(req, socket, head, (ws) => cloudWss.emit('connection', ws, req))
    } else {
      socket.destroy()
    }
  })

  // Heartbeat: send ping to all ACUI clients every 30s
  const acuiHeartbeat = setInterval(() => {
    for (const client of acuiWss.clients) {
      try { client.send(JSON.stringify({ v: 1, kind: 'ping' })) } catch {}
    }
  }, 30000)
  acuiHeartbeat.unref?.()

  server.listen(port, host, () => {
    console.log(`[API] Listening at http://${host}:${port}`)
    console.log(`[API]   POST /message  — send message to agent`)
    console.log(`[API]   GET  /events   — SSE real-time stream (receive agent messages)`)
    console.log(`[API]   GET  /memories — query memories`)
    console.log(`[API]   GET  /status   — status`)
    console.log(`[API]   WS   /acui     — ACUI bidirectional channel (control + perception)`)
  })

  return server
}
