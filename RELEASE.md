
## v0.4.44 - 2026-05-29

### 修复
- 修复微信群里“给我力佬发的那张 newapi 的图”找不到图的问题：图片库搜索现在会把 `newapi`、`New API`、`New-API` 视为同一个关键词。
- 图片转发检索加入发送者昵称、花体昵称标准化和群成员常用外号匹配；当前内置兼容“力佬/大力/Dali/Dafi”这类称呼。
- 图片转发候选不再只看已经完成识图描述的图片；只要是当前群已入库且本地文件可用的微信图片，也能作为兜底候选，避免刚入库但还没识图完成时直接说找不到。

### 原因说明
- 之前机器人能“总结这张图”，是因为大模型上下文里能看到图片识图描述；但“发给我这张图”走的是另一条严格的图片转发检索链路。
- 这次 PT 群图片已入库，描述里写的是 `New API`，用户说的是 `newapi`，再加上发送者是花体昵称 `𝓓𝓪𝓵𝓲·𝓦𝓪𝓷𝓰`、用户叫“力佬”，旧检索没有做归一化和别名匹配，所以误判为没找到。

### 实测
- 对真实数据库测试 `@小风 给我力佬发的那张newapi的图`：可以命中 `PT站看片狂魔小群` 中 `𝓓𝓪𝓵𝓲·𝓦𝓪𝓷𝓰` 发过的 New API 图片，并确认本地文件可解析。

### 验证
- 通过 `node --check src/social/wechat-image-vision.js`。
- 通过 `npm run test:wechat-guard`。
- 通过 `npm run test:wechat-record-all`。
- 通过 `git diff --check`。

## v0.4.43 - 2026-05-29

### 修复
- 修复“发送给我那张图/那张山水画发我”仍被误判为生图的问题。
- 生图触发进一步收紧，避免把名词“山水画”里的“画”当作“画图”指令。

### 新增
- 新增已入库群图片转发能力：当用户要求“把那张图发给我/转发刚才那张图”时，优先在当前微信群 `wechat_group_media_items` 图片库中检索匹配图片并直接发送原图。
- 图片转发只允许发送当前群已经入库的微信图片文件，不允许发送任意本机路径，避免隐私泄露。
- 匹配逻辑会根据图片识图描述和用户请求打分，例如“水墨山水画”会命中已识别的水墨山水图片。

### 实测
- 对 `@前夜 发送给我那张水墨山水画的图片给我，给我那张图` 测试：不触发生图，命中值班群图片库中的水墨山水图，文件可解析并可发送。
- 正常生图请求仍可用。

### 验证
- 通过 `node --check`：image-generation-skill、wechat-image-vision、wechaty-duty-group。
- 通过 `npm run test:wechat-guard`。
- 通过 `npm run test:wechat-record-all`。
- 通过 `git diff --check`。

## v0.4.42 - 2026-05-29

### 修复
- 修复“看图/识图/引用图片”被误判成“生图”的问题。现在包含“看、识别、识图、图片里、图里、引用、报错、内容”等意图时，不会触发生图 Skill。
- 生图触发词收紧：只在明确“生图/画图/生成图片/画一张/绘制/设计/创作”等场景触发，不再因为“给你图/来图/引用图”误触发。
- 微信群提示词增加图片理解边界：引用图片优先使用图片记忆；若 Wechaty 只拿到 `[图片]` 引用文本而没有像素内容，会明确要求用户直接重发图片，不会擅自生图。

### 增强
- 新增从历史群聊活动记录中回填已保存图片到 `wechat_group_media_items` 的能力，可把旧的 `[媒体文件]` 图片补进识图库并生成描述。
- 已针对“值班群”这次 Hermes 截图执行回填和识图：成功导入 1 张，识别 1 张。

