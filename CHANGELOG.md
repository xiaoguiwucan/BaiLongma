# 更新日志

所有重要版本都需要在这里写清楚：版本号、日期、改动内容、部署/备份注意事项。以后每次升级版本，必须同步更新 `package.json`、`package-lock.json`、`README.md`、`BACKUP-YYYY-MM-DD.md` 和 Brain UI 设置页里的更新说明。



## v0.4.1 - 2026-05-28

### 修复内容

- 群统计与定时总结新增“选择参与统计/定时总结的群组”区域。
- 未在该区域手动勾选并保存的群，不会写入本地统计库，也不会自动发送阶段总结或每日统计，避免误发到所有群。
- 定时总结调度现在只遍历 `wechatGroupDigest.selectedGroups` 中的群组；没有选择群时直接跳过。
- Wechaty/ClawBot 收到群消息时，只有命中已选择统计群组才写入 `wechat_group_activity`。

### 数据可见性

- 统计面板新增“统计数据位置”说明：群统计数据存放在本机 SQLite `data/jarvis.db` 的 `wechat_group_activity` 表。
- 统计面板新增“本地统计库最近记录”，可直接看到最近写入的统计消息、类型和图/表情/链接/装逼计数。
- 明确 Honcho 群记忆管理显示的是 Honcho session/长期结论，不是本地统计表，所以两个区域的数据不会完全一样。

### Honcho 记忆展示

- Honcho 详情页固定显示“群组长期记忆”和“成员长期记忆”两个分区，即使暂无结论也显示空状态说明。
- 历史英文内部协议误回复在 Honcho 原始消息展示和上下文注入中被隐藏，避免继续污染群记忆和模型上下文。

### 验证结果

- `node --check src/config.js` 通过。
- `node --check src/social/wechat-group-stats.js` 通过。
- `node --check src/social/wechat-group-digest.js` 通过。
- `node --check src/social/wechat-group-memory.js` 通过。
- `node --check src/social/wechaty-duty-group.js` 通过。
- `node --check src/social/wechat-clawbot.js` 通过。
- `node --check src/ui/brain-ui/app.js` 通过。
- `node --check src/ui/brain-ui/app-shell.js` 通过。
- `npm run test:wechat-guard` 通过。
- `npm run test:wechat-memory` 通过。
- `git diff --check` 通过。

### 部署注意事项

- 更新后重启白龙马/Electron。
- 进入 `设置 -> 微信群助手 -> 群统计与定时总结`，先勾选要统计/要发总结的群，再点击“保存总结设置”。
- 保存后，后续新收到的群消息才会进入统计；升级前或保存前的消息不会自动补录。


## v0.4.0 - 2026-05-28

### 大版本更新：微信群全量统计与定时总结

- 新增微信群全量活动统计，不再只关注 @ 助手的消息：所有已接入群里的文字、图片、表情/表情包、链接/小程序都会写入专用统计表。
- 新增 5 类排行榜：发言排行榜、发图排行榜、表情排行榜、链接排行榜、装逼排行榜。
- “装逼排行榜”采用启发式关键词统计（如“拿捏/吊打/遥遥领先/不是我吹/基操/凡尔赛”等），用于群娱乐统计，不作为严肃评价。
- 新增定时总结调度：支持阶段总结（30 分钟/1 小时/3 小时/6 小时/12 小时/每天一次）和每日 00:00 群聊日报。
- 定时总结写入去重表，避免同一个群同一个时间段重复发送。
- 支持设置页手动“立即发本群总结”，方便验证群消息通道和日报内容。

### 设置页可视化

- 微信群助手页新增“群统计与定时总结”面板。
- 可视化配置：启用/关闭自动总结、选择阶段总结间隔、设置每日统计时间、分别开关发言/发图/表情/链接/装逼排行榜。
- 当前群展示今日统计卡片：消息数、参与人数、图片、表情、链接、装逼次数。
- 当前群展示排行榜卡片，排版与现有 Brain UI 暗色玻璃风格保持一致。

### 稳定性与安全修复

- 修复微信群里偶发回复英文内部协议文本 `I did not actually call the required tool...` 的严重问题。
- 主循环兜底现在使用微信群原始 `user_text` 判断是否真的需要工具，不再用构造后的完整 prompt 误判。
- 即使模型输出内部工具协议文本，也会替换为中文安全兜底，不再把内部执行状态暴露到群里。
- Wechaty / ClawBot 入队时都会携带原始用户文本，方便主流程做正确兜底判断。
- 群消息统计写库失败不会中断微信群 @ 回复主流程。

### Honcho 成员记忆展示修复

- Honcho 成员长期记忆读取不再只依赖 `session.peers()`；会从群消息 metadata 的 `sender_id / sender_name` 反推当前群成员 peer。
- 成员长期记忆区域更稳定，适合查看“某成员在某群里的称呼、偏好、身份”等按群隔离记忆。
- 对图片/表情/XML 结构化消息做展示清洗，设置页不再被大段微信 XML 污染。

### 验证结果

- `node --check src/social/wechat-group-stats.js` 通过。
- `node --check src/social/wechat-group-digest.js` 通过。
- `node --check src/index.js` 通过。
- `node --check src/config.js` 通过。
- `node --check src/api.js` 通过。
- `node --check src/social/index.js` 通过。
- `node --check src/social/wechaty-duty-group.js` 通过。
- `node --check src/social/wechat-clawbot.js` 通过。
- `node --check src/social/wechat-group-memory.js` 通过。
- `node --check src/ui/brain-ui/app.js` 通过。
- `node --check src/ui/brain-ui/app-shell.js` 通过。
- `npm run test:wechat-guard` 通过。
- `npm run test:wechat-memory` 通过。
- `git diff --check` 通过。

