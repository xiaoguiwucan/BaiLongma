# BaiLongma 代码模块拆分重构计划

目标：把当前几个超大文件拆成更细粒度、职责清晰、可测试、可继续扩展的功能模块，同时保持现有行为不变。

核心原则：

- 行为优先：重构期间默认不改产品行为、不改工具协议、不改 API 响应结构、不改数据库语义。
- 小步提交：每次只拆一个明确边界，拆完立即运行对应 smoke/test。
- 保留门面：对外 import 路径先尽量保持稳定，例如 `db.js` 可以继续作为 facade 导出旧 API。
- 先复制验证再删除：先把逻辑搬到新模块并接入，再确认调用与测试通过，最后清理旧实现。
- 避免混合需求：模块拆分提交里不顺手修 UI、不调文案、不换模型、不改业务规则。
- 尊重工作区：重构分支上如果已有未提交改动，先确认它们是否属于当前步骤，不能覆盖或回滚。

当前分支：`refactor/module-split`

## 已识别的重构对象

### 1. `src/capabilities/executor.js`

现状：约 2700 行，包含工具调度、命令工具、网页搜索、浏览器读取、记忆工具、提醒、TTS/音乐/图片、UI 卡片、应用管理、任务状态、代理委托等。

建议拆分：

- `src/capabilities/executor.js`：保留对外入口 `executeTool`、`autoSpeakForVoiceReply`、`persistAppState`。
- `src/capabilities/tool-registry.js`：工具名到 handler 的注册表。
- `src/capabilities/tools/shell.js`：`exec_command`、后台进程、进程列表、kill。
- `src/capabilities/tools/web.js`：`web_search`、`fetch_url`、`browser_read`、搜索缓存。
- `src/capabilities/tools/memory.js`：`search_memory`、`upsert_memory`、`merge_memories`、`recall_memory`。
- `src/capabilities/tools/reminders.js`：`schedule_reminder`、`manage_reminder`、时间解析。
- `src/capabilities/tools/media.js`：`speak`、`generate_music`、`music`、`generate_image`。
- `src/capabilities/tools/ui.js`：`ui_show`、`ui_update`、`ui_hide`、`ui_patch`、`manage_app`、`ui_register`。
- `src/capabilities/tools/system.js`：`set_tick_interval`、`set_task`、`complete_task`、`set_security`、`set_agent_name` 等。
- `src/capabilities/tools/delegation.js`：代理委托相关工具。

优先级最高。下一步建议从 `shell.js` 开始，因为它紧挨着已拆出的 sandbox/abort helper，边界清楚，仍可通过 `smoke:tools` 快速验证。

### 2. `src/api.js`

现状：手写 HTTP server 中集中维护几十个 endpoint，路径判断和业务处理混在一起。

建议拆分：

- `src/api.js`：保留 server 创建、CORS、安全入口、WebSocket upgrade 分发。
- `src/api/router.js`：轻量路由匹配与 handler 调用。
- `src/api/http-utils.js`：`jsonResponse`、`readJsonBody`、`contentTypeFor`、静态文件响应。
- `src/api/security.js`：loopback/LAN/token/origin 判断。
- `src/api/routes/settings.js`
- `src/api/routes/memory.js`
- `src/api/routes/media.js`
- `src/api/routes/static.js`
- `src/api/routes/social.js`
- `src/api/routes/acui.js`
- `src/api/routes/voice.js`
- `src/api/routes/admin.js`

优先级第二。拆完后新增接口不再污染主 server 文件。

### 3. `src/db.js`

现状：schema 初始化、迁移、查询、写入、搜索、提醒、配置、媒体、focus stack 都集中在一个文件，对外导出很多函数。

建议拆分时必须保留 `src/db.js` facade：

- `src/db/connection.js`：better-sqlite3 连接与 `getDB`。
- `src/db/schema.js`：建表 SQL。
- `src/db/migrations.js`：迁移逻辑。
- `src/db/json-utils.js`：JSON array/stringify/salience 等纯函数。
- `src/db/repositories/config.js`
- `src/db/repositories/memories.js`
- `src/db/repositories/conversations.js`
- `src/db/repositories/reminders.js`
- `src/db/repositories/prefetch.js`
- `src/db/repositories/media.js`
- `src/db/repositories/action-logs.js`
- `src/db/repositories/ui-signals.js`
- `src/db/repositories/focus-stack.js`

优先级第三。风险比 executor/API 高，因为持久化语义敏感，必须先有回归测试或至少 smoke 覆盖。

### 4. `src/index.js`

现状：启动流程、状态、调度、tick loop、上下文注入、focus stack、LLM 调用、工具回调、fallback 回复等都在主文件里。

