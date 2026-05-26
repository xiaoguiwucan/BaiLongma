# v2.3.2 语音唤醒稳定性补丁版

发布时间：2026-05-26

这是 v2.3.1 之后的语音唤醒稳定性补丁版，集中收束视频/音乐 pre-roll、语音调试面板增强、以及 partial ASR 不再绕过唤醒门控自动发送三个检查点。

## 更新内容

- 新增视频/音乐 pre-roll 音频缓存：媒体播放时在内存保留最近 0.8–4 秒麦克风环形缓存。
- 检测到近场人声后，会临时打开 ASR 门控并先 flush 预录音块，再继续发送实时音频，减少唤醒词/指令开头被视频声音盖住时丢字。
- 设置页新增“视频/音乐预录音缓存”开关和“预录音时长”滑杆。
- 后端配置新增 `videoVoicePreRollEnabled` / `videoVoicePreRollMs`。
- 视频抗干扰预设、readiness wizard、local doctor 和 smoke 覆盖已纳入 pre-roll。
- 语音调试面板增强：显示麦克风/VAD 当前值、峰值、阈值；唤醒通过/拒绝原因与置信度；声纹通过/拒绝分数与阈值；媒体门控和 pre-roll 缓存状态。
- 修复 ASR partial 中间结果可能成为待发送指令的问题：partial 现在只显示/调试，不写入正式待发送文本，也不会触发 auto-send。
- wake rejected 或 ASR 幻觉过滤时会清空待发送文本并显示明确忽略原因。
- 新增 `npm run smoke:voice-panel-gating`，保护“partial 不得绕过唤醒门控触发发送”的关键不变量。

## 改变原因

- 视频播放时本人唤醒可能被外放声音掩盖，单纯降音/AEC 仍可能导致开头几个字已经丢失；pre-roll 用来补回开头。
- 用户需要稳定排查“是麦克风没听到、唤醒被拒、声纹被拒，还是媒体门控没打开”，所以需要更详细的调试面板。
- partial ASR 是临时识别结果，不应该绕过唤醒词和声纹成为正式指令。
- v2.3.1 后已经积累多个相关检查点，继续不发版会造成版本跨度过大。

## 部署方式

源码运行：

```bash
npm install
npm start
```

Mac 打包：

```bash
npm run build:mac
```

建议打开 Brain UI -> 设置 -> 语音识别：

1. 应用“视频抗干扰”预设。
2. 确认“视频/音乐预录音缓存”开启。
3. 播放视频后观察“小智式语音状态机”里的麦克风/VAD、唤醒判定、声纹判定和媒体门控状态。

## 验证结果

已通过：

- `node --check src/ui/brain-ui/voice-panel.js`
- `node --check src/ui/brain-ui/app.js`
- `node --check src/ui/brain-ui/app-shell.js`
- `node --check src/config.js`
- `node --check src/api.js`
- `node --check scripts/smoke-brain-ui.mjs`
- `node --check scripts/smoke-voice-panel-gating.mjs`
- `npm run smoke:voice-panel-gating`：7/7 通过
- `npm run smoke:brain-ui`：通过
- `npm run smoke:voice-events`：92/92 通过
- `npm run smoke:voice-manager`：7/7 通过
- `npm run build:mac`：如本 Release 附件包含 dmg/zip，则表示 Mac arm64 打包已通过

## Release 附件说明

- `BaiLongma-source-v2.3.2.zip`：Git 追踪源码快照，不包含 `.env`、`config.json`、`data/`、`node_modules/`、模型目录和虚拟环境。
- `BaiLongma-v2.3.2.bundle`：Git bundle，可离线恢复到本版本历史。
- `Bailongma-2.3.2-arm64.dmg`：Apple Silicon Mac 安装包。
- `Bailongma-2.3.2-mac-arm64.zip`：Apple Silicon Mac zip 包。
- `latest-mac.yml`：Electron updater 的 macOS 更新元数据。

## 已知限制

- pre-roll 只能补回麦克风实际采到的音频；如果视频外放过大导致麦克风完全采不到本人声音，仍需要降低播放音量、靠近麦克风或用空格按住说话。
- 当前仍是软件侧唤醒门控，不等同于专用 KWS/WakeNet；后续可继续接入 sherpa-onnx KWS 或 openWakeWord。
- Mac 包仍未 notarize，跨机器首次打开可能需要在“系统设置 -> 隐私与安全性”允许打开。