### 部署注意事项

- 更新后重启白龙马/Electron。
- 进入 `设置 -> 微信群助手`，确认上方群组已勾选并保存。
- 在“群统计与定时总结”中按需要开启阶段总结、每日统计和排行榜项；默认每日统计时间为 `00:00`。
- 群消息统计只记录白龙马真实接入后收到的消息；升级前历史群聊不会自动补录。


## v0.3.10 - 2026-05-28

### 修复内容

- 修复微信群助手性格预设点击后自动跳回“自定义性格”的问题：状态轮询不再用缺失的 `personaPrompt` 覆盖当前编辑区。
- 性格设定区域新增独立按钮“保存性格并生效”，不再要求用户回到上方找总保存按钮。
- 保存性格时会同步保存 `personaPresetId`，保存成功后状态条立即显示当前性格“已生效”。
- 保留上方“保存并生效”用于群组选择；性格区按钮专注保存性格，交互更直观。

### 记忆展示增强

- Honcho 群记忆详情拆分为“群组长期记忆”和“成员长期记忆”两个独立区域。
- 成员长期记忆说明为：仅在当前微信群内对对应成员生效，会和群组记忆一起参与匹配，但不会串到其他群。
- 成员记忆卡片使用独立样式，便于区分“本群公共规则”和“某个群成员的称呼/身份偏好”。

### 改变原因

- 用户反馈点击“幽默社交助手”等预设后会自动跳到自定义性格，这是轮询覆盖造成的真实 bug。
- 用户反馈性格区缺少明显保存按钮，保存后需要立即看出已生效。
- 用户要求新增的成员记忆必须和群组记忆一样可视化展示，并明确它仅在当前群组内可用。

### 验证结果

- `node --check src/ui/brain-ui/app.js` 通过。
- `node --check src/ui/brain-ui/app-shell.js` 通过。
- `npm run test:wechat-guard` 通过。
- `npm run test:wechat-memory` 通过。
- `git diff --check` 通过。

### 部署注意事项

- 更新后重启白龙马/Electron。
- 进入 `设置 -> 微信群助手`，点击任一性格卡片后应保持在该卡片并显示“待保存”；点击“保存性格并生效”后应显示“已生效”。
- 在 Honcho 群记忆管理里刷新某个群，应能分别看到群组长期记忆和成员长期记忆。


## v0.3.9 - 2026-05-28

### 新增/修复

- Wechaty 群回复现在会识别公开网络图片 URL 和 Markdown 图片，例如 `![meme](https://example.com/a.webp)` 或 `https://example.com/b.jpg`，并用 `FileBox.fromUrl` 作为图片发送到微信群。
- 出站发送前新增本机文件引用拦截：如果回复内容包含 `file://`、`/Users/`、`~/`、Windows 本地盘符、桌面/下载/相册/截图等本地文件语义，会直接拒绝发送，避免把本机文件或路径发到群里。
- 图片发送只允许 `http/https` 且后缀为 png/jpg/jpeg/gif/webp 的公开网络图片，单条最多发送 3 张。
- `test:wechat-memory` 增加公开网络图片 URL 提取测试。

### 验证结果

- `node --check src/social/wechaty-duty-group.js` 通过。
- `npm run test:wechat-memory` 通过。
- 完整 v0.3.8 检查集继续通过。

### 部署注意事项

- 更新后重启白龙马/Electron。
- 公开网络图片可以作为图片发送；本机文件、桌面图片、截图、相册、file:// 路径仍会被拒绝。


## v0.3.8 - 2026-05-28

### 新增内容

- 微信群 prompt 增加网络梗提示：`v我50 / V我50 / vw50 / 疯狂星期四` 会按中文互联网梗理解，不再误判成站点、种子编号或需要查文件。
- 明确微信群媒体边界：允许理解、搜索和发送公开网络图片/表情包链接；禁止读取、上传、转发或描述本机文件、桌面文件、file:// 路径、截图、相册和私有图片。
- 性格设定 UI 新增明显的“当前生效性格 / 已生效 / 有未保存修改”状态条，并加入“自定义性格”卡片。
- 配置中保存 `personaPresetId`，设置页能区分正在使用预设还是自定义提示词。
- 新增群成员显式记忆抽取：当群成员 @ 助手说“以后叫我大哥 / 我是你大哥 / 我叫xxx”时，会即时写入 Honcho 成员记忆和群组记忆。
- 新增 `npm run test:wechat-memory`，覆盖称呼/身份记忆抽取与网络梗提示。

### 修复/改进

- 避免“谁是你大哥”这类后续问题只能依赖异步 Honcho 总结；现在明确称呼/身份偏好会同步写入长期结论。
- 群聊回复更适合接梗：遇到 vw50 这类短梗时会优先轻松接话，而不是要求对方补充站点信息。
- 安全黑名单补充本机图片外发表达：例如“把本机图片发群里”“上传桌面图片给大家”会被拒绝；但“找一张公开网络表情包链接”允许。

### 改变原因

- 用户反馈群友说网络梗时助手不理解，例如 `vw50` 被误判成需要查询站点/图片信息。
- 用户要求图片能力边界更符合人类使用：可以发网络找到的图和表情包，但不能向微信群发送任何本机文件。
- 用户反馈性格设定不够明显，不知道当前到底哪个性格生效。
- 用户反馈已有记忆系统仍不能记住“叫我大哥”这类明确指令，需要即时、按群隔离、按成员分类写入长期记忆。

### 验证结果

