# Findings: WeChat Group Full Archive, Stats, Digest UI, and Reply Safety Fix

## Current request discoveries
- 用户看到的英文 `I did not actually call the required tool...` 来自主流程工具调用兜底逻辑，不应暴露给微信群。需要改为中文安全文案，并优先使用原始用户文本判断是否真的需要工具。
- 群记忆展示目前容易让用户误以为“长期记忆不存在”：需要把群长期记忆、成员长期记忆、原始聊天记录、统计数据明确分区展示。
- 用户需要记录全量群消息，不只是 @ 消息；现有 Wechaty/ClawBot 已经有部分 archive/record 调用，但缺少独立统计表、排行 API、定时发送调度和可视化设置。

## 2026-05-28 code audit
- `src/index.js` 的兜底分支在 `requiresToolForUserMessage(input)` 上判断；微信群入队的 `input` 是构造后的完整 prompt，里面必然包含“文件/链接/读取”等安全说明，所以会把普通群聊误判成“需要工具但没调用”，再把英文协议文本发出去。
- `src/social/wechaty-duty-group.js` 和 `src/social/wechat-clawbot.js` 入队 social 元数据没有保存 `user_text`，主流程无法区分原始用户消息和 prompt。
- `src/social/wechat-group-memory.js` 的成员记忆读取主要依赖 `session.peers()`；如果 session 初始缓存时未带成员 peer，或 Honcho peers 列表没返回成员，就会导致“成员长期记忆”区域为空。可从消息 metadata 的 `sender_id/sender_name` 反推成员 peers。
- `src/social/wechat-groups.js` 已经有 `archiveWeChatGroupMessage()` 和抽取式总结，但没有独立统计表、媒体类型清洗、排行聚合、定时摘要配置和调度。

## 2026-05-28 v0.4.1 follow-up
- 用户指出 v0.4.0 的定时总结默认所有已接入群都可能发送，不符合人类使用逻辑。修正为必须在“统计/定时总结群组”里手动勾选并保存，未选择则不统计、不定时发送。
- 统计数据不是 Honcho 数据；它存入本机 SQLite 表 `wechat_group_activity`，Honcho 群记忆管理显示的是 Honcho session / conclusions。需要在 UI 显式说明并展示最近统计记录。
- 成员长期记忆只有结论存在时才显示，导致用户看不到入口；应固定显示空状态，解释何时会出现成员记忆。