### 实测识图结论
- 这张 Hermes 截图可以识别到内容：图里显示 provider 180 秒无响应、重连、重试，最终 `HTTP 502: Upstream service temporarily unavailable`，并且 retries exhausted 后尝试 fallback。
- 判断更像是上游模型/中转服务不可用或超时，不是单纯 Hermes 本地逻辑问题；需要检查当前模型 `gpt-5.5`、中转 baseURL/API key/额度、上游网关稳定性和 fallback 配置。

### 验证
- 误触发测试：`我给你图 引用给你自己看`、`没让你生图 是让你识别图里的内容`、`看看图片里hermes是啥问题` 均不会触发生图。
- 正向测试：`生图 一个蓝色圆形图标`、`帮我画一张猫图` 仍会触发生图。
- 通过 `node --check`：image-generation-skill、wechat-image-vision、wechat-groups。
- 通过 `npm run test:wechat-guard`。
- 通过 `npm run test:wechat-record-all`。
- 通过 `git diff --check`。

## v0.4.41 - 2026-05-29

### UI 修复
- 修复 Skill 技能页输入框/下拉框过小的问题：生图和识图配置项现在使用正常宽度、正常高度的大表单控件。
- 生图模型不再手填，改为下拉选择内置生图模型：`gpt-image-2`、`gpt-image-1`、`dall-e-3`，并保留当前配置值。
- 识图备用模型不再手填，改为下拉选择：优先读取当前 LLM 和 LLM 模型池里的多模态候选模型，同时提供内置 GPT/Vision 模型。
- Skill 设置页加载时会同步读取 LLM 模型池，因此后续添加多模态模型后会出现在识图模型下拉框中。

### 验证
- 通过 `node --check src/ui/brain-ui/app.js`。
- 通过 `git diff --check`。
- 通过 `npm run test:wechat-guard`。
- 通过 `npm run test:wechat-record-all`。

## v0.4.40 - 2026-05-29

### 新增：微信群识图 Skill / 图片记忆
- 新增“识图 Skill”：微信群收到图片后会保存本地文件、base64、图片元数据，并调用多模态/GPT 模型生成中文内容描述和标签。
- 新增 `wechat_group_media_items` 数据表，字段包含群、发送人、图片路径、mime、大小、sha256、base64、识图描述、标签、识图模型和状态。
- 当前 LLM 如果是多模态/GPT 模型，会优先使用当前模型识图；如果当前模型不是多模态，会自动使用备用 GPT 识图模型。
- 识图结果会进入当前微信群的图片记忆上下文；后续即使切换到 DeepSeek 等非多模态模型，也能通过图片描述理解历史图片含义。
- 群聊数据库混合搜索增加图片描述搜索。
- 数据库备份导出包含 `wechat_group_media_items`，图片 base64 和描述可随备份恢复。

### 设置页
- Skill 技能页新增“识图 Skill”配置：启用开关、优先当前多模态模型、备用 GPT Base URL、备用模型、备用 Key、识图超时、状态刷新。
- 状态显示真实图片入库数、已描述数、待处理数、base64 保存数。

### 行为说明
- 被 @ 的图片消息会优先等待识图结果再进入大模型回复，保证当场能理解图片。
- 普通群图片会后台识图，不打扰群聊；识图结果会进入后续记忆上下文。
- 不直接把本机文件发给群友；图片理解只用于本地知识库和回复上下文。

### 验证
- 实测本地测试图片成功入库 base64 并识别：蓝色圆形、白色背景、极简图形。
- 实测识图耗时约 13 秒，使用当前多模态模型 `gpt-5.4`。
- 通过 `node --check`：config、wechat-image-vision、wechaty-duty-group、wechat-groups、api、database-overview、brain-ui app。
- 通过 `npm run test:wechat-guard`。
- 通过 `npm run test:wechat-record-all`。
- 通过 `git diff --check`。

## v0.4.39 - 2026-05-29

### 优化
- 数据库页的“微信群成员/昵称”不再直接显示历史身份记录总数，改为显示按“群名 + 昵称”聚合后的有效昵称数。
- 新增“成员有效视图”面板：同时展示有效昵称、历史身份记录、可合并历史记录、可用 wxid 数。
- 按群展示成员昵称聚合结果，例如“PT站看片狂魔小群：52 个昵称 / 358 条历史身份”。
- 展示重复昵称示例，方便排查 Wechaty 重登后 sender_id 变化造成的虚高。

