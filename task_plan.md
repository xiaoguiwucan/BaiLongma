# Task Plan: WeChat Group Full Archive, Stats, Digest UI, and Reply Safety Fix

## Goal
完成用户当前反馈的三个核心问题：
1. 修复微信群里偶发回复英文内部协议文案 `I did not actually call the required tool...` 的问题，任何情况下不把工具协议/内部提示发到群里。
2. 让 Honcho 长期记忆和群成员记忆在设置页更直观可见，群成员记忆按“当前群内成员”单独展示。
3. 实现微信群全量聊天记录/统计/排行/定时总结：记录文字、图片、表情、链接和装逼指数；提供排行榜；支持定时发送群聊摘要和每天 00:00 当日统计；所有设置可视化配置。

## Phases
1. [complete] 审查现有 WeChat group prompt、fallback、Honcho memory、配置/API/UI 结构。
2. [complete] 修复英文内部协议误回复：使用原始群消息判断工具意图，改为中文安全兜底，并过滤内部协议文本。
3. [complete] 完善 Honcho 成员记忆读取：从群消息 sender 元数据补充成员 peers，保证成员记忆能展示。
4. [complete] 新增群活动统计模块和数据库表，记录所有群消息的类型、计数、链接、表情、图片、装逼指数。
5. [complete] 新增定时摘要/日报配置与调度，支持手动预览/发送，并避免重复发送。
6. [complete] 改造设置页：群统计卡片、排行榜、定时总结配置、长期记忆/成员记忆展示更明显。
7. [complete] 运行语法检查和现有测试，修复问题。
8. [complete] v0.4.3 更新版本号、README/CHANGELOG/BACKUP/RELEASE/软件内更新说明。
9. [in_progress] 提交、打 tag、推送并创建 GitHub Release。

## Constraints
- 不修改 AiMaMi 本地代理配置。
- 群助手只要被真实 @ 就应调用大模型，不依赖昵称/触发词。
- 群成员不能触发本机命令、文件、账号、资金等危险操作；安全黑名单必须优先于 LLM。
- 允许理解网络梗、允许发送公网图片/表情链接；禁止发送本机文件或本机图片。
- 记忆按群隔离，成员记忆只在当前群内有效。
- 不使用本地记忆兜底；长期记忆仍以 Honcho 为主，统计数据写本地业务数据库用于报表和调度。

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
| better-sqlite3 ABI 不匹配 | 用系统 Node 直接运行统计模块写库测试 | 记录为验证环境差异；继续用 node --check 和现有无 DB 测试验证，Electron 运行环境使用 ABI 130 的原编译模块。 |


## v0.4.1 Follow-up Plan
1. [complete] 统计/定时总结新增独立群组选择，未选择不统计、不发送。
2. [complete] UI 显示统计数据真实存储位置和最近统计记录。
3. [complete] Honcho 群组/成员长期记忆分区固定显示空状态。
4. [complete] 历史英文内部协议误回复在记忆展示和上下文注入中隐藏。
5. [pending] 版本文档、提交、推送、Release。


## v0.4.3 Follow-up Plan
1. [complete] 新增微信群聊天记录库 API：分页查询、时间/类型/关键词筛选、JSON/CSV 导出、JSON 导入。
2. [complete] 新增成员昵称映射表并让排行榜/记录库统一优先显示微信昵称。
3. [complete] 新增媒体保存、媒体预览接口和 JSON 媒体备份恢复。
4. [complete] 修复 datetime-local 秒级边界和混合媒体类型筛选漏查。
5. [in_progress] 完成验证、提交、推送和 GitHub Release。


## v0.4.4 Follow-up Plan
1. [complete] 修复昵称刷新：直接调用 wechat4u batchGetContact 拉群成员 NickName/DisplayName。
2. [complete] 修复 room_id 变化：统计/记录按群名合并，旧选择仍可匹配新 room_id。
3. [complete] 优化聊天记录库 UI：主查询、今天、刷新昵称、用途说明。
4. [in_progress] 更新版本文档、验证、提交、推送并创建 v0.4.4 Release。

## v0.4.5 Follow-up Plan
1. [complete] 修复多人同时 @ 被覆盖：微信群 @ 消息进入队列时不再按群覆盖旧消息，按到达顺序逐条回复。
2. [complete] 增加管理员模式：用精确微信 sender_id 管理，UI 可查看最近成员并一键加入；管理员绕过微信群黑名单但留下审计标记。
3. [complete] 优化多群统计/排行榜展示：增加“当前单群/已选多群总览”视图，多群行内显示群名，避免混淆。
4. [complete] 修复榜单不会自动更新：设置页打开时定时刷新统计/聊天记录，并在保存统计群后立即刷新。
5. [complete] 更新版本文档、验证、提交、推送并创建 v0.4.5 Release。

