# Progress Log

- 2026-05-28: 用户截图显示设置页为“已登录：前夜。群列表已刷新”，但实际群里 @ 无回复，怀疑是假状态且缺少重新扫码入口。
- 已确认当前不是单纯 UI 问题：后端状态同时给出 `logged_in/online:true` 与 `400 != 400/旧群列表`。
- 已修改状态判定：只有真实 connected、当前进程解析到目标群且最近刷新/收到消息才 `online:true`。
- 已修改 rooms 接口：没有真实群列表时返回失败并标记 `rooms_stale:true`。
- 已新增设置页“强制重新扫码”按钮。
- 已修复 Wechaty MemoryCard 传参：改用 `name: WECHATY_MEMORY_NAME`。
- 本地验证：重启后 `/social/wechaty-duty-group/status` 返回 `status: qr_ready` 且包含二维码；同时 `online:false`，不再假在线。
