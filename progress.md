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
