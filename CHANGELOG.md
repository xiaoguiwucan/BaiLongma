# 更新日志

所有重要版本都需要在这里写清楚：版本号、日期、改动内容、部署/备份注意事项。以后每次升级版本，必须同步更新 `package.json`、`package-lock.json`、`README.md`、`BACKUP-YYYY-MM-DD.md` 和 Brain UI 设置页里的更新说明。




## v0.3.1 - 2026-05-28

### 修复内容

- 修复微信群里已经 @ 助手，但助手仍回复“没叫我，跳过”的问题。
- 群助手触发逻辑改为以 Wechaty 的 `message.mentionSelf()` 元数据为准：只要微信消息结构确认 @ 了当前登录账号，就必须调用大模型并回复。
- 移除对固定昵称/唤醒词的绑定，不再依赖“前夜 / 小白龙 / 贾维斯 / 小风”等任何文本关键词。以后进群后改群昵称、改微信昵称、改备注名，都不影响 @ 回复。
- 群提示词新增“已由 Wechaty 确认 @ 当前账号”的强约束，禁止模型再次根据文本昵称判断“是不是叫我”。
- `send_message` 工具新增保护：如果 Wechaty 已确认 @ 当前账号，而模型试图发送“没叫我 / 不是@我 / 跳过 / 无需回应”，工具会拒绝这条错误回复并要求模型重新直接回答。
- LLM 循环新增兜底拦截：模型如果不调用工具、只输出“没叫我/跳过”，会被注入修正提示并重试。
- 协议 fallback 新增保护：即使模型最后仍输出错误跳过文本，也不会原样发到微信群。
- 修复 `sentMessage` 判断：只有 `send_message` 真正发送成功才算已回复；工具返回错误时会继续要求模型补发正确回复。

### 改变原因

- 微信群里显示的 @ 名称可能是群昵称、备注名、微信昵称或临时展示名，不能作为助手身份判断依据。
- 用户明确要求：不要绑定任何限制词，主要是 @ 就能回复，因为进群之后可能会改名，后续也可能给这个微信改昵称。

### 验证结果

- `node --check src/social/wechat-groups.js` 通过。
- `node --check src/social/wechaty-duty-group.js` 通过。
- `node --check src/social/wechat-clawbot.js` 通过。
- `node --check src/capabilities/executor.js` 通过。
- `node --check src/llm.js` 通过。
- `node --check src/index.js` 通过。
- 本地函数验证：`shouldWakeInWeChatGroup("@小风 写首诗", { mentionedSelf: true }) === true`，`mentionedSelf: false` 时不唤醒。

### 部署注意事项

- 需要重启白龙马/Electron 后生效。
- 不需要重新扫码，除非微信登录态本身已失效。
- 本补丁不新增依赖、不改 Honcho 端口、不上传任何群聊数据。


## v0.3.0 - 2026-05-28

### 里程碑定位

这是“微信群助手可用版”的里程碑更新：从之前的本地语音/桌面助手能力，正式扩展到可扫码登录微信、选择多个群组、在群里被 @ 后调用大模型回复，并为后续每个群独立知识库打好基础。

### 更新内容

#### 微信群助手

- 新增基于 `wechaty` + `wechaty-puppet-wechat4u` 的微信群助手连接器。
- 设置页新增独立“微信群助手”菜单，不再混放在普通社交媒体配置里。
- 支持扫码登录/恢复登录、展示二维码、获取真实微信群列表、勾选多个群组并保存生效。
- 支持默认接入“值班群”和“PT站看片狂魔小群”，也支持后续在设置页选择更多群。
- 群消息规则改为：只有 @ 当前登录微信号时才调用大模型；没有 @ 的普通群消息只进入归档/记忆链路，不主动打扰。
- 修复之前只对“在吗”等测试话术有硬编码回应的问题，现在 @ 后会进入真实 LLM 回复流程。
- 回复时会 @ 提问的群成员，并尽量使用可读昵称，避免把 `@03ee...` 这类内部 ID 直接发到群里。
- 增加文本 `@登录名` 兜底识别，减少 Wechaty mention 事件偶发不完整时漏触发的问题。

#### 登录状态与群组状态稳定性

- 修复扫码后设置页不显示真实在线状态的问题。
- 修复退出设置页再进入后群列表消失、已选群组显示不真实的问题。
- 群组列表刷新改为尊重运行时快照：未登录时不会用空列表覆盖之前已获取的真实列表。
- 保存群组选择时不再无意义重启 Wechaty，避免“扫码成功 -> 保存生效 -> 立刻掉线 -> 群里 @ 无响应”。
- `/social/wechaty-duty-group/start` 改为幂等：已经扫码中、已登录、已连接时重复点击不会重复启动/破坏会话。
- 对 Wechaty/Web 微信常见瞬时错误（如 `-1 == 0`、`400 != 400`）做降级处理：在已登录且群组已解析时视为警告，不再立即重连/登出。

