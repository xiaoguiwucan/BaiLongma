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
