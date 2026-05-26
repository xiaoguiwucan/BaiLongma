# v2.4.0 本地 KWS/openWakeWord 唤醒大版本

发布日期：2026-05-26  
维护仓库：xiaoguiwucan/BaiLongma

## 这版解决什么问题

v2.4.0 是一次语音唤醒大版本，不是零碎补丁。它把 v2.3.2 之后的 KWS 配置、运行时协议、模型管理、依赖安装和录音自测收束成正式 Release。

核心目标：让白龙马不再只能靠 ASR 文本里出现唤醒词来判断是否唤醒，而是支持更接近小智 / WakeNet 设备体验的本地关键词唤醒路径。

## 更新内容

- 版本升级到 `2.4.0`。
- 设置页新增唤醒检测方式：
  - 文本唤醒；
  - 混合唤醒（KWS + 文本，推荐起点）；
  - 本地 KWS。
- 新增 KWS 引擎配置：
  - `openwakeword`：已接入本地运行时；
  - `sherpa-onnx`：保留配置入口，但会明确提示需要完整模型组，不假装可用。
- 前端语音面板新增 `kws_detect` 调用，接收 `kws_result` / `kws_status`。
- 本地 SenseVoice 服务新增 openWakeWord `.onnx` 懒加载推理。
- 纯 KWS 模式下，没有 KWS 命中就不会只靠 ASR 文本唤醒，降低视频/他人说话误触发。
- 新增 KWS 状态检测：模型路径、模型存在性、Python 依赖、运行时状态和下一步建议。
- 新增 openWakeWord 依赖安装入口。
- 新增 KWS 模型管理：
  - 扫描 `models/kws`；
  - 导入本地 `.onnx` 文件路径；
  - 从 http/https URL 下载模型；
  - 自动规范文件名并处理重名。
- 新增 KWS 录音自测入口，观察是否触发 `bailongma:kws-wake`。
- 新增/扩展 smoke 测试：`smoke:kws-runtime`、`smoke:voice-panel-gating`、`smoke:brain-ui`。
- README、CHANGELOG、备份文档、软件内更新说明同步更新。

## 推荐使用方式

1. 打开 Brain UI -> 设置 -> 语音识别。
2. 先选择“混合唤醒”。
3. 点击“检测 KWS”。
4. 点击“安装 openWakeWord”安装本地依赖。
5. 导入本地 openWakeWord `.onnx` 模型，或提供模型下载 URL。
6. 点击“扫描模型”，选择模型。
7. 点击“应用 openWakeWord 配置”。
8. 点击“录音自测”。
9. 稳定后再切换到“本地 KWS”。

## Mac 部署方法

源码运行：

```bash
npm install
npm start
```

Mac 打包：

```bash
npm run build:mac
```

生成产物位于 `dist/`。

## 验证情况

本版本发布前需要通过：

```bash
node --check src/api.js
node --check src/config.js
node --check src/ui/brain-ui/app-shell.js
node --check src/ui/brain-ui/app.js
node --check src/ui/brain-ui/voice-panel.js
python3 -m py_compile src/voice/sensevoice_server.py
node --check scripts/smoke-kws-runtime.mjs
node --check scripts/smoke-voice-panel-gating.mjs
node --check scripts/smoke-brain-ui.mjs
node --check scripts/smoke-voice-events.mjs
npm run smoke:kws-runtime
npm run smoke:voice-panel-gating
npm run smoke:brain-ui
npm run smoke:voice-events
npm run smoke:voice-manager
npm run build:mac
```

## Release 附件

本 Release 应上传：

- `BaiLongma-source-v2.4.0.zip`：源码快照。
- `BaiLongma-v2.4.0.bundle`：离线 Git bundle。
- `Bailongma-2.4.0-arm64.dmg`：Mac Apple Silicon 安装包。
- `Bailongma-2.4.0-mac-arm64.zip`：Mac Apple Silicon zip 包。
- `latest-mac.yml`：自动更新元数据。

## 不包含内容

- 不上传 `.env`。
- 不上传 `config.json` 本机配置。
- 不上传 `data/` 本地数据库/记忆。
- 不上传 `node_modules/`。
- 不上传本地 `.onnx` 模型权重。
- 不上传虚拟环境和运行时缓存。

## 已知限制

- 项目不内置 openWakeWord 第三方模型权重，需要用户自行导入或提供下载 URL。
- openWakeWord 依赖安装需要本机 Python/pip 可用，网络不可用时会失败。
- sherpa-onnx KWS 还未完成完整模型组配置和运行时闭环。
- Mac 安装包未做 Apple notarization，其他 Mac 首次打开可能需要在“系统设置 -> 隐私与安全性”中允许。
