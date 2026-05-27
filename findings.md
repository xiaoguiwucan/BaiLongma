# Findings: WeChat Group Assistant False Online / Re-login Fix

## Runtime inspection
- 当前 127.0.0.1:3721 由 Electron 进程监听，后端还在运行。
- 原状态接口同时返回 `status: logged_in`、`online: true`、`login_user: 前夜`，但也返回 `error: 400 != 400` 和旧的 `last_room_refresh_at`。
- 日志持续出现“本次未获取到群列表，保留上次真实群列表”，说明当前连接不能证明能收群消息。
- 结论：这是“历史登录态/历史群快照被误当成当前在线”的问题。

## Code root cause
- `isLoginActive()` 把 `logged_in` 也算作 online；但 `logged_in` 只表示 login 事件发生，不代表群消息通道健康。
- `getWechatyDutyGroupStatus()` 之前用 `online: isLoginActive()`，导致 UI 显示假在线。
- `listWechatyDutyGroupRooms()` 在 `Room.findAll()` 返回空数组时仍 `ok:true` 并返回旧 `roomSnapshot`，导致 UI 写“群列表已刷新”。
- `/start` 在非 idle/error/disconnected 状态直接 `already_running`，坏登录态下用户无法重新扫码。

## Additional root cause: MemoryCard not loaded
- 当前 Wechaty 版本的 `WechatyBuilder` 不消费 `memory` 选项。
- `WechatySkeleton.init()` 实际只使用 `new MemoryCard(this.__options.name)`。
- 之前传 `memory: createWechatyMemoryCard()` 但 `name` 仍是普通字符串，导致空登录态启动时触发 `no payload, please call load() first.`。
- 修复为 `WechatyBuilder.build({ name: WECHATY_MEMORY_NAME, puppet })` 后，重启可进入 `qr_ready` 并生成二维码。
