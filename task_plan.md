# 任务计划：排查 Wechaty 群助手从稳定变成网页版/掉线的前后差异

## 目标
找出“之前 Wechaty 稳定可用”到“加入知识库/登录页面后变成网页版登录且不稳定”的具体代码、依赖和运行逻辑差异，并给出/实施修复方向。

## 阶段
1. **基线梳理**：确认当前 Git 状态、最近提交、未提交改动范围。状态：in_progress
2. **Wechaty 前后差异对比**：重点对比 `src/social/*wechat*`、`src/social/index.js`、`src/api.js`、`src/config.js`、`package.json`。状态：pending
3. **运行链路排查**：检查当前服务是否运行、Wechaty 状态接口、日志、是否有异常退出/被保存动作重启。状态：pending
4. **根因归纳**：明确是 puppet 切换、保存重启、运行时状态覆盖、Honcho 初始化还是 UI 误导导致。状态：pending
5. **修复/回滚最小方案**：恢复稳定群聊通道，保留知识库和设置页但不破坏登录。状态：pending
6. **验证**：启动应用、检查 API、确认 UI 状态与实际 Wechaty 状态一致。状态：pending

## 错误记录
| 时间 | 错误/现象 | 处理 |
|---|---|---|
| 2026-05-27 | 用户反馈加入知识库/登录页后 Wechaty 变成网页版登录且不稳定 | 开始基于 Git diff 和日志深挖 |

## 当前阶段推进
- 阶段 1 基线梳理：complete
- 阶段 2 Wechaty 前后差异对比：in_progress
- 阶段 3 运行链路排查：in_progress
- 阶段 3 运行链路排查：complete
- 阶段 4 根因归纳：complete
- 阶段 5 修复/回滚最小方案：complete
- 阶段 6 验证：partial（已验证 API/二维码/后台稳定；待用户扫码后验证群列表与 @ 回复）