- `node --check src/config.js` 通过。
- `node --check src/api.js` 通过。
- `node --check src/social/wechat-groups.js` 通过。
- `node --check src/social/wechat-group-memory.js` 通过。
- `node --check src/social/wechat-memory-extractor.js` 通过。
- `node --check src/social/wechaty-duty-group.js` 通过。
- `node --check src/social/wechat-clawbot.js` 通过。
- `node --check src/ui/brain-ui/app.js` 通过。
- `node --check src/ui/brain-ui/app-shell.js` 通过。
- `npm run test:wechat-guard` 通过。
- `npm run test:wechat-memory` 通过。
- `git diff --check` 通过。

### 部署注意事项

- 更新后重启白龙马/Electron。
- 进入 `设置 -> 微信群助手`，性格设定区域会显示当前生效性格；编辑后如果没保存会显示“有未保存修改”。
- 在微信群测试：`@助手 今天vw50` 应按梗回复；`@助手 以后叫我大哥` 后，再问 `@助手 谁是你大哥` 应优先从当前群 Honcho 记忆回答。
- 网络图片/表情包可以用公开链接；任何本机图片、桌面文件、截图、相册都不允许外发。


## v0.3.7 - 2026-05-28

### 紧急修复

- 修复微信群安全黑名单漏拦截“查看桌面有啥文件 / 桌面有啥文件 / 列一下下载目录 / 打开 xlsx 表格看看”这类本机文件盘点请求的问题。
- 新增 `local_file_inventory` 规则：禁止微信群成员远程查看、列出、读取、搜索或打开机主电脑上的桌面、下载、文档、项目目录和具体文件。
- 新增 `local_system_inventory` 规则：禁止微信群成员远程盘点机主电脑的系统版本、软件列表、窗口、进程、网络、硬件或运行状态。
- 扩展凭证规则，补上“把 .env 发群里”这类敏感对象在前、发送动作在后的表达。
- ClawBot 群聊路径也接入同一个安全守卫，避免只有 Wechaty 路径拦截、另一路径绕过。

### 改变原因

- 用户截图显示，群成员 @ 后要求“查看桌面有什么文件”，助手没有触发安全黑名单，反而回复了疑似本机桌面文件列表。
- 原规则覆盖了删除、执行命令、上传隐私、读取密钥等高危动作，但没有把“只查看/列目录/盘点本机文件”单独归为禁止行为，这是致命遗漏。

### 验证结果

- `node scripts/test-wechat-command-guard.mjs` 通过。
- `npm run test:wechat-guard` 通过。
- `node --check src/social/wechat-command-guard.js` 通过。
- `node --check src/social/wechat-clawbot.js` 通过。
- `node --check src/social/wechaty-duty-group.js` 通过。
- `git diff --check` 通过。

### 部署注意事项

- 更新后必须重启白龙马/Electron，让微信群监听进程加载新的安全规则。
- 重启后在微信群测试 `@助手 查看桌面有啥文件`，应该直接回复安全拒绝，不应进入大模型自由回答。
- 本次修复不影响正常的群聊问答、技术讨论、群总结、群知识库写入。


## v0.3.6 - 2026-05-28

### 新增内容

- 微信群助手「性格设定」新增 3 个可视化预设卡片：主人数字分身、技术值班助手、幽默社交助手。
- 预设支持一键套用到提示词输入框，再由用户手动微调；点击预设不会立即改变线上行为，仍需点击“保存并生效”。
- 设置页新增“恢复默认”按钮，可快速回到默认主人数字分身风格。
- `/settings/social` 返回 `wechatyPersonaPresets`，前端动态渲染预设，后续扩展更多预设不需要改页面结构。

### 修复/改进

- 重新筛选用户提供的其他项目微信数字人提示词，移除不适用于当前项目的网页微信、wx.qq.com、DOM 读取、browser_evaluate、浏览器轮询发送、last_message_key 等流程描述。
- 预设提示词明确适配当前 Wechaty + Honcho 架构：@ 判断依赖 Wechaty 消息元数据，群记忆依赖 Honcho，不再引导模型使用浏览器脚本或旧项目 memory 流程。
- 预设中保留群聊短句、口语化、技术准确、文字表情、安全边界等有价值部分；危险电脑操作仍由安全黑名单强制兜底，性格设定不能绕过。
- UI 增加当前匹配状态：完全等于某个预设时显示“已套用”，手动改动后显示“自定义提示词”。

### 改变原因

- 用户希望把微信群助手性格设定做成几个可选预设，而不是每次手写大段提示词。
- 用户提供的参考提示词来自另一个通过网页微信 DOM 操作的项目，如果直接照搬会误导当前 Wechaty 版小白龙，所以本版本只保留人格、风格和安全边界，删除不适用执行流程。

### 验证结果

- `node --check src/config.js` 通过。
- `node --check src/api.js` 通过。
- `node --check src/ui/brain-ui/app.js` 通过。
- `node --check src/ui/brain-ui/app-shell.js` 通过。
- `node --check src/social/wechat-groups.js` 通过。
- `git diff --check` 通过。

### 部署注意事项

- 更新后重启白龙马/Electron，进入 `设置 -> 微信群助手`。
- 在「微信群助手性格设定」里点击一个预设，按需要修改文本，再点击“保存并生效”。
- 如果之前已经写过自定义性格，本版本不会自动覆盖；只有点击预设或恢复默认才会改输入框内容。
- 预设只影响回复风格和边界，不影响群组勾选、微信登录态、Honcho 记忆和安全黑名单。


## v0.3.5 - 2026-05-28

### 新增内容

