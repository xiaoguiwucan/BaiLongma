
## v0.4.25 - 2026-05-28

### 修复
- 修复微信群斗图发送时先显示图片/GIF URL 链接的问题：现在默认隐藏 URL 文本，只直接发送图片或 GIF。
- 如果 AI 回复内容只有表情包 URL，则不再发送任何文字气泡。
- 如果 AI 同时写了自然语言说明和表情图，则只发送说明文字 + 图片，不暴露链接。
- 优化图片/GIF发送速度，图片发送改为并发投递并统计成功数量。

### 验证
- 通过 node --check。
- 通过 npm run test:wechat-record-all。
- 通过 npm run test:wechat-guard。

## v0.4.24 - 2026-05-28

### 新增
- 新增 AI 斗图表情包能力，接入慕名 API / xiaoapi 表情搜索接口。
- 新增 meme_search 工具，AI 可按“斗图、表情包、梗图、无语、鄙视、笑死、吃瓜”等请求搜索公开网络图片/GIF。
- 新增微信群助手「AI 斗图表情包」设置区，可开启/关闭、选择表情源、设置每次发送数量、冷却时间，并支持关键词测试预览。

### 安全与边界
- 仅发送 HTTPS 公开网络图片/GIF，不做微信原生表情包收藏/表情商店能力。
- 默认只允许 biaoqing.gtimg.com、tugelepic.mse.sogou.com 两类表情图域名。
- 继续禁止读取、上传、转发或描述本机文件、桌面图片、截图、相册、file:// 路径。
- API 失败时返回错误给 AI，不阻塞正常文字回复。

### 验证
- 已验证 xiaoapi meme 搜索“鄙视”可返回 GIF 图片。
- 通过 npm run test:wechat-record-all。
- 通过 npm run test:wechat-guard。

## v0.4.23 - 2026-05-28

### 修复
- 新增微信群助手掉线检测机制：登录态恢复超时、logout、连接错误、健康检查失败会自动标记为离线。
- 新增掉线提醒：离线后通过系统通知/窗口提示/SSE 状态事件提醒用户重新扫码。
- 设置页状态改为真实显示：缓存群明确显示为“不可接收 @ 消息”，不再误导为在线。
- 后端状态接口新增 connection_state 与更准确的 needs_relogin，便于前端和用户判断真实可用性。

### 说明
- 只有 online=true 且 connected 且当前进程真实解析到群，才显示“已真实连接”。
- 微信掉线后不会再把历史群缓存当作可用群消息通道。

## v0.4.22 - 2026-05-28

### 修复
- 修复微信群列表重复显示的问题：同一个微信群在 Wechaty 重新登录后可能产生多个历史 room_id，现在按群名归并，只显示一个真实群。
- 修复重复群影响微信助手 @ 回复设置、群统计与定时总结、Honcho 群记忆管理、聊天记录群选择等页面的问题。
- 已识别群接口保留 historical_ids/duplicate_count 供排查，但 UI 不再展开历史旧 ID。

### 说明
- 新增群仍不会自动开启 @ 回复，需要在微信助手中手动勾选并保存，避免误回复。

# Bailongma Windows Release Flow

## Current Version

- `0.4.21`

## What This Release Includes