建议拆分：

- `src/runtime/state.js`：运行时状态初始化与持久化字段。
- `src/runtime/scheduler.js`：tick 调度、watchdog、preemption。
- `src/runtime/turn-runner.js`：`runTurn` 主流程。
- `src/runtime/context-builder.js`：injection 后的 runtime context 汇总。
- `src/runtime/fallback-reply.js`：模型未调用 `send_message` 时的兜底规则。
- `src/runtime/startup.js`：系统启动、资源扫描、provider 注册、API/social 启动。
- `src/runtime/awakening.js`：awakening/self-check/exploration 逻辑。

优先级第四。这个文件是主循环，必须在 executor/API/db 拆稳定后再动。

### 5. `src/ui/brain-ui/app.js`

现状：D3 记忆图、主题、缩放、聊天、SSE、TTS、设置面板、更新提示、媒体面板集中在一个浏览器脚本中。

建议拆分：

- `src/ui/brain-ui/main.js`：启动入口。
- `src/ui/brain-ui/graph/memory-graph.js`
- `src/ui/brain-ui/events/sse-client.js`
- `src/ui/brain-ui/settings/settings-panel.js`
- `src/ui/brain-ui/settings/model-settings.js`
- `src/ui/brain-ui/settings/voice-settings.js`
- `src/ui/brain-ui/media/music-panel.js`
- `src/ui/brain-ui/media/video-panel.js`
- `src/ui/brain-ui/tts/playback.js`
- `src/ui/brain-ui/focus/focus-stack.js`
- `src/ui/brain-ui/theme/theme.js`

优先级第五。拆分时要结合 Playwright/smoke UI 验证，避免界面事件丢失。

## 建议执行顺序

### Phase 0: 每次开始前的护栏

- 记录当前分支和工作区改动。
- 运行现有 smoke/test，建立 baseline。
- 明确不可破坏清单：
  - `npm run start:backend`
  - `npm run smoke:tools`
  - `npm run smoke:brain-ui`
  - `npm run smoke:social`
  - Electron 启动路径
  - 激活页/API key 配置
  - `send_message` 兜底回复
  - 文件 sandbox 安全限制
  - 数据库 migration 与已有用户数据兼容

### Phase 1: 继续拆 executor 的剩余工具域

- 先拆 shell，因为边界最清楚，且依赖的 sandbox/abort helper 已经存在。
- 再拆 web/memory/reminders。
- 最后拆 UI/media/delegation/system。
- 每拆一个域，运行对应 smoke 和最小手工调用。

### Phase 2: 拆 API 路由

- 先建立 `router` 和 `http-utils`，保持 handler 原逻辑。
- 每次移动一组 endpoint。
- 用脚本或 curl/PowerShell 验证核心路径状态码和 JSON shape。

### Phase 3: 拆 DB facade

- 保持 `src/db.js` 的导出名称不变。
- 先迁移 config/action_logs/ui_signals 这类低风险仓储。
- 再迁移 reminders/conversations。
- 最后迁移 memories 和 FTS/migration。

### Phase 4: 拆 runtime 和 UI

- 先从 `index.js` 抽 awakening/self-check、fallback、context builder。
- 再处理 scheduler/turn-runner。
- 前端每次拆完必须跑 `smoke:brain-ui`，必要时用 Playwright 截图确认。

## 每一步完成标准

- 没有顺手改业务逻辑。
- 对外导出兼容，或者明确列出所有调用点修改。
- 相关 smoke/test 通过。
- `git diff` 能清楚看出这是搬迁/重命名/薄封装，不是混杂功能变更。
- 新模块名和目录结构表达业务含义。
- 出现无法确认的行为差异时，停止继续拆分，先记录并回退本步。

## 高风险点

- `send_message` 写库、渠道路由、TTS 自动播放之间有隐式耦合。
- `runTurn` 中 abort/watchdog/preemption 影响消息不丢失。
- `db.js` migration 对新安装和旧安装都必须兼容。
- `executor.js` 的工具返回值很多是给 LLM 看的文本，不能轻易改 wording/JSON shape。
- 前端 `app.js` 很多事件绑定依赖 DOM id 和初始化顺序，拆分时最容易漏。
- 当前源码中存在部分历史乱码注释，重构时不要让编码问题扩大。

## 暂不做

- 不迁移到 TypeScript。
- 不引入 Express/Koa 等新 server 框架。
- 不重写数据库 schema。
- 不改变工具协议。
- 不改变 UI 视觉设计。
- 不做大规模格式化。
- 不在重构提交里升级依赖。
