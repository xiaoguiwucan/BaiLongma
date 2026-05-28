# Progress Log

- 2026-05-28: 开始处理微信群助手英文内部协议误回复、长期/成员记忆展示、群消息全量统计排行和定时总结功能。
- 已定位英文内部协议误回复的根因：对完整 prompt 做工具意图判断导致 false positive，且硬编码英文兜底文案直接投递到微信群。
- 已定位成员记忆展示不稳定的原因：只依赖 Honcho session peers，缺少从 message metadata 补全当前群成员 peer 的路径。
- 已修复主循环兜底：微信群入队携带原始 user_text，工具意图判断不再使用完整 prompt；英文内部协议文本统一替换为中文安全兜底，不再直接发群。
- 已新增群活动统计模块 `src/social/wechat-group-stats.js`：创建活动表/摘要发送表，识别文字、图片、表情、链接和装逼启发式指标，并提供排行/摘要文本生成。
- 已新增定时摘要调度模块 `src/social/wechat-group-digest.js`，按已勾选 Wechaty 群发送阶段总结和零点日报，带去重表避免重复发送。
- 已让 Wechaty/ClawBot 的群消息写入统计表，并对图片/表情 XML 做展示清洗。
- 已增强 Honcho 成员记忆读取：从群消息 sender metadata 反推成员 peer，避免成员记忆区域空白。
- 验证备注：`node --check` 已通过；直接用系统 Node 执行涉及 better-sqlite3 的运行态测试时失败，因为当前 node_modules 是按 Electron/Node ABI 130 编译，而系统 Node v24 需要 ABI 137。这是本地运行验证环境差异，不是本次代码语法错误。
- 已接入 API：群统计查询、手动发送总结、读取/保存定时总结配置，并在 `/settings/social` 返回当前配置。
- 已改造 Brain UI 微信群助手页：新增“群统计与定时总结”面板，提供阶段总结、每日 00:00 统计、五类排行榜开关、立即发送本群总结、今日统计卡片和排行榜展示。
- 已完成语法验证：新增模块、API、配置、Wechaty/ClawBot、UI 文件全部 `node --check` 通过；`npm run test:wechat-guard` 与 `npm run test:wechat-memory` 通过；`git diff --check` 通过。
- 已用 Playwright 打开当前运行的 Brain UI 并切到“微信群助手”页，确认新增“群统计与定时总结”面板已渲染。注意：当前 Electron 进程仍是修改前启动的旧后端，因此新统计 API 在未重启前返回 404；重启白龙马后新后端接口才会生效。
- 已修正群统计时间范围比较：统计查询统一转换为本地带时区时间戳，避免 UTC `Z` 和本地 `+08:00` 字符串比较导致“今日数据查不到”。
- 最终验证重新执行通过：所有相关 `node --check`、`npm run test:wechat-guard`、`npm run test:wechat-memory`、`git diff --check` 均通过。
- 2026-05-28: 根据用户截图反馈继续修复：统计/定时总结新增独立群组选择；未选择群时不再默认统计或定时发送到所有群。
- 统计面板新增“统计数据位置”和“本地统计库最近记录”，明确数据写入本机 SQLite `data/jarvis.db` 的 `wechat_group_activity` 表，不会混在 Honcho 记忆列表里。
- Honcho 记忆详情现在固定显示“群组长期记忆”和“成员长期记忆”分区，即使为空也有说明；历史英文内部协议误回复在记忆展示和上下文注入中会被隐藏。

- 2026-05-28 v0.4.3：新增微信群聊天记录库 API 和 UI，支持按当前群分页查看全量入库记录、完整时间、总条数、昵称、类型/时间/关键词筛选。
- 2026-05-28 v0.4.3：新增 `wechat_group_member_names` 昵称映射表，排行榜、最近记录、链接列表、聊天记录库统一优先显示微信群昵称/备注/微信昵称。
- 2026-05-28 v0.4.3：新增媒体保存和预览链路，新收到的图片/表情/音视频/附件会尝试保存到 `data/wechat-media`，JSON 导出包含媒体 base64，JSON 导入可恢复媒体。
- 2026-05-28 v0.4.3：修复时间筛选分钟边界、混合媒体类型筛选漏查、导入重复记录跳过。
- 2026-05-28 v0.4.3：版本号已更新到 0.4.3，README、CHANGELOG、BACKUP、RELEASE 和软件内更新说明已补充。
- 2026-05-28 v0.4.3：重启 Electron 后冒烟测试通过：`GET /settings/social` 正常返回；`GET /social/wechat-groups/records` 对现有 PT 群返回 total=27、完整时间范围和记录列表；JSON/CSV 导出可生成内容。
- 2026-05-28 v0.4.4：针对用户反馈修复“重新登录和新消息后仍无昵称”。根因是 Wechaty 默认 room.alias/contact.name 对部分群只返回内部 ID；已改为直接调用 wechat4u batchGetContact 刷新群成员 NickName/DisplayName。
- 2026-05-28 v0.4.4：本机实测 `/social/wechaty-duty-group/refresh-members` 返回 rooms=3、members=59、named=59；值班群成员“风/小号/移动小号”等已进入 wechat_group_member_names，旧记录 id=28 已回填为“风”。
- 2026-05-28 v0.4.4：修复重新扫码后 room_id 变化导致统计/聊天记录分裂：查询按 group_name 合并，后端入库判断兼容旧 room_id 选择。
- 2026-05-28 v0.4.4：优化聊天记录库 UI，新增主查询按钮、今天快捷按钮、刷新昵称按钮、记录库与 Honcho 群记忆区别说明。

