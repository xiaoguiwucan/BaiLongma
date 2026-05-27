# Task Plan: WeChat Memory Management, Persona Prompt, Safety Guard UI

## Goal
完成用户要求的三个功能：
1. 微信群 Honcho 记忆必须按群组直观显示、列表管理、可查看/删除/刷新。
2. 微信助手增加可手动设置的性格/提示词输入框，并在群回复 prompt 中生效。
3. 完成微信机器人的安全隔离限制词库，提供明确规则库和设置页可视化管理。

## Phases
1. [complete] 审查现有 Honcho 记忆写入/读取、安全守卫、配置结构。
2. [complete] 新增/完善 API：按群列记忆、删除记忆、保存 persona、读取安全规则。
3. [complete] 实现设置页 UI：群组列表 -> 记忆列表 -> 管理操作；persona 输入框；安全规则列表。
4. [complete] 把 persona 注入微信群 LLM prompt。
5. [complete] 验证语法、接口和 UI 状态。
6. [complete] 更新版本文档并提交发布。

## Constraints
- 不启用本地记忆兜底，仍只使用 Honcho。
- 记忆必须按群隔离，不能串群。
- UI 要直观，不要让用户猜。
- 安全规则不包含逆向和色情内容过滤，只做危险执行/电脑/账号/资金等安全隔离。