- 新增微信群助手「性格设定」输入框：可在设置页手动填写微信群回复的人设、语气、边界和提示词，保存后会直接注入微信群大模型 prompt。
- 新增 Honcho 群记忆管理器：按微信群独立展示，不再只显示第一选中群的一小段预览。
- 群记忆详情分为三块：Honcho 原始消息记录、Honcho 自动摘要、Honcho 长期结论/知识。
- 支持手动给某个微信群添加一条长期记忆，写入 Honcho conclusion；适合写群规、值班要求、项目背景、群成员偏好等。
- 支持删除单条 Honcho 结论记忆，支持清空整个本群 Honcho session。原始消息不假装支持单条删除，因为当前 Honcho SDK 未公开单条 message delete。
- 扩展微信群安全隔离规则库到 17 类：文件破坏、批量文件改写、系统权限、终端执行、下载运行、凭证读取、隐私外传、网络上传、桌面/浏览器控制、摄像头麦克风屏幕、账号安全、支付金融、微信管理、群发骚扰、进程持久化、破坏性 Git、绕过安全等。
- 安全黑名单 UI 改为详细卡片，显示规则 ID、严重程度、解释、示例和安全替代方案；明确不包含逆向和成人内容过滤。

### 修复/改进

- Honcho 默认本地配置改为默认启用：没有显式关闭时使用 `http://127.0.0.1:8018` 与 `bailongma-local-honcho`，避免设置页显示配置了但后端不读。
- 群记忆 API 增加概览、详情、手动新增、删除结论、清空 session，并加本地/Token 访问校验，避免群聊记忆接口暴露给非本机来源。
- 设置弹窗扩大到 1080x820，微信群助手、Honcho 记忆和安全规则不再挤在过小区域里。
- 保存微信群选择时不再只读取当前搜索过滤后可见的 checkbox；过滤列表外已勾选的群会被保留，避免误取消。
- Honcho 写入群消息/助手回复后会主动 scheduleDream，帮助后台尽快沉淀长期结论。

### 改变原因

- 用户反馈“看不到记录记忆，Honcho 记忆库没有任何显示”，旧版只做了一个非常弱的单群预览，不能直观看到按群隔离的记忆状态。
- 用户要求微信群助手能手动设置性格/提示词，并且安全隔离限制词库要真正写完、开发完成、符合现有 UI。
- 用户明确要求不启用本地记忆兜底，因此本版本仍只使用 Honcho；如果 Honcho 没有数据，UI 会明确显示空状态，不会伪造本地记忆。

### 验证结果

- `node --check src/social/wechat-group-memory.js` 通过。
- `node --check src/social/wechat-groups.js` 通过。
- `node --check src/social/wechat-command-guard.js` 通过。
- `node --check src/api.js` 通过。
- `node --check src/config.js` 通过。
- `node --check src/ui/brain-ui/app.js` 通过。
- `node --check src/ui/brain-ui/app-shell.js` 通过。
- `git diff --check` 通过。
- 使用 Electron userData 配置启动临时 API 验证：`/settings/social` 返回 `personaPrompt` 和 17 条安全规则；`/social/wechat-groups/memory-overview` 能按真实群列表返回 Honcho 记忆概览；`值班群` 可读取到已有 Honcho 原始消息。

### 部署注意事项

- 更新后需要重启白龙马/Electron 才能加载新的设置页资源和 API。
- 进入 `设置 -> 微信群助手`：先确认微信登录状态，再查看下方「微信群助手性格设定」「Honcho 群记忆管理」「安全黑名单」。
- 群记忆只使用 Honcho：请确保本地 Honcho 服务仍运行在 `http://127.0.0.1:8018`。如果 Honcho 服务未运行，微信群 @ 回复仍可工作，但记忆管理会显示读取错误或空状态。
- 清空本群 session 会删除该群 Honcho 消息和自动记忆，不能撤销；使用前请确认选中的群名正确。


## v0.3.4 - 2026-05-28

### 修复内容

- 修复微信群助手“显示已登录，但群里 @ 无回复”的假在线问题。
- 状态接口不再把 `logged_in` 或历史群列表快照当作真实在线；只有当前进程真实接入群、最近刷新/收到消息时才返回 `online: true`。
- 群列表接口在没有获取到真实群列表时不再返回 `ok: true`；旧群列表只作为缓存展示，并标记 `rooms_stale: true`。
- 设置页新增“强制重新扫码”按钮：清空 Wechaty 登录态并重新生成二维码，用户不再卡在坏登录态里。
- 设置页文案和状态改为显示“真实在线 / 未确认在线 / 缓存群列表”，避免误导。
- 修复 Wechaty MemoryCard 传参问题：当前 Wechaty 版本不消费 `memory` 选项，改为把 `name` 直接设置为 userData memory 路径，确保空登录态可以正常生成二维码。
- 重连逻辑增加抑制窗口，避免手动停止/强制重登时旧 logout 事件马上触发自动重连。

### 改变原因

- 用户截图中显示“已登录：前夜，群列表已刷新”，但实际群里 @ 无回复。日志显示程序持续拿不到群列表，只是在保留历史快照。
- 旧 UI 把“历史登录用户 + 历史群列表”展示成了可用状态，导致用户无法判断是否真的接通。
- 旧登录态损坏时没有清空登录态/重新生成二维码入口，用户无法自助恢复。

### 验证结果

- `node --check src/social/wechaty-duty-group.js` 通过。
- `node --check src/api.js` 通过。
- `node --check src/config.js` 通过。
- `node --check src/ui/brain-ui/app.js` 通过。
- `node --check src/ui/brain-ui/app-shell.js` 通过。
- `git diff --check` 通过。
- 本地接口验证：`/social/wechaty-duty-group/status` 返回 `status: qr_ready` 且包含二维码；同时 `online: false`、`rooms_stale: true`，不再假装在线。

