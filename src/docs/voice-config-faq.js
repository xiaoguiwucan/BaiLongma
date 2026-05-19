// 语音配置说明文档 & FAQ
// 结构：每个 topic 包含 title、sections（标题+内容）、providers（服务商列表）
// 字段名来源：src/config.js 的语音/TTS 配置

export const DOC_TOPICS = {
  voice_asr: {
    id: 'voice_asr',
    title: '语音识别（ASR）配置指南',
    subtitle: 'Automatic Speech Recognition',
    icon: '🎤',
    summary: '语音识别将麦克风输入实时转为文字。当前使用 macOS 本地 Speech Recognition，不需要云端 ASR 密钥。',
    sections: [
      {
        title: '为什么语音识别没有内容？',
        content: `常见原因：
① 麦克风权限未授予 — 请在系统设置 → 隐私与安全性 → 麦克风中允许 Bailongma
② 语音识别权限未授予 — 请在系统设置 → 隐私与安全性 → 语音识别中允许 Bailongma 或本地识别模块
③ 当前语言与系统本地识别包不匹配 — 先使用中文（普通话）或 English (US)
④ macOS 本地识别暂不可用 — 重新打开应用后再试一次`,
      },
      {
        title: '当前模式：macOS 本地识别',
        content: `Bailongma 使用 macOS Speech.framework 做本机语音识别。

特点：
■ 不需要配置阿里云、腾讯云、讯飞等 ASR Key
■ 语音识别音频不走云端 ASR 服务商
■ 依赖 macOS 系统麦克风权限和语音识别权限

配置入口：
点击左上角 ⚙ → 语音设置，只需要选择语言、自动发送和灵敏度。`,
      },
    ],
    providers: [
      { name: 'macOS Speech Recognition', url: '', free: true, note: '本机识别，无需 ASR Key' },
    ],
  },

  voice_tts: {
    id: 'voice_tts',
    title: '语音合成（TTS）配置指南',
    subtitle: 'Text-to-Speech',
    icon: '🔊',
    summary: '语音合成将文字转为 Agent 语音输出。支持豆包、MiniMax、OpenAI、ElevenLabs、火山引擎。配置入口：点击左上角 ⚙ → 语音设置 → TTS。',
    sections: [
      {
        title: '为什么 Agent 说话没有声音？',
        content: `常见原因：
① 未配置 TTS 密钥 — 需在语音设置中填写对应服务商的 API Key
② 密钥失效或账户欠费 — 检查服务商控制台余额和密钥状态
③ 网络问题 — TTS 请求需要访问外网
④ 未选择 TTS 服务商 — 请在语音设置的「TTS 服务商」下拉框中选择一个`,
      },
      {
        title: '豆包（火山方舟）TTS — 推荐',
        content: `字节跳动旗下 TTS，中文音色丰富，流式输出，延迟低。

配置字段（POST /settings/tts）：
■ ttsProvider = "doubao"
■ doubaoKey — 火山方舟 API Key（推荐，格式：xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx）
■ doubaoAccessKey — 火山引擎平台 Access Key（与 doubaoKey 二选一）
■ doubaoAppId — 应用 App ID（可选）
■ doubaoResourceId — 语音资源 ID（可选，留空自动根据音色判断）
■ ttsVoiceId — 音色 ID（可选，默认：zh_female_xiaohe_uranus_bigtts）

常用音色：
→ zh_female_xiaohe_uranus_bigtts（小何 2.0，女声，通用）
→ zh_male_m191_uranus_bigtts（云舟 2.0，男声，通用）
→ zh_female_shuangkuaisisi_uranus_bigtts（爽快思思 2.0，活泼）

申请步骤：
1. 打开 https://console.volcengine.com/ark 注册/登录火山引擎
2. 进入「火山方舟」→「在线推理」，开通语音合成服务
3. 在「API Key 管理」创建 API Key，填写到 doubaoKey

文档：https://www.volcengine.com/docs/6561/1598757`,
      },
      {
        title: 'MiniMax TTS',
        content: `MiniMax 高质量中文 TTS，音色自然，表现力强。

配置方式：
■ MiniMax TTS 使用与 LLM 相同的 API Key
■ 如果当前 LLM 服务商已设置为 MiniMax，TTS 自动使用该密钥，无需额外配置
■ 也可设置环境变量 MINIMAX_API_KEY

在语音设置中：
1. 将「TTS 服务商」选择为「MiniMax」
2. 确保 LLM 已配置 MiniMax 密钥，或设置 MINIMAX_API_KEY 环境变量

常用音色：
→ male-qn-qingse（青涩男声）
→ female-shaonv（少女）
→ presenter_female（女主播）

申请地址：https://platform.minimaxi.com/`,
      },
      {
        title: 'OpenAI TTS',
        content: `OpenAI TTS，英文效果顶级，中文也支持。

配置字段（POST /settings/tts）：
■ ttsProvider = "openai"
■ openaiTtsKey — OpenAI API Key
■ openaiTtsBaseURL — 自定义 Base URL（可选，用于代理/中转）
■ ttsVoiceId — 音色（可选）

常用音色：
→ nova（女声，自然）
→ shimmer（女声，轻柔）
→ alloy（中性）
→ echo / fable / onyx（男声）

申请步骤：
1. 打开 https://platform.openai.com/ 注册/登录
2. API Keys 页面创建新密钥
3. 填写 openaiTtsKey

文档：https://platform.openai.com/docs/guides/text-to-speech`,
      },
      {
        title: 'ElevenLabs TTS',
        content: `ElevenLabs 超自然音色，英文效果顶级。

配置字段（POST /settings/tts）：
■ ttsProvider = "elevenlabs"
■ elevenLabsKey — ElevenLabs API Key
■ ttsVoiceId — 音色 ID（可选，默认使用预设列表）

常用音色：
→ 21m00Tcm4TlvDq8ikWAM（Rachel，女声，自然）
→ pNInz6obpgDQGcFmaJgB（Adam，男声）
→ MF3mGyEYCl7XYWbV9V6O（Elli，女声，年轻）

申请步骤：
1. 打开 https://elevenlabs.io/ 注册/登录
2. Profile Settings → API Keys，创建新密钥
3. 填写 elevenLabsKey

免费版每月 10,000 字符
文档：https://docs.elevenlabs.io/api-reference/text-to-speech`,
      },
      {
        title: '火山引擎 TTS（基础版）',
        content: `火山引擎传统 TTS，区别于豆包方舟（高级版）。

配置字段（POST /settings/tts）：
■ ttsProvider = "volcano"
■ volcanoAppId — 火山引擎应用 AppID
■ volcanoToken — 火山引擎访问 Token
■ ttsVoiceId — 音色 ID（可选）

常用音色：
→ BV001_streaming（通用女声）
→ BV002_streaming（通用男声）
→ zh_female_qingxin（清心，女声）

申请步骤：
1. 打开 https://console.volcengine.com/ 注册/登录
2. 进入「语音技术」→「语音合成」开通服务
3. 在应用管理中创建应用，获取 AppID
4. 在访问控制中获取 Token
5. 填写 volcanoAppId 和 volcanoToken

文档：https://www.volcengine.com/docs/6561/79823`,
      },
    ],
    providers: [
      { name: '豆包（火山方舟）', url: 'https://console.volcengine.com/ark', free: false, note: '推荐，流式低延迟，字段：doubaoKey' },
      { name: 'MiniMax', url: 'https://platform.minimaxi.com/', free: false, note: '复用 LLM 密钥，无需额外配置' },
      { name: 'OpenAI TTS', url: 'https://platform.openai.com/', free: false, note: '英文顶级，字段：openaiTtsKey' },
      { name: 'ElevenLabs', url: 'https://elevenlabs.io/', free: true, note: '超自然音色，字段：elevenLabsKey' },
      { name: '火山引擎 TTS', url: 'https://console.volcengine.com/speech/service/8', free: false, note: '传统版，字段：volcanoAppId + volcanoToken' },
    ],
  },

  voice_config: {
    id: 'voice_config',
    title: '语音功能完整配置指南',
    subtitle: 'Voice Configuration',
    icon: '⚙️',
    summary: 'ASR（语音识别）和 TTS（语音合成）综合配置说明。配置入口：点击左上角 ⚙ → 语音设置。',
    sections: [
      {
        title: '快速开始',
        content: `语音功能分两部分：
■ ASR（语音识别）：macOS 本地 Speech Recognition，麦克风 → 文字
  → 不需要配置云端 ASR Key
■ TTS（语音合成）：文字 → 声音，让 Agent 开口说话
  → 配置接口：POST /settings/tts

两者独立配置，可以只开启其中一个。
配置入口：点击左上角 ⚙ → 语音设置。`,
      },
      {
        title: '推荐配置组合',
        content: `■ 语音输入：macOS 本地 ASR
■ 中文语音输出：豆包方舟 TTS（doubaoKey）
■ 英文语音输出：OpenAI TTS（openaiTtsKey）或 ElevenLabs（elevenLabsKey）`,
      },
      {
        title: '配置后如何测试？',
        content: `TTS 测试：
→ 在聊天框告诉我「帮我测试一下 TTS」，我会播放一段测试语音

ASR 测试：
→ 点击界面上的麦克风按钮 🎤，开始说话
→ 说话停顿后文字会自动填入输入框
→ 如果没有识别结果，检查「为什么语音识别没有内容」那一节

密钥填写后立即生效，无需重启。`,
      },
      {
        title: '完整字段速查表',
        content: `ASR：
→ provider = macos-local
→ 无需保存云端 ASR 密钥

TTS 配置字段（POST /settings/tts）：
→ ttsProvider — 服务商（doubao/minimax/openai/elevenlabs/volcano）
→ ttsVoiceId — 音色 ID
→ doubaoKey — 豆包方舟 API Key
→ doubaoAccessKey — 火山引擎 Access Key（豆包备用）
→ doubaoAppId — 豆包 App ID（可选）
→ doubaoResourceId — 豆包语音资源 ID（可选，自动判断）
→ openaiTtsKey — OpenAI API Key
→ openaiTtsBaseURL — OpenAI 代理地址（可选）
→ elevenLabsKey — ElevenLabs API Key
→ volcanoAppId — 火山引擎基础版 AppID
→ volcanoToken — 火山引擎基础版 Token`,
      },
      {
        title: '数据隐私',
        content: `■ ASR：使用 macOS 本地识别，不发送到云端 ASR 服务商
■ TTS：文字会发送到你选择的语音合成服务商
■ API Key 仅保存在本地 config.json，不会上传到任何第三方`,
      },
    ],
    providers: [],
  },
}

