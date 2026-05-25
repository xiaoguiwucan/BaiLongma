# 更新日志

所有重要版本都需要在这里写清楚：版本号、日期、改动内容、部署/备份注意事项。以后每次升级版本，必须同步更新 `package.json`、`package-lock.json`、`README.md`、`BACKUP-YYYY-MM-DD.md` 和 Brain UI 设置页里的更新说明。

维护铁规：任何版本修改、功能更新、修复、文档更新，只要形成版本，都必须上传 GitHub 备份，并创建 GitHub Release。Release 里必须写清更新内容、改变原因、部署方式、备份附件说明和已知限制，不能只推 commit 或 tag。

## v2.1.216 - 2026-05-26

### 更新内容

- 新增 `src/voice/sentence-splitter.js`，按中文/英文标点和长度把 AI 回复切成适合 TTS 的短句。
- 新增 `src/voice/tts-session.js`，提供 TTS sessionId、segment 列表、取消状态和单句音频流。
- 后端新增分句式 TTS API：
  - `POST /tts/session` 创建分句 TTS 会话；
  - `GET /tts/session/:id/audio/:index` 获取指定句子的音频；
  - `POST /tts/session/:id/cancel` 取消旧会话。
- 前端 `playTTSReply` 从“整段请求、整段 blob 完成后播放”改为“创建 session、按句请求、队列播放”。
- 用户打断、新回复开始时会取消旧 TTS session，避免旧音频串到新对话。
- 保留旧 `/tts/stream` 接口，兼容设置页试听和外部调用。

### 改变原因

- 小智的低延迟体验来自 LLM 流式输出 + 分句 TTS + 音频队列。
- 白龙马旧版虽然后端返回 stream，但前端等待完整 `blob()` 后才播放，用户感知延迟较高。
- 本版本先落地可靠的句子级队列播放，为后续真正流式 TTS、MediaSource 或 Opus/WebSocket 音频帧打基础。

### 影响范围

- 不替换现有 TTS Provider。
- 豆包、MiniMax、OpenAI、ElevenLabs、火山引擎仍走原 `streamTTS` 适配层。
- 长回复会被分句播放；短回复体验基本不变。

### 验证结果

- `node --check src/voice/sentence-splitter.js` 通过。
- `node --check src/voice/tts-session.js` 通过。
- `node --check src/api.js` 通过。
- `node --check src/ui/brain-ui/app.js` 通过。
- `npm run smoke:tools` 6/6 通过；本机 Node v24 下仍有已知 `better-sqlite3` ABI 日志警告。

### 部署注意事项

- 源码部署方式不变。
- 如果 TTS Provider 凭证未配置，分句会话创建成功但请求音频时仍会返回对应 Provider 的凭证错误。
- 本版本是句子级队列，不是最终的 Opus/WebSocket 帧级协议。

## v2.1.215 - 2026-05-26

### 更新内容

- 新增 `src/voice/asr-providers.js`，集中描述本地/云端 ASR Provider、模型列表和识别 Profile。
- 本地 ASR manager 状态新增 `profile`、`engineLabel`、`providerSummaries`，方便设置页和调试面板读取。
- 语音配置新增 `asrProfile`，支持 `speed / balanced / accuracy` 三种识别模式。
- `/voice/local/start` 和 `/voice/local/restart` 支持传入 `asrProfile`。
- Brain UI 设置页新增“识别模式”：
  - 极速：优先低延迟；
  - 平衡：推荐默认；
  - 高精度：优先准确率。
- 现有默认仍保持本地 SenseVoiceSmall，不改变用户当前中文优先本地 ASR 体验。

### 改变原因

- 用户要求中文优先、速度快、精准，并希望后续可以替换 Whisper。
- 在继续接 Sherpa、FunASR 其他模型或更强中文 ASR 之前，需要先把 ASR 从“硬编码模型选择”整理为 Provider + Profile 架构。

### 影响范围

- 不强制替换当前模型。
- 不改变本地 SenseVoiceSmall 默认行为。
- 为后续 v2.1.216 分句 TTS 以及后续 ASR 模型扩展提供更清晰的配置基础。

### 验证结果

- `node --check src/voice/asr-providers.js` 通过。
- `node --check src/voice/manager.js` 通过。
- `node --check src/config.js` 通过。
- `node --check src/api.js` 通过。
- `node --check src/ui/brain-ui/voice-panel.js` 通过。
- `node --check src/ui/brain-ui/app.js` 通过。
- `node --check src/ui/brain-ui/app-shell.js` 通过。
- `npm run smoke:tools` 6/6 通过；本机 Node v24 下仍有已知 `better-sqlite3` ABI 日志警告。

### 部署注意事项