### 部署注意事项

- 更新后需要重启白龙马。
- 如果微信群助手显示“未确认在线/缓存群列表/请强制重新扫码”，请进入“设置 -> 微信群助手”，点击“强制重新扫码”，用要接入群聊的微信扫码。
- 下方缓存群列表只是方便保留勾选，不代表当前微信通道在线；扫码成功并真实刷新后才会显示“已真实连接”。


## v0.3.3 - 2026-05-28

### 修复内容

- 修复 macOS 点击窗口关闭按钮后，程序只是隐藏窗口、仍然留在菜单栏/托盘继续运行的问题。
- Electron 主窗口 `close` 事件不再拦截并 `hide()`；用户点关闭按钮时会设置退出标记并调用 `app.quit()`。
- 新增 `before-quit` 统一设置退出标记，保证菜单栏“退出”、重启安装、程序重启等路径都走真实退出。
- `window-all-closed` 改为关闭最后窗口后退出应用，避免窗口没了但后台服务、Wechaty、语音链路仍留在进程里。
- 保留菜单栏图标里的“显示主界面”和“退出”入口：程序运行时仍可从菜单栏操作；但关闭主窗口就是彻底关闭。

### 改变原因

- 用户明确反馈“点击关闭按钮还是在菜单栏存在”，这和普通用户对关闭按钮的预期不一致。
- 之前隐藏到菜单栏是为了让桌面助手后台常驻，但目前更重要的是让用户能直观、可靠地结束程序。

### 验证结果

- `node --check electron/main.cjs` 通过。

### 部署注意事项

- 更新后需要重启白龙马/Electron 才能生效。
- 如果希望让程序继续后台常驻，不要点击窗口关闭按钮；后续可以再做“关闭按钮行为：退出 / 最小化到菜单栏”的设置开关。
- 如果当前已经有旧进程停在菜单栏，请先从菜单栏图标点“退出”，或在活动监视器里结束 Bailongma/Electron 后再启动新版。


## v0.3.2 - 2026-05-28

### 修复内容

- 修复 Wechaty 登录态没有稳定写入 Electron `userData`，导致重启后容易重新出现二维码的问题。
- 显式给 `WechatyBuilder` 传入 root `MemoryCard`，确保 `PUPPET-WECHAT4U` 登录数据写到 `~/Library/Application Support/Bailongma/wechaty-duty-group.memory-card.json`，而不是项目当前目录。
- 保留 `PuppetWechat4u` 的 memory 配置，并在启动前确保登录态文件存在且 JSON 有效。
- 自定义 logout handler 不再主动删除 `PUPPET-WECHAT4U` 登录态，避免正常 stop/restart 时把扫码状态清掉。
- 修复运行状态误判：`roomSnapshot` 只是上次群列表快照，不能作为当前已登录证据；只有当前进程实际解析到 room 才算在线。
- 等待扫码/恢复登录期间遇到 `400 != 400`、`-1 == 0` 等 wechat4u 暂态错误时，只保留当前状态，不再误标为 `logged_in`。
- 状态接口新增 `login_memory` 诊断信息，可看到登录态文件路径、大小、key 数量和是否包含 Wechaty 登录数据。
- `.gitignore` 新增 `*.memory-card.json`，防止 Wechaty 登录态/扫码凭证被上传 GitHub。

### 改变原因

- 正常情况下软件重启不应该每次都要求扫码；扫码态应该尽量复用。
- 但 Web 微信/wechat4u 的登录态可能被微信服务端判定失效，此时仍然会要求重新扫码，这是上游登录机制限制，不是软件故意要求。

### 验证结果

- `node --check src/social/wechaty-duty-group.js` 通过。

### 部署注意事项

- 本补丁生效后，下一次扫码成功会把登录态保存到 userData；之后正常重启会优先尝试自动恢复。
- 如果当前已经处于二维码状态，需要再扫码一次，让新的登录态文件生成。
- 如果微信服务端主动踢掉 Web 登录态，仍需要重新扫码。


## v0.3.1 - 2026-05-28

### 修复内容

- 修复微信群里已经 @ 助手，但助手仍回复“没叫我，跳过”的问题。
- 群助手触发逻辑改为以 Wechaty 的 `message.mentionSelf()` 元数据为准：只要微信消息结构确认 @ 了当前登录账号，就必须调用大模型并回复。
- 移除对固定昵称/唤醒词的绑定，不再依赖“前夜 / 小白龙 / 贾维斯 / 小风”等任何文本关键词。以后进群后改群昵称、改微信昵称、改备注名，都不影响 @ 回复。
- 群提示词新增“已由 Wechaty 确认 @ 当前账号”的强约束，禁止模型再次根据文本昵称判断“是不是叫我”。
- `send_message` 工具新增保护：如果 Wechaty 已确认 @ 当前账号，而模型试图发送“没叫我 / 不是@我 / 跳过 / 无需回应”，工具会拒绝这条错误回复并要求模型重新直接回答。
- LLM 循环新增兜底拦截：模型如果不调用工具、只输出“没叫我/跳过”，会被注入修正提示并重试。
- 协议 fallback 新增保护：即使模型最后仍输出错误跳过文本，也不会原样发到微信群。
- 修复 `sentMessage` 判断：只有 `send_message` 真正发送成功才算已回复；工具返回错误时会继续要求模型补发正确回复。

### 改变原因