#### Honcho 群知识库

- 新增 Honcho 记忆层依赖：`@honcho-ai/sdk` 与 `honcho-ai`。
- 新增 Honcho 配置项，默认连接本地服务 `http://127.0.0.1:8018`，默认应用/知识库为 `bailongma-wechat-memory`。
- 每个微信群映射为独立的 Honcho session/peer，避免不同群组之间记忆串扰。
- 新增群知识库查看/预览接口与 UI 入口，后续可按群手动管理。
- 按用户要求不启用本地兜底记忆：Honcho 未启动或不可用时，只提示状态，不偷偷写入本地替代库。

#### 群指令安全守卫

- 新增微信群指令黑名单守卫，防止群成员通过 @ 让助手执行危害电脑或账号的操作。
- 默认拒绝：删除/破坏文件、修改系统权限或启动项、读取/外传密钥、网络外传、执行命令/代码、安装卸载软件、远程控制、支付转账、账号操作、群发刷屏等高危请求。
- 按用户要求不加入逆向内容过滤，也不加入成人内容过滤。
- 安全守卫只针对危险执行类请求；普通问答、总结、解释、写作仍可调用大模型。

#### Electron / Mac 启动稳定性

- 新增 Mac 一键启动脚本：`start-jarvis.command`。
- 新增后台启动脚本：`start-jarvis-background.sh`，使用 macOS `open -n Electron.app --args <project>`，避免普通 `nohup npm start` 被终端/自动化会话带崩。
- Electron 主进程加入 EPIPE 保护，减少输出管道关闭导致的异常退出。
- 修复 Dock 栏有图标但点击不显示窗口的问题，`showMainWindow()` 与 `app.on('activate')` 会重新显示主窗口。

#### 语音与交互链路同步改进

- 接入火山/豆包 ASR 配置与后端链路，并增加后端轻量 VAD/自动 flush，改善“只识别最后一个字”和回答后不再识别的问题。
- 调整 TTS 自回声/打断逻辑，降低助手播报自己的声音又触发语音识别的概率。
- 根据用户反馈，关闭碎片化分段 TTS，默认回到更稳定的整段播报，避免语调忽变、读一半停住、漏读短句。
- 队列和 LLM 输出增加 Unicode 代理字符清理，避免异常字符导致消息/语音链路中断。

### 改变原因

- 用户已经完成微信扫码登录并在群里测试通过，说明本版本已经达到“群里 @ 能正常回复”的可用里程碑。
- 之前最大问题是：扫码后保存群组会掉线、群列表状态不真实、@ 后没有进入 LLM、以及 Wechaty 瞬时错误导致连接器误判失败。
- 本版本把登录状态、群组选择、@ 触发、LLM 回复、安全守卫、群记忆入口和 Mac 启动方式连成一条稳定链路。

### 验证结果

- 用户实测：微信群里 @ 登录账号后已经可以正常回复。
- `node --check src/social/wechaty-duty-group.js` 通过。
- `node --check src/api.js` 通过。
- `node --check src/config.js` 通过。
- `node --check src/social/wechat-group-memory.js` 通过。
- `node --check src/social/wechat-groups.js` 通过。
- `node --check src/social/wechat-command-guard.js` 通过。
- `node --check src/social/dispatch.js` 通过。
- `node --check src/social/index.js` 通过。
- `node --check src/ui/brain-ui/app.js` 通过。
- `node --check src/ui/brain-ui/app-shell.js` 通过。
- `node --check electron/main.cjs` 通过。

### 部署注意事项

- 从源码运行：`npm install` 后执行 `./start-jarvis.command`，或用 `npm start` 启动 Electron。
- 微信群助手依赖 `wechaty`、`wechaty-puppet-wechat4u`，本版本已写入 `package.json` 和 `package-lock.json`。
- Honcho 如果要启用本地知识库，需要单独启动 Honcho 服务，默认地址为 `http://127.0.0.1:8018`。如果 Honcho 未启动，微信群回复仍可工作，但群知识库状态会显示不可用。
- `.env`、`config.json`、`data/`、Wechaty 登录态、日志、`.playwright-mcp/`、本地模型和个人数据不上传 GitHub。
- 如果微信 Web 登录态失效，需要在“设置 -> 微信群助手”重新扫码。


## v0.2.0 - 2026-05-27

### 更新内容