- 源码部署方式不变。
- 已有配置会自动使用 `asrProfile=balanced`。
- 本版本没有新增大型模型文件。

## v2.1.214 - 2026-05-26

### 更新内容

- 视频播放时的近场人声检测从单帧阈值升级为连续帧确认，减少爆炸声、鼓点、视频瞬时峰值导致的误降音。
- 设置页新增视频降音目标，可在 2%–50% 之间调节。
- 设置页新增降音保持时间，可在 0.8–8 秒之间调节。
- 设置页新增人声触发灵敏度，可按环境噪声调高/调低。
- 媒体层 `startMediaVoiceDuck` 改为读取用户配置，不再固定 10% 音量和 1.8 秒保持。
- 新增 `bailongma:media-duck` 状态事件和设置页“当前降音状态”显示。

### 改变原因

- 用户提出视频播放声音会盖住自己的唤醒词。旧版虽然会自动降音/暂停，但触发阈值和保持时间硬编码，不同视频音量、麦克风距离和环境噪声下不够可调。
- 本版本让用户可以把视频降到更低、保持更久，或者在嘈杂视频里降低触发灵敏度门槛。

### 影响范围

- 不改变 ASR、声纹、唤醒词模型。
- 本地 mp4/网页视频/YouTube/Bilibili 仍使用现有媒体控制策略；只是降音参数变为可配置。
- 对 Bilibili 等跨域播放器，仍可能使用短暂停/恢复作为降音替代。

### 验证结果

- `node --check src/ui/brain-ui/voice-panel.js` 通过。
- `node --check src/ui/brain-ui/app.js` 通过。
- `node --check src/ui/brain-ui/app-shell.js` 通过。
- `npm run smoke:tools` 6/6 通过；本机 Node v24 下仍有已知 `better-sqlite3` ABI 日志警告。

### 部署注意事项

- 源码部署方式不变。
- 如果视频仍盖住唤醒词，建议把“视频降音目标”调到 2%–5%，把“降音保持时间”调到 3–5 秒，并保持 AEC 开启。

## v2.1.213 - 2026-05-26

### 更新内容

- 本地声纹从单一 embedding 升级为多样本声纹：录入时会把 7.5 秒语音拆成多个片段，分别提取 embedding，再计算中心声纹。
- 声纹验证改为“中心声纹 + 样本最佳分数”综合判断，降低同一用户因距离、音量、语速变化被误拒绝的概率。
- `data/voiceprint.json` 新增 `samples`、`sampleCount`、`calibration` 等元数据，同时保留旧 `embedding` 字段兼容旧版本。
- 本地 SenseVoice WebSocket 新增 `speaker_test_start` / `speaker_test_finish` 协议，可在不触发助手的情况下测试当前声音是否通过声纹。
- 设置页新增“测试我的声纹”按钮和“声纹状态”，会显示分数、阈值和样本数量。
- 录入完成后显示自校准均值和建议阈值；如果录入样本一致性较低，会建议更宽松阈值。

### 改变原因

- 用户反馈“录了声纹，但识别不到我的声音”。单次声纹样本在真实使用中容易受距离、麦克风角度、噪声、视频播放、语速变化影响。
- 多样本中心声纹和自测分数可以显著提升可调试性，让用户知道是阈值过高、录入质量差，还是当前环境噪声太强。

### 影响范围

- 不上传任何声纹数据；`data/voiceprint.json` 仍是本机隐私文件，不进入 GitHub。
- 兼容旧版单 embedding 声纹文件，读取时会自动作为一个样本使用。
- 本版本仍使用 `resemblyzer`，还没有切换到 3D-Speaker/ECAPA 等更重模型。

### 验证结果

- `python3 -m py_compile src/voice/sensevoice_server.py` 通过。
- `node --check src/ui/brain-ui/app.js` 通过。
- `node --check src/ui/brain-ui/app-shell.js` 通过。
- `node --check src/ui/brain-ui/voice-panel.js` 通过。
- `npm run smoke:tools` 6/6 通过；本机 Node v24 下仍有已知 `better-sqlite3` ABI 日志警告。

### 部署注意事项

- 已有声纹文件可继续使用，但建议用户在 v2.1.213 后重新录入一次，以获得多样本声纹和校准信息。
- 如果“测试我的声纹”未通过，优先降低声纹严格度到 0.50–0.55，或在安静环境重新录入。

## v2.1.212 - 2026-05-26

### 更新内容

- 唤醒词系统新增“严格 / 宽松”匹配模式：
  - 严格模式要求语音以唤醒词开头，适合视频播放、多人聊天和高噪声场景，默认启用。
  - 宽松模式保留旧体验，只要句中包含唤醒词即可触发。