### 说明
- 本版本不删除原始 `wechat_group_member_names` 记录，只做安全显示层合并，避免误删历史身份和昵称映射。
- 原始表仍完整保留，导出备份仍包含全部历史记录。

### 验证
- 当前实测：有效昵称约 359，历史身份记录 1717，可合并历史记录 1358，wxid 可用数 0。
- 通过 `node --check src/database-overview.js`。
- 通过 `node --check src/ui/brain-ui/app.js`。
- 通过 `npm run test:wechat-guard`。
- 通过 `npm run test:wechat-record-all`。
- 通过 `git diff --check`。

## v0.4.38 - 2026-05-29

### 修复
- 取消微信群统计总结的“启动/登录自动补发”：程序启动、微信扫码登录、恢复连接后，不再立刻向群里发送阶段总结。
- 定时总结调度器启动时会记录当前 interval 周期，并跳过该启动周期，避免一登录就触发发送。
- 删除启动后 15 秒延迟检查发送逻辑；总结只会在用户手动点击发送，或进入后续真正的定时周期时发送。

### 保留行为
- 设置页里的“手动发送总结”仍然可用。
- 如果用户开启了定时总结，程序不会登录即发，而是等下一个定时周期再按配置发送。
- 每日 0 点统计仍受设置页开关和时间控制。

### 验证
- 通过 `node --check src/social/wechat-group-digest.js`。
- 通过 `npm run test:wechat-guard`。
- 通过 `npm run test:wechat-record-all`。
- 通过 `git diff --check`。

## v0.4.37 - 2026-05-29

### 里程碑：微信群长期记忆 / Honcho / 本地向量可用化
- Honcho 本地服务已接通并实测健康：`http://127.0.0.1:8018/health` 返回正常。
- 微信群逐条聊天记录现在先写入本地耐久库，再同步 Honcho；Honcho 不通时不会丢消息、不会失忆。
- 已把本地 1011 条微信群消息同步到 Honcho，当前待同步 0 条。
- 已为核心长期记忆与微信群聊天记录补齐本地轻量向量：核心 180/180，群聊 1011/1011。未配置云端 embedding 时也能做本地语义检索。
- 新增从历史群聊中提取“每群/每成员”长期记忆的能力，并已从现有聊天中提取出成员称呼/身份类记忆。

### 数据库菜单增强
- 数据库页新增「补齐向量」「提取成员记忆」「同步 Honcho」三个一键操作。
- 新增聊天记录 / 长期记忆混合搜索框，可同时搜索微信群逐条聊天记录、群组记忆、成员记忆。
- 数据库状态卡真实显示 Honcho 连通状态、已同步/本地消息数量、核心/群聊/群记忆向量化进度。
- 导出备份 JSON 现在会正确保存 BLOB 向量字段为 base64；导入时会恢复 BLOB，并按聊天内容/记忆内容/mem_id 去重，避免重复灌库。

### 回答记忆逻辑
- 核心记忆注入器增加本地向量兜底：没有云端 embedding 配置时，也会使用本地轻量向量召回补充上下文。
- 微信群回答上下文会优先合并 Honcho 长期记忆、Honcho 摘要、Honcho 最近消息；Honcho 读取失败时自动降级到本地群记忆和本地向量检索结果。

### 验证与实测
- Honcho Docker 服务：api/database/redis healthy，deriver running。
- 历史同步：1011 条本地微信群消息同步 Honcho 成功，错误 0。
- 成员记忆提取：扫描 1011 条，提取 4 组成员/群组记忆，错误 0。
- 通过 `npm run test:wechat-guard`。
- 通过 `npm run test:wechat-record-all`。
- 通过 `git diff --check` 和关键文件 `node --check`。

## v0.4.36 - 2026-05-29