- v0.4.21 统一新增微信群显示来源：合并 Wechaty 缓存群、成员库和聊天记录库，避免新群在不同设置模块里显示不一致。
- v0.4.20 修复 Honcho 离线影响 LLM 设置：本地 Docker/Honcho 未启动时群记忆降级跳过，LLM 模型编辑、设默认、删除不再被拖垮。
- v0.4.19 优化微信群管理员设置：用户界面显示/搜索微信昵称，点击成员昵称卡片添加；后台仍按精确 sender_id 授权。
- v0.4.18 修复微信群发送失败和多人 @ 堵塞：真实 sender_id 目标进入本轮发送白名单，避免 target 校验失败；短时间多条 Wechaty 群 @ 默认最多 3 条并行处理。
- v0.4.17 修复微信群 @ 错人、管理员设置丢失和管理员保护：底层强制使用真实 sender_id；管理员勾选不再被轮询清掉；支持昵称搜索添加管理员；普通群友暗算管理员会被回怼。
- v0.4.16 修复微信群回答不查聊天记录库导致“记不完整”：@ 回复时从当前群 `wechat_group_activity` 检索相关历史消息并注入证据，优先基于数据库回答。
- v0.4.15 修复微信群聊天记录页“不更新”：新增查看群组下拉框；默认结束时间自动跟随当前时间；设置页自动刷新聊天记录；摘要显示当前查看群和 DB 最新入库时间。
- v0.4.14 修复微信群重复回复/内部结束语外发：微信群 @ 成功发送一条后立即结束；拦截“已回复/回复完毕/本轮结束”等内部状态；已回复后超时不再重排队。
- v0.4.13 清理后台内部 skip 日志显示：记忆识别/整合内部工具不再输出工具调用日志；TICK 仅调节节奏/界面时不再进入记忆识别。
- v0.4.12 彻底修复后台一直“跳过识别/跳过整理”：内部记忆工具作为终止协议后立即结束，不再循环刷屏/熔断；TICK 空闲心跳不再进入记忆识别；前端隐藏内部记忆工具。
- v0.4.11 修复一直“跳过识别”不回复：主对话不再注入记忆识别/整理内部工具，真实微信群 @ 消息不会被 `skip_recognition` 跳过。
- v0.4.10 Wechaty 启动卡住自恢复修复：启动 60 秒没有二维码/登录/真实在线状态时自动重启连接；手动“登录/恢复微信”也会修复假 starting。
- v0.4.9 微信群聊天记录库持续入库修复：原始聊天流水不再受“群统计与定时总结”勾选项影响，只要程序运行且收到群消息就写入本机 SQLite。
- v0.4.8 微信群 @ 回复目标链路热修复：分发层正确解析 `wechaty:room:<room>:member:<member>`，发送时使用真实 room_id，并把 member_id 作为兜底 @ 对象。
- v0.4.7 微信群 @ 回复对象修复：按当前提问人的 sender_id / sender_name 精确 @，避免回复错人。
- Windows NSIS installer
- GitHub Releases auto-update metadata
- First-run activation flow
- Uninstall clears `%APPDATA%\Bailongma`
- Branded installer assets:
  - `build/icon.ico`
  - `build/installerHeaderIcon.ico`
  - `build/installerSidebar.bmp`
  - `build/uninstallerSidebar.bmp`

## Local Build

```powershell
cd D:\claude\BaiLongma
npm install
npm run build
```

Installer output:

- `D:\claude\BaiLongma\dist\Bailongma Setup 0.4.21.exe`
- `D:\claude\BaiLongma\dist\latest.yml`

## Local Verification Checklist

1. Install `Bailongma Setup 0.4.21.exe`.
2. Launch the app and confirm the activation page appears on first run.
3. Enter a valid API key and verify the app enters `brain-ui`.
4. Uninstall the app.
5. Reinstall and confirm activation is required again.
6. After activation, confirm the composer is briefly disabled while the model warms up.

## Publish To GitHub Releases

1. Commit and push the release commit.
2. Ensure `package.json` version matches the release version.
3. Create a GitHub personal access token with `repo` permission.
4. Set the token in the current shell.

```powershell
cd D:\claude\BaiLongma
$env:GH_TOKEN = "ghp_your_token"
npm run publish
```

Published artifacts:

- GitHub Release asset: `Bailongma Setup 0.4.21.exe`
- GitHub Release asset: `latest.yml`
- GitHub Release asset: `Bailongma Setup 0.4.21.exe.blockmap`

## Notes On First Launch Of The Installer

Unsigned Windows installers can feel inconsistent on first open because Windows Defender or SmartScreen may scan them before showing UI.

To reduce that friction:

- Prefer testing the installer copied out of the build folder, not while another tool is still touching it.
- Wait a moment after the build finishes before double-clicking.
- For public releases, code-signing is the real long-term fix.

## Version Bump Checklist

1. Update `package.json`.
2. Update `package-lock.json`.
3. Build to `dist`.
4. Verify install, activation, uninstall, and reinstall.
5. Publish to GitHub Releases.