## v0.4.6 LLM Model Pool / Failover Plan
1. [complete] 设计多 LLM 模型池数据结构，兼容旧 `provider/apiKey/model/baseURL` 配置。
2. [complete] 后端新增模型池配置读写、启用/删除/设为当前、自动切换开关和冷却策略。
3. [complete] LLM 流式调用支持当前模型失败后按优先级无缝切到下一个可用模型，记录错误并发出 UI 事件。
4. [complete] 设置页 LLM 模型菜单改造为“当前模型 + 新增/编辑模型 + 模型池列表 + 自动切换开关”。
5. [complete] 验证语法/关键测试、更新 v0.4.6 文档、提交并发布 GitHub 备份。

## v0.4.6 Constraints
- 不修改 AiMaMi 本地代理配置。
- 不在 API/UI 返回明文 API Key，只显示是否已配置和尾号。
- 旧单模型配置必须可自动迁移为模型池第一项，避免用户当前配置丢失。
- 自动切换只处理额度不足、限流、认证失败、服务不可用、模型不可用、网络超时等可切换错误；用户主动中断不切换。
- 已经流出内容后不重试，避免 UI/语音重复或内容拼接错乱。

## v0.4.15 Hotfix Plan - WeChat chat archive not updating
1. [complete] 对照 Wechaty 日志和 `wechat_group_activity` 数据库最新记录，确认问题发生在写库链路还是 UI/API 查询链路。
2. [complete] 检查 `wechaty-duty-group`、`wechat-group-stats`、API 和设置页聊天记录库筛选逻辑，重点确认 room_id 变化、统计群开关、北京时间/UTC、自动刷新。
3. [complete] 修复“程序运行但全量聊天记录不持续入库/页面不更新”的根因，并增加最近收到/最近入库诊断。
4. [in_progress] 运行关键测试、更新版本文档、提交 tag、推送 GitHub Release。

### v0.4.15 Constraints
- 不修改 AiMaMi 本地代理配置。
- 聊天记录库必须独立于是否启用日报/统计榜单：只要 Wechaty 收到已接入群消息，就必须尝试入库。
- 查询页面要按群名合并旧 room_id，避免重登后看起来“数据丢失”。

## v0.4.16 Hotfix Plan - WeChat replies must search full chat archive
1. [complete] 确认微信群 @ 回复目前只注入 Honcho 记忆 + conversations 最近 100 条，没有把 `wechat_group_activity` 全量聊天记录库作为证据检索。
2. [complete] 新增当前群聊天记录库证据检索：按关键词/称呼/被问对象搜索本群历史流水，并限制条数避免全库塞进 prompt。
3. [pending] 将检索结果注入微信群 @ 回复 prompt，要求回答聊天历史问题时优先基于证据，不知道就说明没查到。
4. [in_progress] 补测试、重启验证、更新 v0.4.16 文档并发布 GitHub Release。

## v0.4.17 Hotfix Plan - WeChat @ target and admin mode
1. [complete] 修复 Wechaty @ 回复目标：底层 send_message 对当前微信群消息强制使用本轮真实 sender_id，不允许模型改错 target_id。
2. [complete] 修复管理员模式勾选被状态轮询覆盖：status polling 不再把缺失 admin 字段当成关闭。
3. [complete] 管理员选择 UI 支持按微信昵称/群名/ID 搜索，保存后立即显示已生效状态。
4. [complete] 管理员保护：非管理员 @ 助手攻击/暗算管理员时，基于已保存管理员 ID/昵称生成犀利但不越界的回怼。
5. [complete] 测试、重启、文档和 GitHub Release。

## v0.4.18 Hotfix Plan - WeChat send failure and parallel mentions
1. [complete] 修复 Wechaty target_id 校验失败：真实提问人目标加入本轮 allowed/visible。
2. [complete] 新增微信群 @ 批量并行处理，默认 3 并发、最大 5。
3. [complete] 更新版本文档和设置页更新说明。
4. [complete] 测试、重启、发布 GitHub Release。

## v0.4.19 Hotfix Plan - Admin nickname UI
1. [complete] 管理员设置页已选区域改为显示昵称，底层保留 sender_id 集合。
2. [complete] 搜索框改为按微信昵称/备注搜索。
3. [complete] 成员卡片隐藏长 ID，点击昵称卡片添加/取消管理员。
4. [complete] 测试、重启、发布 GitHub Release。

## v0.4.20 Hotfix Plan - Honcho offline should not break LLM settings
1. [complete] 定位 LLM 接口可用，问题来自 Honcho/Docker 离线导致设置页异常和程序不稳定。
2. [complete] Honcho 连接失败后 60 秒降级跳过，读写群记忆不再抛到主流程。
3. [complete] 修复 Honcho list 异常路径引用未定义 session。
4. [complete] 测试、重启、发布 GitHub Release。

## v0.4.21 Hotfix Plan - New WeChat groups visible everywhere
1. [complete] 新增后端 known groups 聚合接口。
2. [complete] 前端群候选统一合并缓存群、已识别群和已配置群。
3. [complete] 新群默认显示为已识别/未开启 @ 回复，不自动授权。
4. [complete] 测试、重启、发布 GitHub Release。
