# Task Plan: WeChat Group Assistant False Online / Re-login Fix

## Goal
修复设置页显示“已登录/群列表已刷新”，但群里 @ 无回复且没有重新生成二维码入口的问题。要求状态必须真实、可操作、可强制重新扫码登录。

## Phases
1. [complete] 检查真实运行状态、端口、日志、Wechaty 状态接口。
2. [complete] 定位 UI 状态来源和后端状态误判逻辑。
3. [complete] 实现修复：真实状态展示、强制重新登录/清空登录态、二维码刷新入口、错误可见。
4. [complete] 运行语法/接口验证。
5. [in_progress] 按版本规则更新文档、提交、tag、推送 GitHub Release。

## Key Findings
- 旧状态把历史登录用户和历史群列表快照误当成在线证据。
- `/rooms` 在没有真实获取群列表时仍返回 `ok:true`，导致 UI 写“群列表已刷新”。
- 当前 Wechaty 版本不消费 `memory` 选项，必须通过 `name` 绑定 MemoryCard；否则空登录态会报 `no payload`，无法生成二维码。

## Validation
- `node --check` 通过：Wechaty connector、API、config、Brain UI JS。
- 状态接口验证：当前可进入 `qr_ready` 且返回二维码，同时 `online:false`，不再假在线。