- 唤醒后指令窗口从固定 8 秒改为可配置 3–30 秒。
- 新增“抑制重复误识别文本”开关，用于过滤连续重复的错误 ASR 文本，降低视频/噪声导致的误触发。
- `src/config.js` 增加 `wakeMode`、`wakeWindowSeconds`、`wakeRepeatSuppression` 配置，并通过 `/settings/voice` 保存。
- `voice-panel.js` 的 wake gate 现在会给状态机写入更明确的拒绝/唤醒原因，例如 `wake missing`、`wake not at prefix`、`repeat suppressed`、`wake matched`。
- 设置页“语音识别”新增唤醒匹配模式、唤醒窗口滑杆和重复误识别抑制选项。

### 改变原因

- 用户要求只有喊出关键词时才开始识别语音，避免普通聊天或视频声音误唤醒助手。
- 小智式交互强调明确的唤醒状态和短时间指令窗口，因此需要把旧版硬编码 8 秒窗口改成可配置。
- 之前出现过重复幻觉文本，本版本进一步在唤醒门控层抑制连续重复的无效文本。

### 影响范围

- 本版本不替换 ASR 模型，不改变声纹模型和视频抗干扰底层能力。
- 默认从“句中包含唤醒词即可”调整为“严格：必须以唤醒词开头”，误唤醒更少，但用户需要更明确地说“龙马，帮我……”。
- 如果用户喜欢旧体验，可以在设置里切换为“宽松”。

### 验证结果

- `node --check src/config.js` 通过。
- `node --check src/ui/brain-ui/voice-panel.js` 通过。
- `node --check src/ui/brain-ui/app.js` 通过。
- `node --check src/ui/brain-ui/app-shell.js` 通过。
- `npm run smoke:tools` 6/6 通过；本机 Node v24 下仍有已知 `better-sqlite3` ABI 日志警告，但不影响 smoke 断言。

### 部署注意事项

- 源码部署方式不变。
- 已有用户首次打开设置时会自动写入默认 `wakeMode=strict`、`wakeWindowSeconds=8`、`wakeRepeatSuppression=true`。

## v2.1.211 - 2026-05-26

### 更新内容

- 新增 `src/voice/voice-state-machine.js`，建立小智式语音状态机基础。
- 状态机统一管理 `idle / listening / wake_detected / recording / recognizing / thinking / speaking / interrupted / done / error / event`。
- 新增 `roundId`、`asrSessionId`、`ttsSessionId`，为后续“旧轮次识别结果丢弃”“旧 TTS 音频不串入新对话”“分句 TTS session”打基础。
- 前端 `voice-panel.js` 接入状态机，现有本地 SenseVoice、Whisper 备用、唤醒词、声纹、视频抗干扰、TTS 打断逻辑保持可用。
- 设置页“语音识别”新增“小智式语音状态机”调试面板，可查看当前状态、状态原因、Round、ASR Session、TTS Session。
- Brain UI“设置 -> 更新 -> 更新说明”新增 v2.1.211 版本说明。

### 改变原因

- 用户确认开始按小智架构对白龙马进行系统性优化。
- 后续要做分句 TTS、WebSocket 音频通道、唤醒/声纹/视频抗干扰协同，必须先有统一状态机和轮次守卫，避免旧识别、旧音频和新对话互相串扰。

### 影响范围

- 本版本是语音交互底座改造，不替换当前 ASR/TTS Provider。
- 当前听写、唤醒词、声纹、视频抗干扰逻辑仍沿用 v2.1.208-v2.1.210 的实现。
- 新增调试面板默认显示，可在设置中关闭。

### 验证结果

- `node --check src/voice/voice-state-machine.js` 通过。
- `node --check src/ui/brain-ui/voice-panel.js` 通过。
- `node --check src/ui/brain-ui/app.js` 通过。
- `node --check src/ui/brain-ui/app-shell.js` 通过。
- `npm run smoke:tools` 6/6 通过；本机 Node v24 下仍有已知 `better-sqlite3` ABI 日志警告，但不影响 smoke 断言。
- `npm run smoke:brain-ui` 当前超时等待 `#graph circle`，记录为非本次语音状态机改造引入的既有 UI smoke 阻塞点。

### 部署注意事项

- 源码部署仍按 `BACKUP-2026-05-26.md` 执行：`npm install`、准备 Python 3.11、本地 ASR 虚拟环境和 SenseVoiceSmall 模型。
- 本版本没有新增大型模型文件，`models/SenseVoiceSmall/` 和 `.venv-whisper/` 仍不进入 GitHub，需要本地重建。

## v2.1.210 - 2026-05-26

### 更新内容