- 2026-05-28 v0.4.5：开始处理多群区分、多人 @ 排队、管理员模式、统计自动刷新四项反馈。
- v0.4.5：已完成队列层修复：微信群 @ 消息带 noPrune/noPreempt，不再覆盖同群旧 @，也不打断正在处理的用户回复；后续按队列顺序逐条处理。
- v0.4.5：已完成管理员模式后端与前端：设置页可启用管理员模式、填写/点选精确 sender_id；管理员 @ 会跳过微信群黑名单，普通成员仍拦截；管理员身份不使用昵称。
- v0.4.5：已新增微信群成员 ID API，管理员设置页可展示最近识别成员、群名和 sender_id。
- v0.4.5：已完成统计页“当前群 / 已选统计群总览”切换；多群总览排行榜行内显示来源群，并展示按群拆分概览。
- v0.4.5：已增加设置页打开时的统计自动刷新（12 秒一次，仅微信群助手页激活时刷新榜单，不打断筛选输入）。
- v0.4.5：语法检查、wechat guard 测试、wechat memory 测试、git diff --check 已通过。
- v0.4.5：已重启 Electron，API `/settings/social` 返回当前版本代码字段（adminModeEnabled/adminWechatIds）且 Wechaty 真实连接 3 个群。
- v0.4.5：已验证新 API `/social/wechat-groups/members` 返回成员昵称、群名、sender_id；统计 API 仍可按群名/room_id 查询今日榜单。
- v0.4.5：已用 Browser 打开 Brain UI，进入“设置 -> 微信群助手”，确认管理员模式、保存管理员、已选统计群总览、当前查看提示、群统计与定时总结、聊天记录库均渲染成功。
- v0.4.5：准备提交并发布 GitHub Release，所有版本文档已更新到 v0.4.5。

- 2026-05-28 v0.4.6：开始实现多 LLM 模型池与额度耗尽/限流自动故障切换；已完成现有配置、API、UI 和 llm.js 调用链审查。
- v0.4.6：已实现后端 LLM profile 数据结构、旧单模型兼容迁移、`/settings/llm-profile`、`/settings/llm-profile/select`、`/settings/llm-profile/delete`、`/settings/llm-failover` API，并让 `/settings` 返回模型池/自动切换策略。
- v0.4.6：已改造 `src/llm.js`，流式请求会优先使用当前 profile；额度不足、限流、认证/模型不可用、5xx、网络超时时，在尚未输出内容前自动切换到备用模型并记录冷却。
- v0.4.6：已改造 Brain UI 的 LLM 模型设置页，新增当前模型条、自动切换策略、模型池卡片、编辑/启停/排序/删除/设为当前交互。
- v0.4.6：初步 `node --check` 已通过 config、llm、api、index、Brain UI JS 和 app-shell。
- v0.4.6：已完成临时配置冒烟测试：在备份/恢复 `config.json` 的前提下新增两个假模型 profile、保存 failover 策略、确认 `/settings` 公共 profile 不泄露 `apiKey` 字段，并恢复原配置文件。
- v0.4.6：最终验证通过：node --check 全部相关文件通过，wechat guard/memory 测试通过，git diff --check 通过；已重启 Electron 并确认 `/settings` 返回模型池 profiles、activeProfileId 和 failover，且不返回明文 API Key。
- 2026-05-28 v0.4.7：已修复微信群 @ 回复对象，改为按当前提问人的 sender_id / sender_name 生成专属 reply target，并在发送时优先按群成员精确匹配，避免再 @ 到管理员或上一位成员。
- 2026-05-28 v0.4.7：已补充对聊天记忆机制的说明：不是全库直塞，而是分层注入（群长期记忆、成员记忆、最近群聊流水、摘要、关键词召回）。

## 2026-05-28 v0.4.15 hotfix progress
- 已验证 DB schema：聊天记录字段为 `display_text/raw_text/timestamp`，不是 `content`。
- 已用 SQLite 和 API 对比确认：数据库持续写入 PT 群新消息，页面截图的 16 条对应另一个当前选中的群。
- 下一步修复：让结束时间默认跟随当前时间、自动刷新聊天记录列表、在摘要中明确显示当前查看群和 DB 最新入库时间，降低误判。
- 已完成 v0.4.15 修复：查看群组下拉框、结束时间自动跟随、聊天记录自动刷新、摘要显示当前群/DB 最新入库时间、API latest_record。
- 已重启 Bailongma，当前 3721 端口运行 v0.4.15；Browser 烟测切到 PT 群后记录数正常刷新到 514 条。
