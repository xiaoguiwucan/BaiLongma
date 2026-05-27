# Findings: WeChat Memory Management, Persona Prompt, Safety Guard UI

待填。


## 2026-05-28 审查发现
- Honcho 现有 `listWeChatGroupMemory()` 只列 session.messages 原始消息，UI 也只显示第一选中群，因此用户会觉得“看不到记忆”。需要新增按群概览 + 当前群详细列表，至少显示消息、总结、结论/卡片（如果 Honcho 后台已生成）。
- Honcho SDK `Session` 支持 `messages()`、`summaries()`、`context()`、`delete()`，没有公开单条 message delete；`Peer.conclusionsOf(target).delete(id)` 支持删除结论。单条原始消息管理只能在当前版本提供“删除整个群 session / 删除结论”，不能假装删除单条消息。
- 微信助手配置目前只有 enabled/groupNames/runtime；需要增加 personaPrompt 并在 `buildWeChatGroupCommandPrompt()` 注入。
- 安全规则当前只有 10 条且 UI 只显示 id/label，需要扩展规则库并展示描述/示例/处理方式。


## 2026-05-28 UI/交互决策
- 设置弹窗扩大到 1080x820，避免微信群助手/记忆/黑名单内容挤在小区域里看不清。
- 群记忆管理采用左群列表、右详情结构；详情分为自动摘要、长期结论/知识、原始消息记录。
- 允许手动添加“本群长期记忆”，写入 Honcho conclusion；支持删除单条 conclusion；原始 message 不假装可单条删除，只支持清空整个本群 session。
- 安全规则以卡片展示 label/id/严重等级/说明/示例/安全替代方案，让用户能直观看到“到底限制了什么”。
- 保存群设置时保留过滤列表之外已勾选的群，避免用户搜索后保存导致其他群丢失。