// 根据用户消息内容检测应该弹出哪个主题
export function detectDocTopic(text) {
  if (!text) return null
  const t = text.toLowerCase()

  // TTS 相关：Agent 没声音、文字转语音
  if (/没有?声音|没声音|tts|文字.{0,5}(语音|声音)|(语音|声音)合成|听不到你|你.*说话|longma.*说话|agent.*说话|朗读|doubao.*key|doubaokey|minimax.*tts|openai.*tts|elevenlabs|volcanotoken|doubao.*tts/.test(t)) {
    return 'voice_tts'
  }

  // ASR 相关：麦克风输入不被识别
  if (/识别不到|没有?内容|没有?文字|(语音|声音)识别|配置.*(识别|听|麦克风)|听不到我|我说话|麦克风|mic\b|asr|speech.*recognition|本地识别/.test(t)) {
    return 'voice_asr'
  }

  // 通用语音配置
  if (/(语音|声音).*(配置|设置|怎么|如何|开启)|(配置|设置).*(语音|声音)|(语音|声音).*key|key.*(语音|声音)|语音功能/.test(t)) {
    return 'voice_config'
  }

  return null
}

// 将文档内容格式化为上下文注入字符串
export function formatDocAsContext(topicId) {
  const doc = DOC_TOPICS[topicId]
  if (!doc) return ''

  const lines = [
    `## 参考文档：${doc.title}`,
    doc.summary,
    '',
  ]

  for (const section of doc.sections) {
    lines.push(`### ${section.title}`)
    lines.push(section.content)
    lines.push('')
  }

  if (doc.providers.length > 0) {
    lines.push('### 服务商一览')
    for (const p of doc.providers) {
      lines.push(`- **${p.name}**${p.free ? '（有免费额度）' : ''}：${p.note} — ${p.url}`)
    }
  }

  return lines.join('\n')
}