- 新增小智式语音会话状态机 `VoiceSession`，统一管理语音 turn、状态和打断流程。
- 每轮语音输入生成独立 `voiceTurnId`，从前端发送、API 入队、LLM 流式事件到 TTS 播放全链路传递。
- ASR 回调、LLM 流式 TTS、TTS 队列播放都按 `voiceTurnId` 过滤，旧 turn 的回调会被丢弃，避免上一轮语音/播报污染当前轮。
- 新增统一 `abortSpeaking(reason)` 控制点，用于用户打断、新一轮语音开始、TTS 停止等场景。
- TTS 队列增加 turn 绑定；如果新 turn 已经开始，旧 turn 的分句语音不会继续播放。
- 前端运行时新增 `voice_turn_state`、`voice-fast-state`、`voice-session-state` 状态同步，供 UI 和后续诊断使用。
- API `/message` 支持 `voiceTurnId` / `voice_turn_id`，用于本地语音请求的会话隔离。

### 改变原因

- 借鉴小智 ESP32 的协议化会话思路：不是简单堆模型，而是把听、想、说、打断统一成明确的 turn 和状态。
- 进一步解决语音残留、旧回调串入新一轮、TTS/ASR 打断混乱等问题。

### 验证结果

- `node --check src/api.js` 通过。
- `node --check src/index.js` 通过。
- `node --check src/capabilities/executor.js` 通过。
- `node --check src/ui/brain-ui/app.js` 通过。
- `node --check src/ui/brain-ui/chat.js` 通过。
- `node --check src/ui/brain-ui/voice-panel.js` 通过。
- `npm run smoke:brain-ui` 通过。
- 本地 Electron 启动正常，API `3721` 和 ASR WebSocket `3723` 正常。
- `/message` 携带 `voiceTurnId` 的 voice channel 测试可以正常得到回复。

### 部署注意事项

- 本版本不新增模型文件，不需要额外下载。
- 如果从旧版本升级，直接 `git pull && npm install && npm start` 即可。
- 设置页仍保持简单，没有新增复杂客户配置项。

## v0.1.1 - 2026-05-27

### 修复内容

- 修复语音输入发送后，下一次识别会带上上一次语音内容的问题。
- 发送语音识别结果前后统一清空 `lastTranscriptText`、`accumulatedText`、`lastFinalTranscript` 和自动发送计时器。
- 语音输入改为明确走 `voice` 通道，避免本地语音被当作 TUI/外部消息处理。
- 为本地语音通道增加回复协议提示：直接输出助手正文，由运行时显示和 TTS 播放；不要强制使用 `send_message` 工具。
- 重启验证后确认之前运行进程中的 `voiceSentenceEmitter is not defined` 报错已消失。

### 验证结果

- `node --check src/index.js` 通过。
- `node --check src/ui/brain-ui/voice-panel.js` 通过。
- `npm run smoke:brain-ui` 通过。
- 本地启动后 API `3721` 和 ASR WebSocket `3723` 正常。
- voice channel 测试消息可以正常得到回复。

## v0.1.0 - 2026-05-26

### 更新内容

- 新增“小智式极速语音模式”，默认开启，用于语音对话场景的快速响应、分句播报和可打断交互。
- 后端 LLM 流式输出阶段新增语音分句触发器：模型一边生成正式回答，一边按中文标点/短句边界触发 TTS，不再等待整段回答完全结束后才开始说话。
- 前端 TTS 播放改为队列式分句播放：每一句独立请求 `/tts/stream`，上一句播放时下一句可以排队，减少首句等待时间。
- 打断逻辑升级：用户说话或近场人声触发 `stopTTS()` 时，会清空后续 TTS 队列、取消正在请求的 TTS、停止当前音频，并保留已说到的位置。
- 避免重复播报：当流式分句已经播报过内容时，`send_message` 工具回复和 fallback 回复不会再次把完整文本重复播一遍。
- 设置页新增“极速语音模式（可打断 / 快速播报）”开关，默认开启；关闭后回退到原来的整段 TTS 播放方式。
- 正式回答才会进入语音播报，思考流/工具准备流不会被念出来。

### 改变原因

- 用户希望借鉴小智 ESP32 的快速应答、可打断、快速输出语音和极速交互体验。
- 原逻辑需要等待完整回答后再合成 TTS，语音对话体感偏慢；本版本先完成软件端“流式分句播报 + 打断队列取消”的核心闭环。

### 验证结果

- `node --check src/index.js` 通过。
- `node --check src/ui/brain-ui/app.js` 通过。
- `node --check src/ui/brain-ui/app-shell.js` 通过。
- `npm run smoke:brain-ui` 通过。
- 本地启动后 `http://127.0.0.1:3721/status` 返回 `ok: true`。
- 本地 ASR WebSocket `127.0.0.1:3723` 正常监听。
- 通过 `/message` 发送 voice channel 测试消息，助手成功返回“极速语音模式测试通过”。

### 部署注意事项

- 本版本不新增大型模型文件，不需要额外下载模型。
- 如设置里关闭“极速语音模式”，语音播报会退回整段播放。
- 本版本仍使用当前已配置的本地 ASR/TTS 服务，只优化响应链路和播放队列。

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

