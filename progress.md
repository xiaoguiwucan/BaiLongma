# 排查进度

- 2026-05-27：开始排查 Wechaty 前后差异。
- 2026-05-27：确认当前代码优先使用 `wechaty-puppet-wechat` + 本机 Chrome，导致出现网页版微信登录；原 wechat4u 被降级为 fallback。
- 2026-05-27：通过状态接口和 startup.log 证实当前崩溃点是 `wechaty-puppet-wechat` 的 Chrome bridge 启动/断开，非 Honcho 本身。
- 2026-05-27：完成第一轮修复：固定回 wechat4u，禁用 Chrome 网页 puppet；补丁化 wechat4u 的 logout 自动重扫和 batchGetContact 定时器异常；保留运行态群列表。
- 2026-05-27：修复启动逻辑：不再因 ClawBot 已登录而跳过 Wechaty 群助手。
- 2026-05-27：卸载 `wechaty-puppet-wechat`，代码导入检查通过。
- 2026-05-27：前台启动验证通过：日志出现 `Wechaty 请扫码登录...` 的终端二维码，未再出现 `Puppet<PuppetWeChat>`；说明已回到 wechat4u 链路。
- 2026-05-27：修复后台启动掉线：处理 Electron console 输出的 EPIPE，防止 nohup/关闭终端后主进程退出。
- 2026-05-27：EPIPE 修复后后台运行 30+ 秒仍可访问 `/status`，进程保持；`/social/wechaty-duty-group/status` 显示 `qr_ready` 且 `puppet=wechaty-puppet-wechat4u`。
- 2026-05-27 23:05：重新接手排查。当前进程在线，`/status` 正常；`/social/wechaty-duty-group/status` 返回 `qr_ready`，且 `puppet=wechaty-puppet-wechat4u`，说明“网页 Chrome puppet”已被当前代码修回 wechat4u。但仍需查 UI 保存/退出设置后掉线、群列表消失、登录状态不真实的问题。
- 2026-05-27 23:22：修复设置页状态保持逻辑：未扫码/未登录时不再用空群列表覆盖快照；开始按钮增加运行态防抖；前端避免在没有真实 rooms 时显示“已连接”。语法检查通过。
- 2026-05-27 23:36：验证发现 `nohup npm start` 在当前自动化会话里可能随会话结束被清掉，导致 API 短暂可用后消失；改启动脚本为 macOS `open -n Electron.app --args <项目路径>` 脱离式启动，并验证 30 秒后进程/API/Wechaty QR 仍在线。
- 2026-05-27 23:39：用改后的 `start-jarvis-background.sh` 重新启动并验证：脚本改用 `open -n Electron.app --args`，18 秒后 API 正常，Wechaty 状态为 `qr_ready`，rooms 未登录时返回 409/保留状态，不再假装已连接。
- 2026-05-27 23:54：定位扫码后无响应根因：登录接入群后 wechat4u 抛 `-1 == 0`，旧逻辑主动重连导致退出登录。已改为连接后忽略该类暂态错误，并增加群消息接收日志/@文本兜底。