### 修复
- 清理并更正错误记忆 `fact_user_wechat_groups_18`：18 个微信群是历史错误记忆/历史 ID 混淆，不再作为事实使用。
- 清理导致上下文污染的临时 focus 栈片段，降低模型反复进入“高风险拒绝”状态的概率。
- 兜底回复新增供应商安全拒绝过滤：不会再把 `The request was rejected because it was considered high risk` 这类英文内部拒绝原文直接发给用户。

### 新增
- 设置页新增独立「数据库」菜单。
- 数据库页集中展示：总占用、微信群聊天记录条数/容量、微信群知识库/记忆、核心长期记忆、成员昵称表、图片/媒体文件占用。
- 新增表级明细，按估算占用从大到小显示表名、行数和容量。
- 新增 `GET /settings/database` 后端接口，用于读取本机数据库和知识库容量统计。

### UI 优化
- 数据库/知识库相关信息从微信群助手页拆出，避免微信群助手设置继续变得过乱。
- 新数据库页以“总占用”为主视图，常用数量用卡片展示，细节放到可滚动表格里。

### 当前实测数据
- 本机总占用约 39 MB。
- 微信群聊天记录约 1010 条。
- 核心长期记忆约 180 条。
- 微信群成员/昵称记录约 1002 条。
- 图片/媒体文件约 29 MB。

### 验证
- 通过 node --check：src/index.js、src/database-overview.js、src/api.js、src/ui/brain-ui/app-shell.js、src/ui/brain-ui/app.js。
- 通过 npm run test:wechat-guard。
- 通过 npm run test:wechat-record-all。

## v0.4.35 - 2026-05-29

### 新增
- LLM 模型池每个模型卡片新增「测试连通」按钮。
- 点击后后端会用该模型发起一次轻量聊天补全检测，成功后状态变为绿色「连通」，失败后状态变为红色「不通」并显示错误原因。
- 测试过程中按钮会显示「测试中…」，完成后显示连通耗时。

### 后端
- 新增 `POST /settings/llm-profile/test` 接口。
- 测试成功会更新 `lastSuccessAt` 并清空 `lastError`；测试失败会更新 `lastFailedAt` 和 `lastError`，但不会把模型加入自动冷却，避免手动检测影响故障切换策略。

### 验证
- 通过 node --check：src/config.js、src/api.js、src/ui/brain-ui/app.js。
- 通过 npm run test:wechat-guard。
- 通过 npm run test:wechat-record-all。

## v0.4.34 - 2026-05-29

### 优化
- LLM 模型池新增直观连通状态显示。
- 模型卡片的「状态」改为「连通状态」，使用信号条图标区分：绿色=连通，红色=不通，黄色=冷却中，灰色=未知/已关闭。
- 如果最近失败时间晚于最近成功时间，会显示红色「不通」，并继续保留上次错误文本，便于判断哪个模型不可用。

### 验证
- 通过 node --check：src/ui/brain-ui/app.js。
- 通过 npm run test:wechat-guard。
- 通过 npm run test:wechat-record-all。

## v0.4.33 - 2026-05-29

### 优化
- 实测生图速度：low / 1024×1024 两次分别约 84 秒、75 秒。
- 将生图 API 默认超时从 90 秒提高到 180 秒，避免服务稍微排队就被误判为超时。
- Skill 设置页新增「API 超时」下拉框，可选 120 / 180 / 240 / 300 秒。
- 生图超时错误现在会明确提示当前超时时间，例如 `图片生成请求超时（180 秒）`。

### 建议
- 默认 low / 1024×1024 继续保持速度优先。
- 普通生图建议 180 秒；高清/2K/4K/8K 如果后续仍超时，可在 Skill 设置里调到 240 或 300 秒。

### 验证
- 通过 node --check：src/social/image-generation-skill.js、src/social/wechaty-duty-group.js、src/config.js、src/api.js、src/ui/brain-ui/app.js、src/ui/brain-ui/app-shell.js。
- 通过 npm run test:wechat-guard。
- 通过 npm run test:wechat-record-all。