- 微信群里显示的 @ 名称可能是群昵称、备注名、微信昵称或临时展示名，不能作为助手身份判断依据。
- 用户明确要求：不要绑定任何限制词，主要是 @ 就能回复，因为进群之后可能会改名，后续也可能给这个微信改昵称。

### 验证结果

- `node --check src/social/wechat-groups.js` 通过。
- `node --check src/social/wechaty-duty-group.js` 通过。
- `node --check src/social/wechat-clawbot.js` 通过。
- `node --check src/capabilities/executor.js` 通过。
- `node --check src/llm.js` 通过。
- `node --check src/index.js` 通过。
- 本地函数验证：`shouldWakeInWeChatGroup("@小风 写首诗", { mentionedSelf: true }) === true`，`mentionedSelf: false` 时不唤醒。

### 部署注意事项

- 需要重启白龙马/Electron 后生效。
- 不需要重新扫码，除非微信登录态本身已失效。
- 本补丁不新增依赖、不改 Honcho 端口、不上传任何群聊数据。


## v0.3.0 - 2026-05-28

### 里程碑定位

这是“微信群助手可用版”的里程碑更新：从之前的本地语音/桌面助手能力，正式扩展到可扫码登录微信、选择多个群组、在群里被 @ 后调用大模型回复，并为后续每个群独立知识库打好基础。

### 更新内容

#### 微信群助手

- 新增基于 `wechaty` + `wechaty-puppet-wechat4u` 的微信群助手连接器。
- 设置页新增独立“微信群助手”菜单，不再混放在普通社交媒体配置里。
- 支持扫码登录/恢复登录、展示二维码、获取真实微信群列表、勾选多个群组并保存生效。
- 支持默认接入“值班群”和“PT站看片狂魔小群”，也支持后续在设置页选择更多群。
- 群消息规则改为：只有 @ 当前登录微信号时才调用大模型；没有 @ 的普通群消息只进入归档/记忆链路，不主动打扰。
- 修复之前只对“在吗”等测试话术有硬编码回应的问题，现在 @ 后会进入真实 LLM 回复流程。
- 回复时会 @ 提问的群成员，并尽量使用可读昵称，避免把 `@03ee...` 这类内部 ID 直接发到群里。
- 增加文本 `@登录名` 兜底识别，减少 Wechaty mention 事件偶发不完整时漏触发的问题。

#### 登录状态与群组状态稳定性

- 修复扫码后设置页不显示真实在线状态的问题。
- 修复退出设置页再进入后群列表消失、已选群组显示不真实的问题。
- 群组列表刷新改为尊重运行时快照：未登录时不会用空列表覆盖之前已获取的真实列表。
- 保存群组选择时不再无意义重启 Wechaty，避免“扫码成功 -> 保存生效 -> 立刻掉线 -> 群里 @ 无响应”。
- `/social/wechaty-duty-group/start` 改为幂等：已经扫码中、已登录、已连接时重复点击不会重复启动/破坏会话。
- 对 Wechaty/Web 微信常见瞬时错误（如 `-1 == 0`、`400 != 400`）做降级处理：在已登录且群组已解析时视为警告，不再立即重连/登出。

#### Honcho 群知识库

- 新增 Honcho 记忆层依赖：`@honcho-ai/sdk` 与 `honcho-ai`。
- 新增 Honcho 配置项，默认连接本地服务 `http://127.0.0.1:8018`，默认应用/知识库为 `bailongma-wechat-memory`。
- 每个微信群映射为独立的 Honcho session/peer，避免不同群组之间记忆串扰。
- 新增群知识库查看/预览接口与 UI 入口，后续可按群手动管理。
- 按用户要求不启用本地兜底记忆：Honcho 未启动或不可用时，只提示状态，不偷偷写入本地替代库。

#### 群指令安全守卫

- 新增微信群指令黑名单守卫，防止群成员通过 @ 让助手执行危害电脑或账号的操作。
- 默认拒绝：删除/破坏文件、修改系统权限或启动项、读取/外传密钥、网络外传、执行命令/代码、安装卸载软件、远程控制、支付转账、账号操作、群发刷屏等高危请求。
- 按用户要求不加入逆向内容过滤，也不加入成人内容过滤。
- 安全守卫只针对危险执行类请求；普通问答、总结、解释、写作仍可调用大模型。

#### Electron / Mac 启动稳定性

- 新增 Mac 一键启动脚本：`start-jarvis.command`。
- 新增后台启动脚本：`start-jarvis-background.sh`，使用 macOS `open -n Electron.app --args <project>`，避免普通 `nohup npm start` 被终端/自动化会话带崩。
- Electron 主进程加入 EPIPE 保护，减少输出管道关闭导致的异常退出。
- 修复 Dock 栏有图标但点击不显示窗口的问题，`showMainWindow()` 与 `app.on('activate')` 会重新显示主窗口。

#### 语音与交互链路同步改进

- 接入火山/豆包 ASR 配置与后端链路，并增加后端轻量 VAD/自动 flush，改善“只识别最后一个字”和回答后不再识别的问题。
- 调整 TTS 自回声/打断逻辑，降低助手播报自己的声音又触发语音识别的概率。
- 根据用户反馈，关闭碎片化分段 TTS，默认回到更稳定的整段播报，避免语调忽变、读一半停住、漏读短句。
- 队列和 LLM 输出增加 Unicode 代理字符清理，避免异常字符导致消息/语音链路中断。

### 改变原因

