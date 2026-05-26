# v2.3.0 本地语音稳定性大版本

这是 v2.2.0 之后本地语音稳定性工作的正式收束版本。重点解决 Mac/Electron 本地语音助手在视频播放、声纹门控、麦克风阈值、本地 ASR 服务复用和诊断排障上的稳定性问题。

## 更新内容

- 本地语音准备闭环：新增 `/voice/local/readiness` 和 `/voice/local/readiness/apply`，一键应用本地 SenseVoiceSmall、严格唤醒、视频抗干扰和稳定基线。
- 声纹安全防锁死：新增 `speaker_gate_safe` readiness step 和 `disable_speaker_gate` doctor fix，避免声纹开关错误导致本人也唤不醒。
- 本地语音实测闭环：新增 `/voice/local/self-test/start` 和 `/voice/local/self-test`，用真实 wake/asr/tts 事件判断链路是否跑通。
- 本地 ASR 服务复用：检测并复用 3723 端口上已有的本地语音服务，避免重复启动；UI 提供停止/取消跟踪和按当前模型重启。
- 本地语音总览：新增 `/voice/local/overview`，集中显示服务、readiness、声纹、自测、麦克风和下一步动作。
- 隐私安全诊断包：新增 `/voice/local/diagnostics/package`，导出排障 JSON，不包含 API Key、原始音频或声纹文件内容。
- 声纹恢复与校准：支持声纹清除、离线清除、备份、选择备份恢复，以及根据测试分数/拒绝记录校准声纹阈值。
- 麦克风自检与阈值校准：显示当前音量、峰值、噪声底、触发阈值，并支持按当前峰值一键校准。
- 麦克风状态进入总览：总览直接显示麦克风未开启、低于阈值或已听见用户。

## 改变原因

用户反馈：视频播放会盖住本人唤醒、声纹录入后可能反而识别不到本人、本地服务重复启动/状态不可见、麦克风阈值不合适时很难判断问题在哪。v2.3.0 的目标是补齐“准备 -> 实测 -> 诊断 -> 校准 -> 恢复”的完整闭环。

## 部署方式

源码运行：

```bash
npm install
npm start
```

建议流程：

1. 打开 Brain UI -> 设置 -> 语音识别。
2. 选择本地模型 SenseVoiceSmall。
3. 点击“一键语音准备”。
4. 点击“开始实测”，说“龙马，测试一下”。
5. 如总览提示麦克风低于阈值，使用“麦克风自检 -> 按当前峰值校准阈值”。
6. 如启用“只响应我的声音”，先录入声纹，再用“测试我的声纹 / 校准阈值”。

诊断端点：

```bash
curl http://127.0.0.1:3721/voice/local/overview
curl http://127.0.0.1:3721/voice/local/readiness
curl http://127.0.0.1:3721/voice/local/doctor
curl http://127.0.0.1:3721/voice/local/diagnostics/package
```

## 验证结果

- `npm run smoke:voice-manager`：7/7 通过
- `npm run smoke:voice-events`：92/92 通过
- `npm run smoke:brain-ui`：通过
- 相关 JS / Python 语法检查通过

## 备份附件说明

- `BaiLongma-source-v2.3.0.tar.gz`：Git 追踪源码快照，不包含 `.env`、`config.json`、`data/`、模型、虚拟环境、依赖目录或打包产物。
- `BaiLongma-v2.3.0.bundle`：离线 Git bundle，可恢复本版本提交历史。

## 已知限制

- 麦克风自检依赖系统麦克风权限；若权限被拒绝，需要先到 macOS 系统设置授权。
- AEC、视频降音和跨域播放器控制受浏览器/播放器限制，必要时仍建议使用空格按住说话。
- 声纹无法在极端噪声或外放过大的情况下保证 100% 识别本人；如误拒绝，优先使用“测试我的声纹 / 校准阈值 / 重录声纹”。
