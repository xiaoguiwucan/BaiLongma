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


## 2026-05-28 v0.4.3 follow-up
- 用户需要看到“所监控群所有聊天内容入库”，因此统计摘要之外必须提供记录库分页列表，明确显示总条数、完整时间、昵称和筛选条件。
- 旧统计数据只有 Wechaty 内部 sender_id，当前 DB 没有可反推真实昵称的历史表；可靠方案是新增 `wechat_group_member_names` 映射，并在 Wechaty 真正在线、刷新群成员或收到新消息时逐步补齐。
- 媒体不能用任意本机文件路径暴露给 UI；记录库只记录保存到 app data 下的相对媒体路径，API 读取时必须拒绝绝对路径和 `..`。
- `datetime-local` 只有分钟，作为结束时间直接字符串比较会漏掉同一分钟后半段记录；需要补 `:59`。
- 图片/表情/链接消息可能被归类为 `mixed`，筛选不能只查 `message_type=image`，应该查计数列。

## 2026-05-28 v0.4.4 nickname findings
- Wechaty 状态已真实 online，但旧昵称逻辑只成功写入扫码账号自己；`room.memberAll()`/`room.alias()` 对“值班群”等群无法稳定返回成员昵称。
- wechat4u `batchGetContact([{UserName: roomId}])` 能返回群 `MemberList` 的 `NickName`/`DisplayName`；直接拉取后可识别 3 个接入群共 59/59 个成员。
- 重新扫码后微信群 room_id 会变化，不能把统计唯一绑定到 `wechaty:@@...`；统计查询和入库选择需要按群名兜底合并。

## 2026-05-28 v0.4.5 new findings
- 多人 @ 被吞的根因是 `src/queue.js` 会按 `(fromId, channel)` 删除同一群尚未处理的旧 user 队列项；Wechaty 群 @ 使用同一个 `fromId=wechaty:room:<room.id>`，所以同群后来的 @ 会覆盖先来的 @。
- 管理员权限必须以 Wechaty `sender_id` 精确匹配，不能用昵称/群备注/自称；否则群成员改名或提示词注入就能越权。
- 当前统计页只渲染一个 active 群，多个统计群已选择时用户无法知道排行榜属于哪个群；需要单群标题和多群总览，且排行榜行内带群名。
- 榜单不自动更新主要是前端只在进入设置或手动点击时刷新；后端消息入库已按已选群统计，需要 UI 轮询或 SSE 触发刷新。