- 用户已经完成微信扫码登录并在群里测试通过，说明本版本已经达到“群里 @ 能正常回复”的可用里程碑。
- 之前最大问题是：扫码后保存群组会掉线、群列表状态不真实、@ 后没有进入 LLM、以及 Wechaty 瞬时错误导致连接器误判失败。
- 本版本把登录状态、群组选择、@ 触发、LLM 回复、安全守卫、群记忆入口和 Mac 启动方式连成一条稳定链路。

### 验证结果

- 用户实测：微信群里 @ 登录账号后已经可以正常回复。
- `node --check src/social/wechaty-duty-group.js` 通过。
- `node --check src/api.js` 通过。
- `node --check src/config.js` 通过。
- `node --check src/social/wechat-group-memory.js` 通过。
- `node --check src/social/wechat-groups.js` 通过。
- `node --check src/social/wechat-command-guard.js` 通过。
- `node --check src/social/dispatch.js` 通过。
- `node --check src/social/index.js` 通过。
- `node --check src/ui/brain-ui/app.js` 通过。
- `node --check src/ui/brain-ui/app-shell.js` 通过。
- `node --check electron/main.cjs` 通过。

### 部署注意事项

- 从源码运行：`npm install` 后执行 `./start-jarvis.command`，或用 `npm start` 启动 Electron。
- 微信群助手依赖 `wechaty`、`wechaty-puppet-wechat4u`，本版本已写入 `package.json` 和 `package-lock.json`。
- Honcho 如果要启用本地知识库，需要单独启动 Honcho 服务，默认地址为 `http://127.0.0.1:8018`。如果 Honcho 未启动，微信群回复仍可工作，但群知识库状态会显示不可用。
- `.env`、`config.json`、`data/`、Wechaty 登录态、日志、`.playwright-mcp/`、本地模型和个人数据不上传 GitHub。
- 如果微信 Web 登录态失效，需要在“设置 -> 微信群助手”重新扫码。


## v0.2.0 - 2026-05-27

### 更新内容

- 新增小智式语音会话状态机 `VoiceSession`，统一管理语音 turn、状态和打断流程。
- 每轮语音输入生成独立 `voiceTurnId`，从前端发送、API 入队、LLM 流式事件到 TTS 播放全链路传递。
- ASR 回调、LLM 流式 TTS、TTS 队列播放都按 `voiceTurnId` 过滤，旧 turn 的回调会被丢弃，避免上一轮语音/播报污染当前轮。
- 新增统一 `abortSpeaking(reason)` 控制点，用于用户打断、新一轮语音开始、TTS 停止等场景。
- TTS 队列增加 turn 绑定；如果新 turn 已经开始，旧 turn 的分句语音不会继续播放。
- 前端运行时新增 `voice_turn_state`、`voice-fast-state`、`voice-session-state` 状态同步，供 UI 和后续诊断使用。
- API `/message` 支持 `voiceTurnId` / `voice_turn_id`，用于本地语音请求的会话隔离。

### 改变原因

- 借鉴小智 ESP32 的协议化会话思路：不是简单堆模型，而是把听、想、说、打断统一成明确的 turn 和状态。
- 进一步解决语音残留、旧回调串入新一轮、TTS/ASR 打断混乱等问题。

### 验证结果

- `node --check src/api.js` 通过。
- `node --check src/index.js` 通过。
- `node --check src/capabilities/executor.js` 通过。
- `node --check src/ui/brain-ui/app.js` 通过。
- `node --check src/ui/brain-ui/chat.js` 通过。
- `node --check src/ui/brain-ui/voice-panel.js` 通过。
- `npm run smoke:brain-ui` 通过。
- 本地 Electron 启动正常，API `3721` 和 ASR WebSocket `3723` 正常。
- `/message` 携带 `voiceTurnId` 的 voice channel 测试可以正常得到回复。

### 部署注意事项

- 本版本不新增模型文件，不需要额外下载。
- 如果从旧版本升级，直接 `git pull && npm install && npm start` 即可。
- 设置页仍保持简单，没有新增复杂客户配置项。

## v0.1.1 - 2026-05-27

### 修复内容

- 修复语音输入发送后，下一次识别会带上上一次语音内容的问题。
- 发送语音识别结果前后统一清空 `lastTranscriptText`、`accumulatedText`、`lastFinalTranscript` 和自动发送计时器。
- 语音输入改为明确走 `voice` 通道，避免本地语音被当作 TUI/外部消息处理。
- 为本地语音通道增加回复协议提示：直接输出助手正文，由运行时显示和 TTS 播放；不要强制使用 `send_message` 工具。
- 重启验证后确认之前运行进程中的 `voiceSentenceEmitter is not defined` 报错已消失。

### 验证结果

- `node --check src/index.js` 通过。
- `node --check src/ui/brain-ui/voice-panel.js` 通过。
- `npm run smoke:brain-ui` 通过。
- 本地启动后 API `3721` 和 ASR WebSocket `3723` 正常。
- voice channel 测试消息可以正常得到回复。

## v0.1.0 - 2026-05-26

### 更新内容

- 新增“小智式极速语音模式”，默认开启，用于语音对话场景的快速响应、分句播报和可打断交互。
- 后端 LLM 流式输出阶段新增语音分句触发器：模型一边生成正式回答，一边按中文标点/短句边界触发 TTS，不再等待整段回答完全结束后才开始说话。
- 前端 TTS 播放改为队列式分句播放：每一句独立请求 `/tts/stream`，上一句播放时下一句可以排队，减少首句等待时间。
- 打断逻辑升级：用户说话或近场人声触发 `stopTTS()` 时，会清空后续 TTS 队列、取消正在请求的 TTS、停止当前音频，并保留已说到的位置。
- 避免重复播报：当流式分句已经播报过内容时，`send_message` 工具回复和 fallback 回复不会再次把完整文本重复播一遍。
- 设置页新增“极速语音模式（可打断 / 快速播报）”开关，默认开启；关闭后回退到原来的整段 TTS 播放方式。
- 正式回答才会进入语音播报，思考流/工具准备流不会被念出来。