## v0.4.32 - 2026-05-29

### 修复
- 修复微信群生图触发词过窄的问题：`生成一张赛博朋克风格的白龙马头像` 这类自然表达现在会命中生图 Skill。
- 生图触发范围从短距离 `生成...图片` 放宽为更符合人话的 `生成/画/设计/创作...图片/头像/壁纸/海报/插画/logo/图标`。
- 避免生图请求落入普通 LLM 工具链后让模型自行 curl API，导致只得到 base64、不发送图片、甚至 180 秒 watchdog 超时。

### 安全
- 已清理本机日志中此前由模型自行 curl 暴露出的 API Key 明文，替换为 `sk-***REDACTED***`。

### 验证
- 已验证 `@前夜 生成一张赛博朋克风格的白龙马头像`、`生图 一个白龙马头像`、`画一个未来城市壁纸` 均命中生图 Skill。
- 通过 node --check：src/social/image-generation-skill.js、src/social/wechaty-duty-group.js。
- 通过 npm run test:wechat-guard。
- 通过 npm run test:wechat-record-all。

## v0.4.31 - 2026-05-29

### 新增
- 新增「Skill 技能」设置菜单，首个技能为「生图 Skill」。
- 生图 Skill 支持配置 Base URL、模型、API Key、每人每小时限额、默认质量、高清质量。
- 微信群里有人 @ 助手并明确要求“生成图片 / 生图 / 画图 / 出图”时，会直接调用生图 API 生成图片并发送到群里。
- 生图调用不添加任何预制提示词，只使用群友提出的图片需求文本。
- 新增每人每小时限流：默认每人每小时最多 10 张图，超过后会 @ 提问人反馈。
- 默认使用 low 质量和 1024×1024 分辨率以提高速度；用户明确要求高清、2K、4K、8K、超清时使用高质量参数。

### 接入
- 生图模型：gpt-image-2。
- OpenAI 兼容接口：/images/generations。
- 支持 API 返回 URL 或 b64_json；生成结果会保存到本机 data/generated-images 后再作为图片发送到微信群。
- API 调用失败、超时、未配置密钥、限流等情况都会 @ 提问人说明原因。

### 安全
- API Key 只写入本机运行配置，不提交到 GitHub，不在设置页回显明文。
- 生成图片发送使用本机刚生成的图片文件，不允许群友指定本机文件路径外发。

### 验证
- 本机已用 low/1024×1024 实测生成成功，并保存图片到 data/generated-images。
- 通过 node --check：src/social/image-generation-skill.js、src/social/wechaty-duty-group.js、src/config.js、src/api.js、src/ui/brain-ui/app.js、src/ui/brain-ui/app-shell.js。
- 通过 npm run test:wechat-guard。
- 通过 npm run test:wechat-record-all。

## v0.4.30 - 2026-05-29

### 新增
- 尝试采集微信群成员稳定微信身份字段：成员库新增 `wechat_id`、`wxid`、`stable_key`、`raw_identity` 字段。
- 管理员识别优先级调整为：精确 sender_id > 稳定微信身份（wxid/微信号 Alias）> 当前群成员快照唯一昵称兜底。
- 对单个群成员额外尝试调用 wechat4u `batchGetContact({ UserName, EncryChatRoomId })` 拉取详情，测试是否能拿到真实微信号或 wxid。

### 修复
- 修复昵称兜底把历史旧 sender_id 也算入同名人数的问题：现在只检查当前最新群成员快照里的同名人数，避免重登后历史记录造成误判。
- 如果当前快照里出现多个同名成员，昵称兜底会拒绝授权，避免普通群友改成管理员同名后冒充。

### 实测结果
- 当前 wechat4u 在 `值班群` 中只能拿到临时 `UserName=@...`，未暴露 `wxid` 或微信号 Alias；数据库字段已保留，若后续协议/账号能返回会自动启用。