- 固化维护规则：以后任何版本修改或更新都必须上传 GitHub，并创建 GitHub Release 作为正式备份。
- 新增小智 `xiaozhi-esp32` 借鉴研究报告：`research/xiaozhi-esp32-borrowing-report.md`。
- 报告整理了小智的本地/云端分工、低延迟原因、Opus 流式音频、唤醒词、声纹、AEC/VAD、状态机和对白龙马的落地路线。

### 改变原因

- 用户要求后续所有版本修改都必须 GitHub 备份。
- 用户要求研究小智哪些能力可以借鉴到白龙马。

### 影响范围

- 不改变运行逻辑。
- 本版本是维护规范和技术研究文档版本。

## v2.1.209 - 2026-05-26

### 更新内容

- 新增正式 `CHANGELOG.md`，以后每个版本的备份、功能变化、部署注意事项都集中记录在这里。
- Brain UI 的“设置 -> 更新”页面新增“更新说明”区域，用户可以直接在软件里看到最近版本改变了什么。
- README 增加“版本更新记录”入口，避免只有版本号没有说明。
- 备份文档补充版本维护规范，明确以后每个版本都要写清更新内容、改变原因、部署方法和不进 Git 的本地文件。

### 影响范围

- 不改变语音识别、声纹、唤醒词和视频抗干扰的运行逻辑。
- 这是一次文档和界面说明增强版本。

### 备份说明

- GitHub 维护仓库：`xiaoguiwucan/BaiLongma`
- 上一个功能备份 tag：`backup-2026-05-26-local-voice`
- 本版本应打 tag：`v2.1.209`

## v2.1.208 - 2026-05-26

### 更新内容

- 将当前 Mac Electron 本地语音助手能力正式升级为 `v2.1.208`。
- 默认本地语音识别模型改为 `SenseVoiceSmall`，中文优先、速度更快，并降低空音频幻觉概率。
- 保留 Whisper 作为本地备用模型，可在设置页切换。
- 新增 `src/voice/sensevoice_server.py`，通过 WebSocket 提供本地 ASR 服务，兼容原本麦克风音频链路。
- 本地 ASR 服务加入静音门控、近场人声阈值、最短语音长度、重复文本过滤和常见幻觉文本过滤。
- 设置页新增语音识别服务商选择：本地、阿里云、腾讯云、讯飞。
- 设置页新增本地模型选择：SenseVoiceSmall、Whisper tiny/base/small/medium/large/turbo 等。
- 新增唤醒词开关和自定义唤醒词输入，默认 `小龙马 / 龙马 / 白龙马`。
- 新增声纹录入能力，支持“只响应我的声音”。
- 新增声纹严格度滑杆，默认 `0.55`，用于提高声纹识别稳定性。
- 新增视频播放抗干扰设置：
  - 检测到近场人声时自动降低/暂停视频；
  - 视频播放时启用空格按住说话；
  - 启用系统回声消除 AEC。
- 前端语音面板增加声纹拒绝反馈，能看到拒绝原因和相似度分数。
- `.gitignore` 增加 `.venv-whisper/`、`models/SenseVoiceSmall/`、`backups/`、Python 缓存等本地大文件忽略规则。
- 新增详细备份与 Mac 自部署文档 `BACKUP-2026-05-26.md`。

### 改变原因

- 用户要求语音识别尽量本地化，中文优先，速度要快且精准。
- 原 Whisper 在静音、视频背景音、噪声环境下容易输出重复幻觉文本，例如“我只想说了”等无效内容。
- 播放视频时，视频声音可能遮盖用户唤醒词，需要提供 AEC、视频降音和按住说话组合方案。
- 用户希望助手只响应本人声音，因此加入本地声纹录入和声纹校验。

### 部署注意事项

- `models/SenseVoiceSmall/` 不上传 GitHub，需要按 `BACKUP-2026-05-26.md` 里的方法下载。
- `.venv-whisper/` 不上传 GitHub，需要在 Mac 上重新创建 Python 3.11 虚拟环境。
- `.env`、`config.json`、`data/` 属于本地配置和个人数据，不作为公开 GitHub 备份上传。
- 声纹数据在 `data/voiceprint.json`，属于敏感个人数据，不应上传公开仓库。

### 已知限制

- 当前唤醒词仍是软件侧文本/音频链路判断，还不是专用 KWS 模型。
- 当前声纹使用 `resemblyzer`，适合个人桌面辅助，但还不是 3D-Speaker/ECAPA 工业级声纹系统。
- 视频很吵时声纹和 ASR 都会受影响，最稳定方案仍是同时开启视频降音、AEC 和空格按住说话。

## v2.1.182 - 2026-05-25

### 更新内容

- README 同步补充专注栈、Agent 委托、语音系统、社交分发等 Step5-6 新增模块。
- 保留作为上游历史版本节点，后续本仓库以 `xiaoguiwucan/BaiLongma` 为维护主仓库。