### 改变原因

- 用户希望借鉴小智 ESP32 的快速应答、可打断、快速输出语音和极速交互体验。
- 原逻辑需要等待完整回答后再合成 TTS，语音对话体感偏慢；本版本先完成软件端“流式分句播报 + 打断队列取消”的核心闭环。

### 验证结果

- `node --check src/index.js` 通过。
- `node --check src/ui/brain-ui/app.js` 通过。
- `node --check src/ui/brain-ui/app-shell.js` 通过。
- `npm run smoke:brain-ui` 通过。
- 本地启动后 `http://127.0.0.1:3721/status` 返回 `ok: true`。
- 本地 ASR WebSocket `127.0.0.1:3723` 正常监听。
- 通过 `/message` 发送 voice channel 测试消息，助手成功返回“极速语音模式测试通过”。

### 部署注意事项

- 本版本不新增大型模型文件，不需要额外下载模型。
- 如设置里关闭“极速语音模式”，语音播报会退回整段播放。
- 本版本仍使用当前已配置的本地 ASR/TTS 服务，只优化响应链路和播放队列。

## v2.1.209 - 2026-05-26

### 更新内容

- 新增正式 `CHANGELOG.md`，以后每个版本的备份、功能变化、部署注意事项都集中记录在这里。
- Brain UI 的“设置 -> 更新”页面新增“更新说明”区域，用户可以直接在软件里看到最近版本改变了什么。
- README 增加“版本更新记录”入口，避免只有版本号没有说明。
- 备份文档补充版本维护规范，明确以后每个版本都要写清更新内容、改变原因、部署方法和不进 Git 的本地文件。

### 影响范围

- 不改变语音识别、声纹、唤醒词和视频抗干扰的运行逻辑。
- 这是一次文档和界面说明增强版本。

### 备份说明

- GitHub 维护仓库：`xiaoguiwucan/BaiLongma`
- 上一个功能备份 tag：`backup-2026-05-26-local-voice`
- 本版本应打 tag：`v2.1.209`

## v2.1.208 - 2026-05-26

### 更新内容

- 将当前 Mac Electron 本地语音助手能力正式升级为 `v2.1.208`。
- 默认本地语音识别模型改为 `SenseVoiceSmall`，中文优先、速度更快，并降低空音频幻觉概率。
- 保留 Whisper 作为本地备用模型，可在设置页切换。
- 新增 `src/voice/sensevoice_server.py`，通过 WebSocket 提供本地 ASR 服务，兼容原本麦克风音频链路。
- 本地 ASR 服务加入静音门控、近场人声阈值、最短语音长度、重复文本过滤和常见幻觉文本过滤。
- 设置页新增语音识别服务商选择：本地、阿里云、腾讯云、讯飞。
- 设置页新增本地模型选择：SenseVoiceSmall、Whisper tiny/base/small/medium/large/turbo 等。
- 新增唤醒词开关和自定义唤醒词输入，默认 `小龙马 / 龙马 / 白龙马`。
- 新增声纹录入能力，支持“只响应我的声音”。
- 新增声纹严格度滑杆，默认 `0.55`，用于提高声纹识别稳定性。
- 新增视频播放抗干扰设置：
  - 检测到近场人声时自动降低/暂停视频；
  - 视频播放时启用空格按住说话；
  - 启用系统回声消除 AEC。
- 前端语音面板增加声纹拒绝反馈，能看到拒绝原因和相似度分数。
- `.gitignore` 增加 `.venv-whisper/`、`models/SenseVoiceSmall/`、`backups/`、Python 缓存等本地大文件忽略规则。
- 新增详细备份与 Mac 自部署文档 `BACKUP-2026-05-26.md`。

### 改变原因

- 用户要求语音识别尽量本地化，中文优先，速度要快且精准。
- 原 Whisper 在静音、视频背景音、噪声环境下容易输出重复幻觉文本，例如“我只想说了”等无效内容。
- 播放视频时，视频声音可能遮盖用户唤醒词，需要提供 AEC、视频降音和按住说话组合方案。
- 用户希望助手只响应本人声音，因此加入本地声纹录入和声纹校验。

### 部署注意事项

- `models/SenseVoiceSmall/` 不上传 GitHub，需要按 `BACKUP-2026-05-26.md` 里的方法下载。
- `.venv-whisper/` 不上传 GitHub，需要在 Mac 上重新创建 Python 3.11 虚拟环境。
- `.env`、`config.json`、`data/` 属于本地配置和个人数据，不作为公开 GitHub 备份上传。
- 声纹数据在 `data/voiceprint.json`，属于敏感个人数据，不应上传公开仓库。

### 已知限制

- 当前唤醒词仍是软件侧文本/音频链路判断，还不是专用 KWS 模型。
- 当前声纹使用 `resemblyzer`，适合个人桌面辅助，但还不是 3D-Speaker/ECAPA 工业级声纹系统。
- 视频很吵时声纹和 ASR 都会受影响，最稳定方案仍是同时开启视频降音、AEC 和空格按住说话。

## v2.1.182 - 2026-05-25

### 更新内容

- README 同步补充专注栈、Agent 委托、语音系统、社交分发等 Step5-6 新增模块。
- 保留作为上游历史版本节点，后续本仓库以 `xiaoguiwucan/BaiLongma` 为维护主仓库。

