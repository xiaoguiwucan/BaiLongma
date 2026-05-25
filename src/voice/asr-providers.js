export const ASR_PROFILES = Object.freeze({
  speed: {
    id: 'speed',
    label: '极速',
    description: '优先低延迟；适合短指令和配置较低的 Mac。',
    recommendedLocalModel: 'sensevoice-small',
  },
  balanced: {
    id: 'balanced',
    label: '平衡',
    description: '速度和准确率平衡；白龙马默认。',
    recommendedLocalModel: 'sensevoice-small',
  },
  accuracy: {
    id: 'accuracy',
    label: '高精度',
    description: '优先准确率；可搭配 Whisper medium/turbo 备用。',
    recommendedLocalModel: 'medium',
  },
})

export const LOCAL_ASR_PROVIDERS = Object.freeze({
  sensevoice: {
    id: 'sensevoice',
    label: 'SenseVoiceSmall',
    languagePriority: '中文优先',
    locality: 'local',
    models: ['sensevoice-small'],
    defaultModel: 'sensevoice-small',
    profiles: ['speed', 'balanced'],
  },
  whisper: {
    id: 'whisper',
    label: 'Whisper',
    languagePriority: '多语言',
    locality: 'local',
    models: ['tiny', 'tiny.en', 'base', 'base.en', 'small', 'small.en', 'medium', 'medium.en', 'large', 'large-v2', 'large-v3', 'turbo'],
    defaultModel: 'small',
    profiles: ['balanced', 'accuracy'],
  },
})

export const CLOUD_ASR_PROVIDERS = Object.freeze({
  aliyun: { id: 'aliyun', label: '阿里云百炼', locality: 'cloud' },
  tencent: { id: 'tencent', label: '腾讯云 ASR', locality: 'cloud' },
  xunfei: { id: 'xunfei', label: '科大讯飞 RTASR', locality: 'cloud' },
})

export function normalizeAsrProfile(profile = 'balanced') {
  const value = String(profile || '').trim().toLowerCase()
  return ASR_PROFILES[value] ? value : 'balanced'
}

export function getAsrProviderSummaries() {
  return {
    profiles: Object.values(ASR_PROFILES),
    local: Object.values(LOCAL_ASR_PROVIDERS),
    cloud: Object.values(CLOUD_ASR_PROVIDERS),
  }
}
