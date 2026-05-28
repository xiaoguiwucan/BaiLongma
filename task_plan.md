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
