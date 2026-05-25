![图片](https://github.com/xiaoyuanda666-ship-it/BaiLongma/blob/main/images/AGI128k.jpg)

# Bailongma — 数字意识框架

**v2.1.231** | 一个持续运行的「数字意识」实验框架。

Bailongma 不是传统的一问一答式聊天程序。它以 `TICK` 驱动的方式持续运行——有外部消息时优先响应，空闲时依据记忆、任务和上下文自主思考。项目内置了完整的记忆系统（SQLite 持久化）、双层思考流程（L1 快速响应 / L2 深度处理）、上下文注入、焦点栈、语音系统、多平台社交分发、可扩展工具市场、ACUI 可视化组件系统，以及用于观察「意识流」的 Brain UI 监控面板。

## 版本更新记录

当前维护仓库：[xiaoguiwucan/BaiLongma](https://github.com/xiaoguiwucan/BaiLongma)

每个版本的改动内容、改变原因、部署注意事项和备份说明都记录在 [CHANGELOG.md](CHANGELOG.md)。软件内也可以在 Brain UI 的“设置 -> 更新 -> 更新说明”查看最近版本摘要。

最近版本：

- `v2.1.231`：新增 `/voice/events` 客户端消息校验与 `protocol_error` 结构化错误回执，外部设备发送坏 JSON、未知类型或空 `tts:speak` 时不再静默失败。
- `v2.1.230`：新增 `GET /voice/events/protocol` 协议元数据端点，并把 WebSocket hello/status/protocol 统一到共享版本与能力常量，方便外部设备自检。
- `v2.1.229`：导出 `mapVoiceEventToXiaozhi` 纯函数并新增 `smoke:voice-mapping`，快速验证 13 项核心事件映射。
- `v2.1.228`：继续增强 `smoke:voice-events`，覆盖完整 TTS lifecycle 映射：start/sentence_start/audio_ready/sentence_end/stop。
- `v2.1.227`：继续增强 `smoke:voice-events`，新增 wake:accepted 和 tts:audio_ready 的小智式映射覆盖。
- `v2.1.226`：增强 `npm run smoke:voice-events`，覆盖 `POST /voice/events/publish` 到 raw voice_event 和小智式 stt final 映射。
- `v2.1.225`：新增 `npm run smoke:voice-events`，自动验证 `/voice/events` hello/ping/subscribe/cancel/status 基础协议。
- `v2.1.224`：新增 `docs/VOICE_EVENTS_PROTOCOL.md`，固化 `/voice/events` v3 协议、事件、TTS speak/cancel 和音频块说明。
- `v2.1.223`：新增 `npm run voice:events` 调试客户端，支持 status/listen/speak/cancel 和音频落盘。
- `v2.1.222`：新增 WebSocket `tts:cancel`，并加入同连接新 speak 替换旧 speak、断线自动取消守卫。
- `v2.1.221`：新增 WebSocket `tts:speak`，外部客户端可直接发送文本并接收分句事件与音频块。
- `v2.1.220`：新增可选 WebSocket TTS 音频块订阅，客户端显式订阅后可接收 base64 或二进制音频块。
- `v2.1.219`：新增 TTS 分句音频就绪事件，WebSocket 客户端可收到每段音频 URL/序号/文本元数据，为后续 Opus 音频帧打基础。
- `v2.1.218`：新增实验性 `/voice/events` WebSocket 语音事件通道，可向外部客户端广播小智式 JSON 生命周期事件。
- `v2.1.217`：新增小智式语音事件协议，统一 wake/asr/tts/interrupt/media 事件，为 WebSocket 语音通道做准备。
- `v2.1.216`：新增分句式 TTS Session、中文分句器和前端播放队列，让 AI 回复按句生成播放并支持旧会话取消。
- `v2.1.215`：重构 ASR Provider 元数据，新增极速/平衡/高精度识别模式，为后续接入更多中文本地模型打基础。
- `v2.1.214`：增强视频播放抗干扰，新增视频降音目标、保持时间、触发灵敏度和降音状态显示。
- `v2.1.213`：增强本地声纹稳定性，新增多样本声纹、声纹测试和录入校准反馈。
- `v2.1.212`：增强小智式唤醒词流程，新增严格/宽松模式、可配置唤醒窗口和重复误识别抑制。
- `v2.1.211`：启动小智式语音改造第一阶段，新增 Voice State Machine、round/session 守卫和设置页语音调试面板。
- `v2.1.210`：固化“所有版本必须 GitHub Release 备份”的维护规则，并新增小智语音架构借鉴研究报告。
- `v2.1.209`：补齐版本更新记录机制，在文档和设置页加入更新说明。
- `v2.1.208`：正式加入本地 SenseVoiceSmall、Whisper 备用、唤醒词、声纹确认、视频抗干扰和详细 Mac 自部署文档。

---

## 核心模块详解

### 1. 主循环（src/index.js）

持续运行的意识循环，由 `TICK` 驱动。调度优先级：

| 优先级 | 触发条件 | 立即执行 |
|--------|----------|----------|
| 用户消息 | 收到外部消息 | ✅ 立刻 |
| 后台消息 | 后台队列 | ✅ 立刻 |
| TICK 心跳 | 无消息 | ⏱ 自适应间隔 |
| 任务模式 | 有活跃任务 | 30s 间隔 |
| 限流 | 429 / 配额超限 | 按配额间隔 |
| 觉醒期 | 首次启动 | 10s 间隔 |

关键特性：
- **消息抢占**：高优先级消息可打断当前 LLM 调用（abort 后自动重试）
- **看门狗**：单轮 `runTurn` 超过 180 秒强制 abort，防止卡死
- **消息兜底**：LLM 忘记调 send_message 时自动投递
- **唤醒觉醒期**：首次激活后的 10 个 TICK 以 10s 间隔运行，自动执行探索任务
- **启动自检**：启动时运行文件读写、热点面板、视频播放三项自检

### 2. 记忆系统（src/memory/）

SQLite 持久化，支持 FTS5 全文搜索 + 向量嵌入双路召回。

**识别器**：每轮交互后分析思考内容和工具调用，批量 `search_memory` 查重，再 `upsert_memory` 按 `mem_id` 去重写入。

**注入器**：根据当前消息提取关键词 → FTS5 搜索相关记忆 → 按 salience 重排（★4+ 前置）→ 向量嵌入兜底 → 构建 `context` 块注入给 LLM。

**焦点栈（Focus Stack）**：多帧注意力跟踪机制。自动判断用户话题状态：
- `created` — 栈空建帧
- `kept` — 命中栈顶，保持
- `pushed` — 新主题，push 子帧
- `returned` — 回到旧主题，pop 到对应帧
- `cleared` — 栈顶失活超过 20 TICK，自动 pop

每帧 pop 后异步压缩为结论（focus-compress），挂回新栈顶 + 沉淀为长期记忆。

**时间词召回**：自动识别"昨天/前天/上周"等时间词，从 focus_conclusion 记忆按时间窗口召回。

### 3. LLM Provider 支持（src/providers/ + src/config.js）

| Provider | 默认模型 | 备注 |
|----------|----------|------|
| MiniMax | MiniMax-M2.7 | 测试表现最佳，支持多媒体 |
| DeepSeek | deepseek-v4-flash | 支持推理模式 |
| OpenAI | gpt-4o-mini | |
| Qwen | qwen-turbo | |
| Moonshot | moonshot-v1-8k | |
| Zhipu | glm-4-flash | |
| Custom | 自定义 | 任意 OpenAI 兼容端点 |

首次启动自动进入激活页，支持 `auto` 模式自动探测 API Key 所属 Provider。

### 4. 语音系统（src/voice/）

- **ASR**：本地 SenseVoiceSmall（默认，中文优先）/ Whisper 备用 + 云端 ASR（阿里云、腾讯、讯飞配置入口）
- **唤醒词**：Brain UI 可开启/关闭并自定义唤醒词，默认 `小龙马 / 龙马 / 白龙马`
- **声纹确认**：支持本地录入声纹、开启“只响应我的声音”，并可调节声纹严格度
- **视频抗干扰**：视频播放时支持近场人声自动降音/暂停、空格按住说话、系统 AEC 开关
- **稳定性过滤**：本地 ASR 服务增加静音门控、低置信度过滤和重复幻觉文本过滤，减少视频背景音误识别
- **TTS**：豆包火山引擎 / MiniMax / OpenAI TTS / ElevenLabs 多选；分句播放时会广播 `tts:audio_ready` 音频段元数据，并支持 WebSocket 客户端显式订阅 TTS 音频块或直接发送 `tts:speak` 合成请求，并可用 `tts:cancel` 打断
- 所有配置通过 Brain UI 设置页完成，凭证持久化在 config.json

### 5. 社交平台分发（src/social/）

统一消息分发层，支持多渠道：

| 平台 | 类型 | 配置方式 |
|------|------|----------|
| 微信（个人号） | ClawBot 桥接 | Brain UI 扫码连接，无需第三方工具 |
| 微信公众号 | 服务号客服消息 | APP_ID + APP_SECRET |
| Discord | Bot Token | DISCORD_BOT_TOKEN |
| 飞书 | 应用凭证 | APP_ID + APP_SECRET |
| 企业微信 | Webhook | BOT_KEY |

消息接收后自动进入主循环处理，回复通过 dispatch.js 路由回对应平台。

### 6. 上下文采集器（src/context/gatherer.js）

任务执行前的充分性检查循环：检查当前上下文是否充足 → 不足则自动读取文件/搜索记忆/召回 → 再检查，最多 3 轮。确保 LLM 在执行任务前有足够信息。

### 7. 工具市场（src/capabilities/marketplace/）

支持安装自定义工具（JavaScript 代码），运行时加载到 `sandbox/installed_tools/`。工具代码有完全的 `fetch` 和 `exec` 能力，受沙箱保护。提供 install/uninstall/list 接口。

### 8. 自动资源感知

启动时自动扫描：
- **SSH**：~/.ssh/ 密钥、known_hosts、config 主机别名
- **Git**：全局配置、远程仓库
- **桌面**：快捷方式、文件变化
- **本地 AI Agent**：Claude Code、Codex、Hermes 等
- **系统和地理位置**：IP、时区、位置、天气

这些扫描结果注入系统提示词中的 `<resources>` 块，让 LLM 在需要时能直接用（不依赖用户手动提供）。

### 9. Brain UI（src/ui/brain-ui/）

SPA 监控面板，提供：
- 聊天界面（多用户/多渠道）
- 思考流实时可视化（工具调用、记忆注入、焦点变化）
- 热点面板（微博/知乎/HN/Reddit 热搜）
- 人物卡片
- 文档配置面板
- 语音控制面板
- 微信扫码弹窗
- 设置页（Provider / 社交 / 语音 / 嵌入 / 搜索配置）
- ACUI 组件系统（可注册自定义 UI 卡片）

### 10. ACUI 组件系统

代理可主动推送可视化卡片到用户界面（`ui_show`/`ui_update`/`ui_hide`）。已注册组件：
- WeatherCard（天气卡片）
- SelfCheckStepCard / SelfCheckCard（启动自检）
- AwakeningCard（觉醒期探索进度）

组件遵循 Web Component 标准，支持 enter/exit 动画，可注册为永久组件。

---

## 快速开始

### 安装

从 [Releases](https://github.com/xiaoyuanda666-ship-it/BaiLongma/releases) 下载 `Bailongma Setup x.x.x.exe` 安装，双击启动后自动进入激活页。


### 语音 WebSocket 调试客户端

用于验证 `/voice/events` 小智式协议、TTS speak/cancel 和音频块。完整协议说明见 [docs/VOICE_EVENTS_PROTOCOL.md](docs/VOICE_EVENTS_PROTOCOL.md)：

```bash
# 查看事件通道状态
npm run voice:events -- status

# 监听 JSON 事件，并订阅 base64 音频块
npm run voice:events -- listen --audio

# 直接发起 WebSocket TTS，并把二进制音频保存为 mp3
npm run voice:events -- speak "测试白龙马语音服务端" --binary --save tmp/tts.mp3

# 取消当前连接上的 active speak
npm run voice:events -- cancel
```

### 从源码运行

```bash
cd BaiLongma
npm install

# Electron 桌面版（推荐）
npm start

# 纯后端模式
npm run start:backend

# 开发模式（文件改动自动重启）
npm run dev
```

### 配置

首次运行通过 `http://127.0.0.1:3721/activation` 激活，填入任意支持的 LLM API Key。支持 `.env` 文件：

```env
LLM_PROVIDER=minimax
MINIMAX_API_KEY=your_key
```

### 打包

```bash
npm run build    # 打包为 NSIS 安装包
npm run publish  # 打包并发布到 GitHub Releases
```

---

## Web Interfaces

| 页面 | 地址 | 用途 |
|------|------|------|
| Brain UI | `http://127.0.0.1:3721/brain-ui` | 主界面：聊天、监控、设置 |
| 激活页 | `http://127.0.0.1:3721/activation` | 首次激活/换 Key |
| 状态 API | `http://127.0.0.1:3721/status` | 运行状态与记忆数 |

---

## API

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/message` | 发送消息 |
| `GET` | `/events` | SSE 实时事件流 |
| `GET` | `/status` | 运行状态 |
| `GET` | `/quota` | 配额占用 |
| `GET` | `/memories` | 查询/搜索记忆 |
| `GET` | `/conversations` | 查询对话 |
| `PATCH` | `/memories/:id` | 修改记忆 |
| `DELETE` | `/memories/:id` | 删除记忆 |
| `GET` | `/audio/:filename` | 音频文件 |
| `POST` | `/admin/stop` | 暂停循环 |
| `POST` | `/admin/start` | 恢复循环 |
| `POST` | `/admin/restart` | 重启进程 |
| `POST` | `/admin/reset-memories` | 清空记忆和对话 |
| `POST` | `/admin/reset-files` | 清空沙盒文件 |

---

## 持久化

- **记忆**：SQLite，FTS5 全文索引 + 可选向量嵌入
- **对话**：含渠道标记和 externalPartyId，多渠道互通可见
- **任务**：重启可恢复
- **焦点栈**：重启可恢复
- **配置**：`config.json`，含 Provider、社交、语音、嵌入、搜索全量配置

---

## 辅助脚本

| 脚本 | 用途 |
|------|------|
| `scripts/send.py` | 发送消息、查询状态 |
| `scripts/reset.js` | 清空数据库与沙盒 |
| `scripts/seed-memories.js` | 写入种子记忆 |
| `scripts/smoke-tools.mjs` | 工具冒烟测试 |
| `scripts/smoke-brain-ui.mjs` | Brain UI 冒烟测试 |
| `scripts/smoke-social.mjs` | 社交连接冒烟测试 |
| `scripts/start-lan.ps1` | 局域网访问启动 |
| `scripts/build-voice.ps1` | 语音模型构建 |

---

## 技术栈

- **运行时**：Node.js 18+ / Electron 33
- **数据库**：better-sqlite3（同步、高性能）
- **LLM 接口**：OpenAI 兼容 API（6+ Provider）
- **语音**：Whisper（Python 进程）+ 云端 TTS
- **UI**：原生 Web Components + Brain UI SPA
- **构建**：electron-builder + NSIS

---

## License

[MIT License](./LICENSE)
