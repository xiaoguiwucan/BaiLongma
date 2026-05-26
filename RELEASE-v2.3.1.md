# v2.3.1 Mac Electron 打包部署补丁版

发布时间：2026-05-26

这是 v2.3.0 之后的 Mac 桌面部署补丁版本。它不改变本地语音、声纹、唤醒词或小智式语音协议的核心运行逻辑，重点解决当前项目仍是 Windows-first 打包配置的问题，让 Mac 用户可以直接执行明确的 Electron 桌面打包流程，并把发布目标修正到当前维护仓库。

## 更新内容

- `package.json` / `package-lock.json` 版本升级到 `2.3.1`。
- 默认 `npm run build` 改为执行 Mac 打包流程。
- 新增 `npm run build:mac`：默认生成 Apple Silicon arm64 的 macOS `.dmg` 和 `.zip`。
- 新增 `npm run build:mac:x64`：给 Intel Mac 单独构建 x64 版本。
- 新增 `npm run publish:mac` / `npm run publish:mac:x64`，并让 `npm run publish` 默认发布 Mac arm64 版本。
- 保留 Windows 构建与发布命令：`npm run build:win` / `npm run publish:win`。
- 新增跨平台清理脚本 `scripts/prebuild-clean.mjs`，Mac 构建不再依赖 PowerShell。
- 新增 macOS 图标文件 `build/icon.icns`，由现有 Mac 卡通图标生成。
- Electron Builder 的 GitHub publish 目标从旧上游 `xiaoyuanda666-ship-it/BaiLongma` 修正为当前维护仓库 `xiaoguiwucan/BaiLongma`。
- README、CHANGELOG、备份文档和 Brain UI 设置页的“更新说明”已同步写入 v2.3.1 内容。

## 改变原因

- 当前目标是把 BaiLongma 作为自己的 Mac Electron 桌面项目维护和部署，而旧配置仍默认构建 Windows NSIS 安装包。
- v2.3.0 已经完成本地语音稳定性收束，但还缺一个可执行、可发布、可回滚的 Mac 桌面安装包版本点。
- 本次按“不要长时间堆积未发布改动”的要求，及时收束为一个有实际安装包产物的补丁版本。

## Mac 部署方式

源码运行：

```bash
npm install
npm start
```

Apple Silicon Mac 打包：

```bash
npm install
npm run build:mac
```

Intel Mac 打包：

```bash
npm install
npm run build:mac:x64
```

构建产物位于 `dist/`。本 Release 已上传 Apple Silicon arm64 的 `.dmg` 和 `.zip`。

## 验证结果

已通过：

- `node --check scripts/prebuild-clean.mjs`
- `node --check src/ui/brain-ui/app-shell.js`
- `package.json` / `package-lock.json` JSON 与版本一致性检查
- `npm run smoke:voice-manager`：7/7 通过
- `npm run smoke:voice-events`：92/92 通过
- `npm run smoke:brain-ui`：通过
- `npm run build:mac`：成功生成 Apple Silicon arm64 `.dmg` 和 `.zip`

## Release 附件说明

- `BaiLongma-source-v2.3.1.zip`：Git 追踪源码快照，不包含 `.env`、`config.json`、`data/`、`node_modules/`、本地模型目录和虚拟环境。
- `BaiLongma-v2.3.1.bundle`：Git bundle，可离线恢复到本版本提交历史。
- `Bailongma-2.3.1-arm64.dmg`：Apple Silicon Mac 安装包。
- `Bailongma-2.3.1-mac-arm64.zip`：Apple Silicon Mac zip 包，适合备份/自动更新场景。
- `latest-mac.yml`：Electron updater 的 macOS 更新元数据。

## 已知限制

- 当前 Mac 包没有做 notarization；首次在其他 Mac 打开时，可能需要到“系统设置 -> 隐私与安全性”允许打开。
- 本 Release 上传的是 Apple Silicon arm64 包；Intel Mac 请在 Intel 环境或可用 x64 Electron 下载环境中执行 `npm run build:mac:x64` 生成。
- Windows 安装包未在本次 Release 重新生成；Windows 构建命令仍保留为 `npm run build:win`。
