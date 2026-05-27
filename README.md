![Bailongma](images/AGI128k.jpg)

# Bailongma — 数字意识框架

**v0.3.2** | 一个持续运行的「数字意识」实验框架。

Bailongma 不是传统的一问一答式聊天程序。它以 `TICK` 驱动的方式持续运行——有外部消息时优先响应，空闲时依据记忆、任务和上下文自主思考。项目内置了完整的记忆系统（SQLite 持久化）、双层思考流程（L1 快速响应 / L2 深度处理）、上下文注入、焦点栈、语音系统、多平台社交分发、可扩展工具市场、ACUI 可视化组件系统，以及用于观察「意识流」的 Brain UI 监控面板。

## 版本更新记录

当前维护仓库：[xiaoguiwucan/BaiLongma](https://github.com/xiaoguiwucan/BaiLongma)

每个版本的改动内容、改变原因、部署注意事项和备份说明都记录在 [CHANGELOG.md](CHANGELOG.md)。软件内也可以在 Brain UI 的“设置 -> 更新 -> 更新说明”查看最近版本摘要。

最近版本：

- `v0.3.2`：修复 Wechaty 登录态持久化，重启后优先自动恢复，不再正常重启就清掉扫码状态。
- `v0.3.1`：修复微信群 @ 后误判“没叫我，跳过”的问题；@ 触发只认 Wechaty 元数据，不再绑定任何昵称/关键词。
- `v0.3.0`：微信群助手里程碑版，支持扫码登录、真实群列表、多群勾选、群里 @ 后调用大模型回复、Honcho 群知识库入口和群指令安全守卫。
- `v0.2.0`：新增语音会话状态机和 voiceTurnId 全链路隔离，旧 ASR/TTS/LLM 回调不会污染新一轮语音。
- `v0.1.1`：修复语音输入不回复、以及下一次识别带上上一次语音内容的问题。
- `v0.1.0`：新增小智式极速语音模式，支持流式分句 TTS、可打断队列、快速首句播报和设置开关。

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
- **TTS**：豆包火山引擎 / MiniMax / OpenAI TTS / ElevenLabs 多选
- 所有配置通过 Brain UI 设置页完成，凭证持久化在 config.json

### 5. 社交平台分发（src/social/）

统一消息分发层，支持多渠道：

| 平台 | 类型 | 配置方式 |
|------|------|----------|
| 微信（个人号） | ClawBot 桥接 | Brain UI 扫码连接，无需第三方工具 |
| 微信群助手 | Wechaty / wechat4u | 设置 -> 微信群助手，扫码登录后选择多个群组，群里 @ 后调用大模型回复 |
| 微信公众号 | 服务号客服消息 | APP_ID + APP_SECRET |
| Discord | Bot Token | DISCORD_BOT_TOKEN |
| 飞书 | 应用凭证 | APP_ID + APP_SECRET |
| 企业微信 | Webhook | BOT_KEY |

消息接收后自动进入主循环处理，回复通过 dispatch.js 路由回对应平台。

### 5.1 微信群助手（v0.3.0 里程碑）

- 独立设置菜单：`设置 -> 微信群助手`。
- 支持 Wechaty 扫码登录、恢复登录、真实群列表、多群勾选和保存生效。
- 群里只有 @ 当前登录微信号才会调用大模型；普通群消息默认只归档，不主动刷屏。
- 回复会 @ 原提问人，并避免把内部联系人 ID 直接显示在群里。
- 接入 Honcho 群知识库入口：每个微信群独立 session/peer，避免不同群之间记忆串扰。
- 内置危险群指令黑名单：默认拒绝删除文件、外传密钥、执行命令、支付转账等高危请求。


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

从 [Releases](https://github.com/xiaoguiwucan/BaiLongma/releases) 下载 `Bailongma Setup x.x.x.exe` 安装，双击启动后自动进入激活页。

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
