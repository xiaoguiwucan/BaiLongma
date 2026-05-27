# Progress Log

- 2026-05-28: 用户要求补齐微信群记忆管理、微信助手性格设定、安全隔离限制词库与 UI。

- 已检查 Honcho SDK、微信群助手配置、API 与设置页代码，确认需要做真实 UI 列表和真实 Honcho session 数据展示，不能继续只显示第一条预览。

- 已实现配置层 personaPrompt、微信群 prompt 注入、Honcho 记忆 API（详情/概览/手动新增/删除结论/清空 session）和扩展安全规则库。

- 已完成设置页改造：性格提示词输入框、按群 Honcho 记忆管理、手动加记忆、删除结论、清空本群、安全规则详细卡片和弹窗放大。

- 已更新 v0.3.5 版本号、README、CHANGELOG、BACKUP-2026-05-28 和软件内更新说明。

- 已提交当前 v0.3.5 版本，创建 tag `v0.3.5`，推送 origin/main 和 origin/v0.3.5，并创建 GitHub Release：https://github.com/xiaoguiwucan/BaiLongma/releases/tag/v0.3.5