### 验证
- 通过 node --check：src/social/wechaty-duty-group.js、src/social/wechat-group-stats.js、src/social/dispatch.js、src/social/wechat-groups.js。
- 通过 npm run test:wechat-guard。
- 通过 npm run test:wechat-record-all。

## v0.4.29 - 2026-05-29

### 修复
- 修复 Wechaty 重新登录后管理员 sender_id 变化导致管理员权限失效的问题。
- 当历史已选管理员 ID 在同一个群内对应的微信昵称/群昵称与当前发言人一致时，自动识别为同一管理员并补录新的 sender_id。
- 解决管理员请求查看性格预设提示词时，程序界面已经生成内容但微信发送层仍提示 `local_file_reference_in_wechat_outbound` 的问题。

### 说明
- Wechaty Web 协议下 sender_id 可能随登录态变化；本版增加同群历史管理员昵称兜底，避免每次扫码后管理员权限丢失。
- 首次命中兜底时日志会输出 `[WechatyAdmin] 管理员 sender_id 已随登录变化，按同群昵称匹配自动补录`，之后会恢复精确 sender_id 判断。
- 普通群成员仍不能靠自称管理员绕过；必须先存在历史已选管理员记录，且在同一个群内匹配到对应昵称。

### 验证
- 通过 node --check：src/social/wechaty-duty-group.js、src/social/dispatch.js、src/social/wechat-groups.js。
- 通过 npm run test:wechat-guard。
- 通过 npm run test:wechat-record-all。

## v0.4.28 - 2026-05-29

### 修复
- 修复已验证微信群管理员仍被“本机隐私/安全黑名单”发送层拦截的问题：管理员消息在入口安全检查通过后，现在会把 `wechat_admin` 标记继续传递到 Wechaty 发送层。
- Wechaty 群消息发送层新增管理员绕过判断：只有普通群成员会触发本机文件、桌面图片、file:// 路径等外发拦截；已验证管理员按管理员权限执行。
- 优化管理员模式提示词：明确普通群成员安全边界、媒体/本机隐私拒绝话术、黑名单限制不适用于已验证管理员；管理员可以查看性格预设、微信群助手配置、安全规则摘要、记忆状态等可读内容。

### 安全边界
- 管理员绕过只基于设置页保存的微信 sender_id 精确匹配，不接受昵称、自称或群备注伪造。
- 默认仍会要求模型隐藏 API Key、Token、密码、Cookie、私钥等密钥原文，避免误把真正密钥发到微信群。

### 验证
- 通过 node --check：src/social/wechaty-duty-group.js、src/social/dispatch.js、src/social/wechat-groups.js。
- 通过 npm run test:wechat-guard。
- 通过 npm run test:wechat-record-all。

## v0.4.27 - 2026-05-29

### 修复
- 修复表情包搜索总是发送同一张的问题：表情搜索结果现在在高质量候选池中按随机种子打散，不再永远取第一张。
- 修复明确“发/来/整 表情包、斗图、梗图、GIF”等指令有时被模型文本回复的问题：Wechaty 群消息入口新增直发表情包分支，命中后直接搜索并发送图片/GIF，不再等待大模型自由发挥。
- 直发表情包仍遵守安全规则：只发送 HTTPS 公开图片/GIF，不发送本机文件，不显示 URL 文本。

### 验证
- 已验证相同关键词在不同 seed 下返回不同首图。
- 通过 npm run test:wechat-record-all。
- 通过 npm run test:wechat-guard。

## v0.4.26 - 2026-05-28

### 修复
- 彻底修复斗图仍发送裸 URL 的问题：现在同时剥离 Markdown 图片、Markdown 链接和纯 URL。
- 如果剥离 URL 后只剩一个 @ 昵称，也不会再发送文字气泡，直接发送图片/GIF。
- 新增内部剥离逻辑验证，确认 `@用户 https://...gif` 会变成纯图片发送。

### 验证
- 通过裸 URL 剥离测试。
- 通过 npm run test:wechat-record-all。
- 通过 npm run test:wechat-guard。

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
