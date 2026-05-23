# BaiLongma 安全重构提示词

用途：后续每次让 AI 或人工代理执行模块拆分时，先使用这份提示词，确保重构目标是“拆结构，不改行为”。

```text
你正在 BaiLongma 项目的 `refactor/module-split` 分支上做代码模块拆分重构。

最高优先级目标：
在不改变现有功能、运行行为、工具协议、API 响应结构、数据库语义、UI 交互和启动路径的前提下，把大文件拆成更细粒度的功能模块。

绝对约束：
1. 不要顺手修业务逻辑，除非当前步骤已经证明不修会导致拆分后无法运行，并且必须单独说明。
2. 不要修改用户体验、文案、视觉样式、模型提示词语义、工具返回格式、API JSON shape、数据库字段含义。
3. 不要删除现有导出。需要迁移时，先在旧文件保留 facade/re-export，保证旧 import 继续工作。
4. 不要做大规模格式化，不要把纯搬迁 diff 搅成全文件重排。
5. 不要覆盖或回滚工作区里已有的未提交改动。动手前必须检查 `git status --short --branch`。
6. 不要使用破坏性 git 命令，例如 `git reset --hard`、`git checkout -- <file>`。
7. 不要把多个重构目标混在一次改动里。每次只拆一个清晰边界。
8. 不要改变 security/sandbox 行为。文件工具、命令工具、LAN/token 权限、敏感路径保护必须保持原样。
9. 不要改变数据库 migration 的幂等性。旧安装和新安装都必须能启动。
10. 不要改变 `send_message`、fallback reply、TTS 自动播放、消息写库、社交渠道投递的行为链路。

开始前必须做：
1. 运行并记录：
   - `git branch --show-current`
   - `git status --short --branch`
2. 阅读当前要拆的源文件和调用点。
3. 写出本步边界：
   - 要拆什么
   - 不拆什么
   - 哪些 public exports 必须保持
   - 哪些 smoke/test 要跑

执行方式：
1. 优先新增小模块，把纯函数或同一工具域的 handler 移过去。
2. 旧文件先保留入口函数、注册表或 re-export。
3. 保持函数签名、参数名、返回值格式、错误文本和事件名不变。
4. 每移动一组函数，就检查所有 import 路径。
5. 如果移动过程中发现循环依赖，先停下来分析依赖方向，不要硬拆。
6. 如果发现必须改变行为才能继续，停止并汇报，不要擅自改。

验证要求：
根据本步影响范围至少运行相关命令：
- 工具执行器改动：`npm run smoke:tools`
- 前端 brain UI 改动：`npm run smoke:brain-ui`
- 社交/微信/外部渠道改动：`npm run smoke:social`
- 后端启动路径改动：`npm run start:backend` 或等价的短时启动检查
- DB/migration 改动：用临时数据库或备份数据库验证新安装和旧数据启动

验收标准：
1. 测试或 smoke 通过；如果不能运行，必须明确原因。
2. `git diff` 显示的是结构拆分，不包含无关格式化或业务改动。
3. 新模块职责单一，命名清楚。
4. 旧 API/exports/imports 兼容。
5. 出现行为差异时，本步不算完成。

当前建议优先顺序：
1. `src/capabilities/executor.js` 的剩余工具域拆分，下一步优先 `shell.js`。
2. `src/api.js` 的 router/routes/http-utils/security 拆分。
3. `src/db.js` 保持 facade 的 repositories 拆分。
4. `src/index.js` 的 runtime 编排拆分。
5. `src/ui/brain-ui/app.js` 的 UI 子系统拆分。

每次最终回复必须包含：
1. 本次拆了什么。
2. 明确说明是否改变行为。默认应为“未改变预期行为”。
3. 跑了哪些验证命令，结果如何。
4. 如果有未验证项，说明残余风险。
```

## 单步重构任务模板

```text
请在 BaiLongma 的 `refactor/module-split` 分支上执行一次小步安全重构。

本次目标：
[填写一个非常具体的目标，例如：从 `src/capabilities/executor.js` 抽出 tool policy 到 `src/capabilities/tool-policy.js`]

边界：
- 只搬迁/整理该目标相关代码。
- 不改变任何功能行为。
- 不改变工具返回值、API 响应、数据库语义、UI 文案。
- 保持旧入口兼容。

请先检查 git 状态，阅读相关调用点，说明计划，然后修改。
修改后运行相关 smoke/test，并汇报结果。
```

## 代码审查检查清单

- 是否有无关格式化？
- 是否有文案、提示词、错误文本变化？
- 是否有 API JSON 字段变化？
- 是否有工具返回值 shape 或文本语义变化？
- 是否有数据库 schema/migration 非幂等风险？
- 是否有事件名、DOM id、localStorage key、config key 改名？
- 是否有 import 循环？
- 是否有启动顺序变化？
- 是否有异步时序变化，尤其是 abort/watchdog/preemption？
- 是否运行了与影响范围匹配的 smoke/test？

## 下一会话接手提示词

```text
你正在 BaiLongma 项目的 `refactor/module-split` 分支继续做安全模块拆分重构。

当前状态：
- 已完成基础拆分：`tool-policy.js`、`tool-audit.js`、`tool-utils.js`、`abort-utils.js`、`sandbox.js`、`tools/filesystem.js`。
- `executor.js` 仍保留对外入口 `executeTool`、`autoSpeakForVoiceReply`、`persistAppState`。
- 版本已升到 `2.1.184`，并成功 build 出 `dist/Bailongma-Setup-2.1.184.exe`。
- 已验证：`node --check` 全部通过，`smoke:tools` 6/6，通过，`smoke:brain-ui` 通过，安装后 `/status` HTTP 200。
- `smoke:social` 在本地 Node CLI 下会因 `better-sqlite3` Electron ABI 130 与 Node ABI 127 不一致而失败；不要把这个当成本次重构回归，Electron 安装包已验证可启动。

本次任务：
继续拆 `src/capabilities/executor.js`，优先把 shell 工具域拆到 `src/capabilities/tools/shell.js`，包括 `exec_command`、后台进程、`list_processes`、`kill_process`、命令输出裁剪、执行 cwd 解析、跨平台 shell spawn 相关逻辑。

硬约束：
- 只做结构拆分，不改行为。
- 不改变工具名、参数、返回 JSON/text shape、错误文案、安全策略、事件名。
- 保留 `executor.js` 对外入口兼容。
- 不覆盖或回滚已有未提交改动，开始前先运行 `git status --short --branch`。
- 如遇循环依赖或必须改变行为才能继续，停止并说明，不要硬拆。

验证：
- 先跑相关 `node --check`。
- 必须跑 `npm run smoke:tools`。
- 如果改动影响启动或打包，再跑 `npm run build` 并验证安装包 `/status`。
```
