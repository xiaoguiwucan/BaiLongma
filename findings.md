# 排查发现

待记录。

## 初步关键发现（2026-05-27）

1. 当前 `src/social/wechaty-duty-group.js` 的 `createWechatyPuppet()` **优先创建了 `wechaty-puppet-wechat` 的 `PuppetWeChat`**，并指定本机 Google Chrome：
   - `activePuppetName = 'wechaty-puppet-wechat'`
   - `head: true`
   - `launchOptions.executablePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'`
2. 这会启动浏览器/网页微信链路，所以用户看到“网页版登录微信”。这不是原先的 `wechaty-puppet-wechat4u` 优先链路。
3. 当前文件仍保留了 `PuppetWechat4u`，但只作为 `PuppetWeChat` 创建失败后的 fallback；只要 Chrome puppet 构造成功，就不会用回原来的 wechat4u。
4. 当前 `package.json` 新增了 `wechaty-puppet-wechat` 依赖；这就是“变成网页版登录”的直接依赖变化。
5. 需要继续确认：保存群配置是否还会重启、UI 是否反复触发 start/list，运行态是否被空 rooms 覆盖，以及 Honcho 初始化是否阻塞消息链路。
6. 运行态接口现在确认：`/social/wechaty-duty-group/status` 返回 `status:error`、`error:"Timeout after 5000 ms"`、`puppet:"wechaty-puppet-wechat"`，说明当前失败发生在 Chrome/Puppeteer 版 puppet 启动阶段。
7. `~/Library/Application Support/Bailongma/logs/startup.log` 明确显示 `Puppet<PuppetWeChat>`、`there is no WechatyBro in browser(yet)`、`Navigation failed because browser has disconnected!`，这是网页微信/Chrome puppet 的失败栈，不是 Honcho 失败栈。
8. 当前 App Support 配置里运行态 `lastError` 也是 `Timeout after 5000 ms [wechaty-puppet-wechat]`。
9. 日志时间线显示：在 2026-05-27 17:xx～21:xx 之间，`wechaty-puppet-wechat4u` 其实可以扫码、登录、接入群、收到 @、调用 LLM 并发送群回复；失败点主要是之后底层 `-1 == 0` / `batchGetContact` 定时器异常导致掉线循环。
10. 2026-05-27 22:19 之后才出现 `Puppet<PuppetWeChat>`、`WechatyBro`、Chrome 断开的日志，和用户说“变成网页版登录”完全对应。
11. 代码已改回固定使用 `wechaty-puppet-wechat4u`，移除 `PuppetWeChat` 导入和 Chrome puppet 创建逻辑；同时新增 `BailongmaPuppetWechat4u` 包装类，拦截 logout 自动 start 循环和 stop 后 `batchGetContact` 空对象异常。
12. 运行态状态现在会优先保留上次真实 rooms / roomIds / loginUser，不会因为 stop/start/error 的空列表把设置页群列表完全清空。
13. 另一个关键差异：`src/social/index.js` 曾被改成“如果 ClawBot 有凭证就不自动启动 Wechaty”。但用户已确认 ClawBot/iLink 只能私聊，群聊必须走 Wechaty；这个判断会导致应用启动后微信群助手不在线。已改为：只要微信群助手启用，启动时就启动 Wechaty；ClawBot 仅作为私聊通道并行存在。
14. 已从 `package.json/package-lock.json` 卸载 `wechaty-puppet-wechat`，避免以后误切回 Chrome/网页微信 puppet。当前依赖只保留 `wechaty` + `wechaty-puppet-wechat4u`。
15. 新发现：后台/nohup 启动后 Electron 会因 stdout/stderr 管道断开出现 `write EPIPE`，原来的 `uncaughtException` 处理又继续 `console.error`，形成 EPIPE 递归刷屏并退出。已在 `electron/main.cjs` 加 stdout/stderr error 监听和 EPIPE 熔断：一旦终端管道断开，只写文件日志，不再向断开的 stdout/stderr 写。
16. 继续深挖后确认另一个 UI/状态问题：`listWechatyDutyGroupRooms()` 在 `qr_ready` 未扫码状态也会调用 `Room.findAll()` 并返回 `ok:true, rooms:[]`，前端看到 `ok:true` 就会把缓存群列表覆盖为空，还显示“已连接/已刷新”，造成用户感觉“退出设置再进来列表消失/状态虚假”。已改为只有 `logged_in/connected` 才刷新真实群列表；未登录/等待扫码时返回 `ok:false` 并保留上次快照。
17. `/social/wechaty-duty-group/start` 原来每次点“登录/恢复微信”都会 configure + start；虽然 connector 内部会挡一部分，但状态为 `qr_ready/starting/logged_in/connected` 时 API 层仍应直接返回当前状态，避免重复 start 干扰扫码会话。已加 `already_running` 防抖。
18. 前端也修正：无真实 rooms 时不再清空已配置群名；`rooms` 刷新只有在线状态才显示“已连接”，避免把 QR/未登录状态误导成已连接。
19. 用户扫码保存后 @ 无响应的直接原因已确认：15:44:31 Wechaty 登录成功并接入 3 个群；15:44:34 随即出现 `-1 == 0`，旧逻辑调用 `scheduleReconnect('error')`，15 秒后 stop/restart，15:44:49 退出登录并回到二维码。所以后续 @ 时连接已经离线，程序没有入站消息。
20. 已修复：登录成功且已解析到群后，`-1 == 0` / `400 != 400` / `batchGetContact` 这类 wechat4u 底层同步暂态错误只记录警告并保持 `connected/logged_in`，不再主动重启；同时增加每条允许群消息的接收日志和文本 @ 登录名兜底识别，方便判断是没收到还是 @ 判断失败。

21. 2026-05-28：确认微信群“没叫我，跳过”不是入站 @ 失败，而是 Wechaty 已给出 mention=true 后，大模型又按文本昵称二次判断导致误判；修复为只信任 mentionSelf 元数据，并在 send_message/LLM/fallback 三层拦截错误跳过回复。
