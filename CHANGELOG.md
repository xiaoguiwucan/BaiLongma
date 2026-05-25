# 更新日志

所有重要版本都需要在这里写清楚：版本号、日期、改动内容、部署/备份注意事项。以后每次升级版本，必须同步更新 `package.json`、`package-lock.json`、`README.md`、`BACKUP-YYYY-MM-DD.md` 和 Brain UI 设置页里的更新说明。

维护铁规：任何版本修改、功能更新、修复、文档更新，只要形成版本，都必须上传 GitHub 备份，并创建 GitHub Release。Release 里必须写清更新内容、改变原因、部署方式、备份附件说明和已知限制，不能只推 commit 或 tag。

## v2.1.233 - 2026-05-26

### 更新内容

- v2.1.232 的固定 `tts:speak` 安全限制改为可配置。
- `/settings/tts` 新增并返回：
  - `voiceEventsTtsSpeakMaxTextChars`，默认 800，范围 40-3000；
  - `voiceEventsTtsSpeakCooldownMs`，默认 1200，范围 0-10000。
- Brain UI 设置页“语音合成（TTS）”新增“外部语音客户端限制”：
  - 最大文本字符；
  - 单连接冷却 ms。
- `/voice/events/protocol` 会读取当前配置并返回 active `limits.ttsSpeak`。
- `/voice/events` WebSocket hello 会携带当前配置后的 `limits.ttsSpeak`。
- `validateVoiceEventClientMessage()` 支持传入配置化 limits。
- WebSocket `tts:speak` 的超长文本校验和 per-connection 冷却都改为使用当前 TTS 设置。
- `scripts/smoke-voice-mapping.mjs` 从 22 项扩展到 25 项。
- `scripts/smoke-voice-events.mjs` 从 23 项扩展到 26 项，覆盖 `/settings/tts` 持久化、protocol 动态反映配置、hello 动态反映配置。

### 改变原因

- 不同设备和场景对 `tts:speak` 限制要求不同：硬件按钮适合更短文本，桌面调试可能需要更长文本。
- 外部客户端应该从协议元数据中获取当前 active limits，而不是写死 800/1200。
- 用户需要能在设置页调整限制，不必改代码。

### 影响范围

- 默认行为保持 v2.1.232：800 字符、1200ms 冷却。
- 用户可以在设置页或 `POST /settings/tts` 调整限制。
- 设置会影响新连接的 hello、`/voice/events/protocol`、文本长度校验和限流回执。
- 仍然是单连接冷却，不是全局/IP 级限流。

### 验证结果

- `node --check src/voice/voice-event-bus.js` 通过。
- `node --check src/config.js` 通过。
- `node --check src/api.js` 通过。
- `node --check src/ui/brain-ui/app-shell.js` 通过。
- `node --check src/ui/brain-ui/app.js` 通过。
- `node --check scripts/smoke-voice-mapping.mjs` 通过。
- `node --check scripts/smoke-voice-events.mjs` 通过。
- `npm run smoke:voice-mapping` 25/25 通过。
- `npm run smoke:voice-events` 26/26 通过。
- `npm run smoke:tools` 6/6 通过；本机 Node v24 下仍有已知 `better-sqlite3` ABI 日志警告。

### 部署注意事项

- 源码部署方式不变：`npm install` 后 `npm start`。
- 设置页保存后，新连接的 `/voice/events` hello 会使用新限制。
- 外部客户端应每次连接前读取 `/voice/events/protocol`，不要缓存旧 limits。

## v2.1.232 - 2026-05-26

### 更新内容

- `/voice/events` WebSocket `tts:speak` 新增安全限制：
  - 最大文本长度：800 字符；
  - 单连接冷却：1200ms。
- 新增协议能力 `tts_speak_limits`。
- `/voice/events/protocol` 新增 `limits.ttsSpeak`：
  - `maxTextChars`；
  - `cooldownMs`。
- `errorCodes` 新增：
  - `text_too_long`：文本超过最大长度；
  - `rate_limited`：同一 WebSocket 连接发送 `tts:speak` 太快。
- `validateVoiceEventClientMessage()` 现在会校验 `tts:speak` / `speak` 文本长度。
- WebSocket 边界新增 per-connection `tts:speak` 冷却保护，并在限流时返回 `retryAfterMs`。
- `scripts/smoke-voice-mapping.mjs` 从 20 项扩展到 22 项，覆盖限制元数据和超长文本校验。
- `scripts/smoke-voice-events.mjs` 从 20 项扩展到 23 项，覆盖协议端点限制、超长文本错误和快速重复 speak 限流错误。

### 改变原因

- 外部设备或调试客户端如果误发超长文本，可能导致慢 TTS、较大的音频流和不稳定体验。
- 快速连续发送 `tts:speak` 会不断取消并重建 TTS session，不适合作为硬件端默认行为。
- 把限制写进协议元数据，可以让客户端在发送前自检并做 UI 限制，而不是等服务端报错。

### 影响范围

- 合法短文本 `tts:speak` 行为保持兼容。
- 超过 800 字符的文本会收到 `protocol_error / text_too_long`。
- 同一 WebSocket 连接在 1200ms 内重复发送 `tts:speak` 会收到 `protocol_error / rate_limited`，并带 `retryAfterMs`。
- 限制是 per-connection，不是全局/IP 级别。

### 验证结果

- `node --check src/voice/voice-event-bus.js` 通过。
- `node --check src/api.js` 通过。
- `node --check scripts/smoke-voice-mapping.mjs` 通过。
- `node --check scripts/smoke-voice-events.mjs` 通过。
- `npm run smoke:voice-mapping` 22/22 通过。
- `npm run smoke:voice-events` 23/23 通过。
- `npm run smoke:tools` 6/6 通过；本机 Node v24 下仍有已知 `better-sqlite3` ABI 日志警告。

### 部署注意事项

- 源码部署方式不变：`npm install` 后 `npm start`。
- 外部客户端应优先读取 `/voice/events/protocol` 的 `limits.ttsSpeak`，在本地 UI 或硬件逻辑中限制输入长度和发送频率。
- 客户端应处理 `text_too_long` 和 `rate_limited`，后者可参考 `retryAfterMs` 再重试。

## v2.1.231 - 2026-05-26

### 更新内容

- `/voice/events` WebSocket 新增客户端消息校验。
- 新增 `protocol_errors` 协议能力声明。
- `getVoiceEventsProtocolMetadata()` 新增：
  - `voice:subscribe` / `voice:unsubscribe` 兼容消息声明；
  - `errorCodes`：`invalid_json`、`invalid_message`、`missing_type`、`unsupported_type`、`missing_text`。
- 新增 `validateVoiceEventClientMessage(msg)`，用于纯函数检查客户端消息是否合法。
- 新增 `createVoiceEventProtocolError()` / `sendVoiceEventProtocolError()`，统一输出结构化错误回执。
- WebSocket 收到以下异常输入时不再静默失败，而是返回 `protocol_error`：
  - 非法 JSON：`invalid_json`；
  - 非对象消息：`invalid_message`；
  - 缺少 `type`：`missing_type`；
  - 未支持的类型：`unsupported_type`；
  - `tts:speak` / `speak` 缺少非空文本：`missing_text`。
- `scripts/smoke-voice-mapping.mjs` 从 15 项扩展到 20 项，覆盖协议能力和消息校验纯函数。
- `scripts/smoke-voice-events.mjs` 从 17 项扩展到 20 项，覆盖 invalid JSON、unsupported type、empty `tts:speak` 的 WebSocket 错误回执。

### 改变原因

- ESP32/硬件端、手机端和桌面调试客户端如果发错消息，之前可能只看到“没有反应”，很难定位是 JSON 错误、类型写错还是 `tts:speak` 缺文本。
- 小智式语音服务端需要可诊断性：错误也应该是协议的一部分，客户端可以按 `code` 做日志、重试或降级。
- 这一步为后续 SDK、Schema 文档、鉴权和限流打基础。

### 影响范围

- 保持向后兼容：合法的 `ping`、`subscribe`、`unsubscribe`、`tts:speak`、`tts:cancel` 行为不变。
- 新增错误消息类型 `protocol_error`，只在客户端输入不合法或不支持时出现。
- `tts:speak` 的空文本错误从 TTS error 提前为协议层 `missing_text`，更明确也更容易被外部客户端处理。

### 验证结果

- `node --check src/voice/voice-event-bus.js` 通过。
- `node --check src/api.js` 通过。
- `node --check scripts/smoke-voice-mapping.mjs` 通过。
- `node --check scripts/smoke-voice-events.mjs` 通过。
- `npm run smoke:voice-mapping` 20/20 通过。
- `npm run smoke:voice-events` 20/20 通过。
- `npm run smoke:tools` 6/6 通过；本机 Node v24 下仍有已知 `better-sqlite3` ABI 日志警告。

### 部署注意事项

- 源码部署方式不变：`npm install` 后 `npm start`。
- 外部客户端可通过 `/voice/events/protocol` 检查 `capabilities` 是否包含 `protocol_errors`。
- 客户端应监听 `protocol_error` 并按 `code` 输出日志或提示，例如 `invalid_json`、`unsupported_type`、`missing_text`。

## v2.1.230 - 2026-05-26

### 更新内容

- `src/voice/voice-event-bus.js` 新增共享协议常量：
  - `VOICE_EVENTS_PROTOCOL_VERSION`；
  - `VOICE_EVENTS_PROTOCOL_CAPABILITIES`；
  - `VOICE_EVENTS_PROTOCOL_STATES`。
- 新增 `getVoiceEventsProtocolMetadata()`，集中返回服务名、版本、能力、HTTP/WebSocket 端点、客户端消息类型、映射状态和音频订阅示例。
- WebSocket `/voice/events` hello 消息改为复用协议元数据，避免 hello、status、文档和测试之间出现版本漂移。
- `GET /voice/events/status` 的版本号改为复用 `VOICE_EVENTS_PROTOCOL_VERSION`。
- `src/api.js` 新增 `GET /voice/events/protocol`，返回当前语音事件协议元数据。
- `scripts/smoke-voice-mapping.mjs` 增加协议元数据纯函数检查，从 13 项扩展到 15 项。
- `scripts/smoke-voice-events.mjs` 增加 `/voice/events/protocol` HTTP 集成检查，从 15 项扩展到 17 项。

### 改变原因

- 小智式外部设备、桌面调试客户端或未来移动端接入前，需要先知道当前服务支持哪些协议能力、端点和消息类型。
- 只靠 Markdown 文档或 WebSocket hello 不够稳定；HTTP metadata endpoint 可以让客户端在打开 WebSocket、订阅音频或发送 `tts:speak` 前先做兼容性自检。
- 共享常量能减少后续继续扩展协议时出现“hello 写了一个版本、status 写了另一个版本、测试又写死第三个版本”的维护风险。

### 影响范围

- 新增向后兼容的 HTTP 查询端点，不改变既有 `/voice/events` WebSocket 消息形状。
- 既有客户端可以继续只连接 WebSocket；新客户端可优先请求 `/voice/events/protocol` 做能力发现。
- WebSocket hello 消息字段更完整，会额外包含 `endpoints/clientMessages/mappedStates/audio` 等元数据。

### 验证结果

- `node --check src/voice/voice-event-bus.js` 通过。
- `node --check src/api.js` 通过。
- `node --check scripts/smoke-voice-mapping.mjs` 通过。
- `node --check scripts/smoke-voice-events.mjs` 通过。
- `npm run smoke:voice-mapping` 15/15 通过。
- `npm run smoke:voice-events` 17/17 通过。
- `npm run smoke:tools` 6/6 通过；本机 Node v24 下仍有已知 `better-sqlite3` ABI 日志警告。

### 部署注意事项

- 源码部署方式不变：`npm install` 后 `npm start`。
- 外部客户端可以访问 `http://127.0.0.1:3721/voice/events/protocol` 获取协议元数据。
- 调试建议：先请求 `/voice/events/protocol`，确认 `capabilities` 包含 `tts_speak` 和 `tts_audio_chunks` 后再连接 `ws://127.0.0.1:3721/voice/events`。

## v2.1.229 - 2026-05-26

### 更新内容

- `src/voice/voice-event-bus.js` 导出纯函数 `mapVoiceEventToXiaozhi(event)`。
- 新增 `scripts/smoke-voice-mapping.mjs`。
- 新增 npm script：`npm run smoke:voice-mapping`。
- 新增 13 项快速映射检查，覆盖：
  - ASR partial/final；
  - wake accepted/rejected；
  - TTS start/sentence_start/audio_ready/sentence_end/stop；
  - audio_ready 默认 `contentType`；
  - interrupt source fallback；
  - unknown/null 事件返回 `null`。

### 改变原因

- v2.1.225-v2.1.228 通过 WebSocket smoke 间接保护事件映射，但每次都需要启动临时 API server。
- 抽出纯函数并新增快速 mapping smoke 后，可以在不启动服务端的情况下快速验证核心协议映射，降低后续改动成本。

### 影响范围

- 不改变运行时协议行为。
- 只是把原内部映射函数作为可测试 API 导出，并新增测试脚本。

### 验证结果

- `node --check src/voice/voice-event-bus.js` 通过。
- `node --check scripts/smoke-voice-mapping.mjs` 通过。
- `npm run smoke:voice-mapping` 13/13 通过。
- `npm run smoke:voice-events` 15/15 通过。
- `npm run smoke:tools` 6/6 通过；本机 Node v24 下仍有已知 `better-sqlite3` ABI 日志警告。

### 部署注意事项

- 源码部署方式不变：`npm install` 后 `npm start`。
- 开发者可运行 `npm run smoke:voice-mapping` 快速验证事件映射，无需启动后端。

## v2.1.228 - 2026-05-26

### 更新内容

- 继续增强 `scripts/smoke-voice-events.mjs`。
- `npm run smoke:voice-events` 从 11 项检查扩展到 15 项检查。
- 在 `POST /voice/events/publish` smoke 中补齐 TTS lifecycle 事件：
  - `tts:start`；
  - `tts:sentence_start`；
  - `tts:audio_ready`；
  - `tts:sentence_end`；
  - `tts:stop`。
- 新增断言这些事件能映射为小智式 `tts start / sentence_start / audio_ready / sentence_end / stop`，并保留 `sessionId/index/text/url/reason` 等关键字段。

### 改变原因

- v2.1.227 已覆盖 wake 和 `tts:audio_ready`，但 TTS 完整生命周期还缺 start、sentence_start、sentence_end、stop 的自动保护。
- 外部设备播放队列依赖这些事件判断一轮 TTS 的开始、每句开始结束和整体停止，需要纳入 smoke。

### 影响范围

- 不改变运行时协议行为。
- 只增强 smoke 测试覆盖范围。

### 验证结果

- `node --check scripts/smoke-voice-events.mjs` 通过。
- `npm run smoke:voice-events` 15/15 通过。
- `node --check scripts/voice-events-client.mjs` 通过。
- `npm run smoke:tools` 6/6 通过；本机 Node v24 下仍有已知 `better-sqlite3` ABI 日志警告。

### 部署注意事项

- 源码部署方式不变：`npm install` 后 `npm start`。
- 开发者可运行 `npm run smoke:voice-events` 验证 WebSocket 协议核心映射。

## v2.1.227 - 2026-05-26

### 更新内容

- 继续增强 `scripts/smoke-voice-events.mjs`。
- `npm run smoke:voice-events` 从 9 项检查扩展到 11 项检查。
- 在 `POST /voice/events/publish` smoke 中新增事件：
  - `wake:accepted`；
  - `tts:audio_ready`。
- 新增断言：
  - `wake:accepted` 能映射为小智式 `{type:"wake", state:"accepted"}`；
  - `tts:audio_ready` 能映射为小智式 `{type:"tts", state:"audio_ready"}`，并保留 `sessionId/url/contentType`。

### 改变原因

- v2.1.226 只覆盖 `asr:final -> stt final`，还不足以保护唤醒和 TTS 音频段这两条关键外部协议。
- 唤醒成功和音频就绪是外部硬件端最依赖的事件之一，需要纳入自动 smoke。

### 影响范围

- 不改变运行时协议行为。
- 只增强 smoke 测试覆盖范围。

### 验证结果

- `node --check scripts/smoke-voice-events.mjs` 通过。
- `npm run smoke:voice-events` 11/11 通过。
- `node --check scripts/voice-events-client.mjs` 通过。
- `npm run smoke:tools` 6/6 通过；本机 Node v24 下仍有已知 `better-sqlite3` ABI 日志警告。

### 部署注意事项

- 源码部署方式不变：`npm install` 后 `npm start`。
- 开发者可运行 `npm run smoke:voice-events` 验证 WebSocket 协议和核心小智式映射。

## v2.1.226 - 2026-05-26

### 更新内容

- 增强 `scripts/smoke-voice-events.mjs`。
- `npm run smoke:voice-events` 从 7 项检查扩展到 9 项检查。
- 新增覆盖 `POST /voice/events/publish`：
  - smoke 会通过 HTTP 发布 `asr:final` 事件；
  - 验证 WebSocket 客户端收到原始 `voice_event`；
  - 验证 WebSocket 客户端收到小智式 `{type:"stt", state:"final"}` 映射。

### 改变原因

- v2.1.225 只验证了 WebSocket 连接、订阅、ping 和 cancel 基础行为，没有覆盖 Brain UI 到后端事件总线的 HTTP bridge。
- `/voice/events/publish` 是浏览器语音事件转发给外部客户端的关键路径，需要纳入自动 smoke，防止后续改动破坏 raw event 或小智式映射。

### 影响范围

- 不改变运行时协议行为。
- 只增强 smoke 测试覆盖范围。

### 验证结果

- `node --check scripts/smoke-voice-events.mjs` 通过。
- `npm run smoke:voice-events` 9/9 通过。
- `node --check scripts/voice-events-client.mjs` 通过。
- `npm run smoke:tools` 6/6 通过；本机 Node v24 下仍有已知 `better-sqlite3` ABI 日志警告。

### 部署注意事项

- 源码部署方式不变：`npm install` 后 `npm start`。
- 开发者可运行 `npm run smoke:voice-events` 验证 WebSocket 协议和 `/voice/events/publish` 桥接映射。

## v2.1.225 - 2026-05-26

### 更新内容

- 新增 `scripts/smoke-voice-events.mjs`。
- 新增 npm script：`npm run smoke:voice-events`。
- 自动启动临时 API 服务并验证 `/voice/events` 基础协议：
  - `/voice/events/status` 返回协议版本；
  - WebSocket hello service/version/capabilities；
  - ping/pong；
  - subscribe audio/binaryAudio；
  - `tts:cancel` 在无 active speak 时返回结构化 `no_active_session`；
  - socket 关闭后 status 中 client 数归零。

### 改变原因

- v2.1.224 已把协议写成文档，但后续修改仍需要自动化保护，避免不小心破坏 hello、订阅、取消或状态统计。
- 该 smoke 测试为未来 ESP32/手机端接入和 CI 集成打基础。

### 影响范围

- 不改变运行时协议行为。
- 新增测试脚本会在本机临时启动一个 API server，默认端口 `39221`，结束后自动关闭。

### 验证结果

- `node --check scripts/smoke-voice-events.mjs` 通过。
- `npm run smoke:voice-events` 7/7 通过。
- `node --check scripts/voice-events-client.mjs` 通过。
- `npm run smoke:tools` 6/6 通过；本机 Node v24 下仍有已知 `better-sqlite3` ABI 日志警告。

### 部署注意事项

- 源码部署方式不变：`npm install` 后 `npm start`。
- 开发者可运行 `npm run smoke:voice-events` 快速确认语音协议基础行为。
- 如果默认端口被占用，可设置 `BAILONGMA_VOICE_SMOKE_PORT=其他端口`。

## v2.1.224 - 2026-05-26

### 更新内容

- 新增 `docs/VOICE_EVENTS_PROTOCOL.md`。
- 文档固化 `/voice/events` WebSocket v3 协议，包括：
  - 连接端点和状态接口；
  - hello/version/capabilities；
  - ping/pong；
  - subscribe/unsubscribe 音频块订阅；
  - 原始 `voice_event` 与小智式 JSON 映射；
  - TTS `audio_start/audio_chunk/audio_end/audio_error`；
  - WebSocket `tts:speak`；
  - WebSocket `tts:cancel`；
  - CLI 调试客户端用法；
  - ESP32/手机端实现建议；
  - 当前限制和安全注意事项。
- README 增加协议文档入口。

### 改变原因

- v2.1.218-v2.1.223 已形成可用的语音 WebSocket 协议和调试客户端，但外部硬件/手机端接入还缺一份稳定说明书。
- 将协议文档化后，后续才能更稳地做 ESP32/手机端客户端、自动化测试和 Opus 帧升级。

### 影响范围

- 纯文档版本，不改变运行时代码逻辑。
- 不改变 Brain UI 和服务端协议行为。

### 验证结果

- `node -e` 检查 `docs/VOICE_EVENTS_PROTOCOL.md` 存在且包含 `tts:speak` 通过。
- `node --check scripts/voice-events-client.mjs` 通过。
- `node scripts/voice-events-client.mjs --help` 输出正常。
- `npm run smoke:tools` 6/6 通过；本机 Node v24 下仍有已知 `better-sqlite3` ABI 日志警告。

### 部署注意事项

- 源码部署方式不变：`npm install` 后 `npm start`。
- 外部客户端开发前建议先阅读 `docs/VOICE_EVENTS_PROTOCOL.md`，再用 `npm run voice:events` 验证本机协议。

## v2.1.223 - 2026-05-26

### 更新内容

- 新增 `scripts/voice-events-client.mjs` 语音 WebSocket 协议调试客户端。
- 新增 npm script：`npm run voice:events`。
- 调试客户端支持：
  - `status`：读取 `/voice/events/status`；
  - `listen`：连接 `ws://127.0.0.1:3721/voice/events` 并打印 JSON 事件；
  - `listen --audio --binary --save out.mp3`：订阅音频块并保存二进制音频；
  - `speak "文本" --binary --save out.mp3`：发送 `tts:speak` 并保存返回音频；
  - `cancel`：发送 `tts:cancel`。
- README 增加语音 WebSocket 调试命令示例，方便后续 ESP32/手机端接入前先在 Mac 上验证协议。

### 改变原因

- v2.1.218-v2.1.222 已连续增强 `/voice/events` 协议，但缺少稳定的本地调试入口。
- 外部硬件/手机端接入前，需要一个可复用命令来确认 hello、事件、speak、cancel、base64/binary 音频块是否正常。
- 这个脚本也能作为后续自动化集成测试的基础。

### 影响范围

- 不改变服务端协议行为。
- 不改变 Brain UI。
- 新增脚本只用于开发、调试和外部设备接入验证。

### 验证结果

- `node --check scripts/voice-events-client.mjs` 通过。
- `node scripts/voice-events-client.mjs --help` 输出正常（并修正 --help 退出码为 0）。
- `node --check src/api.js` 通过。
- `node --check src/voice/voice-event-bus.js` 通过。
- `npm run smoke:tools` 6/6 通过；本机 Node v24 下仍有已知 `better-sqlite3` ABI 日志警告。

### 部署注意事项

- 源码部署方式不变：`npm install` 后 `npm start`。
- 需要先启动白龙马后端或 Electron，再运行 `npm run voice:events -- status/listen/speak/cancel`。
- 若要连接局域网机器，可通过 `--url ws://<MacIP>:3721/voice/events` 或环境变量 `BAILONGMA_VOICE_WS` 指定。

## v2.1.222 - 2026-05-26

### 更新内容

- 新增 WebSocket TTS 取消消息：
  - `{"type":"tts:cancel"}`
  - 兼容短写 `{"type":"cancel"}`。
- 同一个 WebSocket 客户端发起新的 `tts:speak` 时，会自动取消旧的 speak session，并发送 `tts stop` / `tts cancelled`。
- 客户端断开连接或发生 socket error 时，会自动取消当前 speak session，避免继续生成无人接收的旧音频。
- TTS segment 流式发送过程中会检查 session 是否已取消、连接是否关闭、当前 requestId 是否仍然有效；取消后会尝试 destroy 当前 provider audio stream。
- `tts:cancel` 会返回结构化结果：`type=tts`、`state=cancelled`、`cancelled=true/false`、`reason`、`sessionId`。

### 改变原因

- v2.1.221 已支持外部客户端直接发 `tts:speak`，但缺少真实语音助手必须具备的打断/取消能力。
- 视频播放、用户插话、硬件端断线、新一轮回复都会要求旧 TTS 立即停止；否则会出现旧音频串话或后台浪费生成。
- 本版本补齐 speak 生命周期守卫，让 WebSocket TTS 更接近可用于外部设备的服务端能力。

### 影响范围

- 不改变 Brain UI 桌面端原有 TTS 播放路径。
- 不改变 HTTP `/tts/session/:id/audio/:index` 行为。
- 只增强 `/voice/events` WebSocket 的 speak/cancel 生命周期。

### 验证结果

- `node --check src/api.js` 通过。
- `node --check src/voice/voice-event-bus.js` 通过。
- `node --check src/ui/brain-ui/app-shell.js` 通过。
- `npm run smoke:tools` 6/6 通过；本机 Node v24 下仍有已知 `better-sqlite3` ABI 日志警告。

### 部署注意事项

- 源码部署方式不变：`npm install` 后 `npm start`。
- 外部客户端连接 `ws://127.0.0.1:3721/voice/events`。
- 发送 `{"type":"tts:cancel"}` 可取消当前连接正在进行的 speak；发送新的 `tts:speak` 会自动替换旧 speak。
- 当前只能取消同一个 WebSocket 连接发起的 active speak。

## v2.1.221 - 2026-05-26

### 更新内容

- `/voice/events` WebSocket 协议升级到 version 3，hello 能力新增 `tts_speak`。
- 新增 WebSocket 直接 TTS 请求：
  - `{"type":"tts:speak","text":"你好","binaryAudio":true}`
  - 也兼容 `{"type":"speak","text":"你好"}`。
- 外部客户端不再必须依赖 Brain UI 先播放 TTS；可以在同一个 WebSocket 上发送文本，并收到：
  - `tts session`
  - `tts start`
  - `tts sentence_start`
  - `tts audio_ready`
  - `tts audio_start`
  - `tts audio_chunk` metadata
  - base64 JSON 或二进制音频 chunk
  - `tts audio_end`
  - `tts sentence_end`
  - `tts stop`
- `tts:speak` 会复用现有 TTS Provider 配置和分句器，按句生成音频并回传到发起请求的客户端。

### 改变原因

- v2.1.220 的音频块广播仍由桌面端 HTTP segment 播放触发，外部设备只是“旁路监听”。
- 小智式服务端需要外部设备能主动请求 TTS 并接收事件/音频，本版本开始提供单连接 `tts:speak` 流程。
- 这为后续 ESP32/手机端直接接入白龙马语音服务端打基础。

### 影响范围

- 不改变 Brain UI 桌面端播放路径。
- 不改变 TTS Provider 凭证配置方式。
- 新功能只影响连接 `/voice/events` 并发送 `tts:speak` 的外部客户端。

### 验证结果

- `node --check src/voice/voice-event-bus.js` 通过。
- `node --check src/api.js` 通过。
- `node --check src/ui/brain-ui/app-shell.js` 通过。
- `npm run smoke:tools` 6/6 通过；本机 Node v24 下仍有已知 `better-sqlite3` ABI 日志警告。

### 部署注意事项

- 源码部署方式不变：`npm install` 后 `npm start`。
- 外部客户端连接 `ws://127.0.0.1:3721/voice/events`。
- 示例：发送 `{"type":"tts:speak","text":"测试白龙马语音服务端","binaryAudio":true}` 即可开始接收分句事件和音频 chunk。
- 当前音频仍是 Provider 返回的 `audio/mpeg` chunk，还不是 Opus 编码帧。

## v2.1.220 - 2026-05-26

### 更新内容

- `/voice/events` WebSocket 升级到协议版本 2，hello 消息新增 `capabilities: ["json_events", "tts_audio_chunks"]`。
- 新增客户端订阅消息：
  - `{"type":"subscribe","audio":true}`：订阅 TTS 音频块，音频数据以 base64 JSON 发送；
  - `{"type":"subscribe","audio":true,"binaryAudio":true}`：订阅 TTS 音频块，并在每个 metadata 后发送二进制音频 chunk；
  - `{"type":"unsubscribe","audio":false,"binaryAudio":false}`：关闭音频块订阅。
- TTS 分句音频流 `/tts/session/:id/audio/:index` 在 HTTP 播放同时，会向已订阅 WebSocket 客户端广播：
  - `tts audio_start`
  - `tts audio_chunk` metadata
  - `tts audio_chunk_base64` 或二进制 chunk
  - `tts audio_end` / `tts audio_error`
- `/voice/events/status` 新增 `audioSubscribers`、`binaryAudioSubscribers` 和 `version` 字段。

### 改变原因

- v2.1.219 已让外部客户端知道“第几句音频在哪里取”，但仍需要客户端再发 HTTP 请求。
- 小智式协议最终更接近“WebSocket 控制事件 + 音频帧”模式；本版本加入显式订阅的音频块广播，让外部设备可以开始验证单连接收音频的流程。
- 默认不推送音频块，避免破坏只想看 JSON 生命周期事件的调试客户端。

### 影响范围

- 桌面端原有 TTS 播放逻辑不变，仍通过 HTTP segment 播放。
- 未发送订阅消息的 WebSocket 客户端行为基本不变，只会看到 hello version/capabilities 增强。
- 订阅 base64 模式会增加 WebSocket JSON 体积；二进制模式更接近未来 Opus 帧方向。

### 验证结果

- `node --check src/voice/voice-event-bus.js` 通过。
- `node --check src/api.js` 通过。
- `npm run smoke:tools` 6/6 通过；本机 Node v24 下仍有已知 `better-sqlite3` ABI 日志警告。

### 部署注意事项

- 源码部署方式不变：`npm install` 后 `npm start`。
- 外部客户端仍连接 `ws://127.0.0.1:3721/voice/events`。
- 示例：连接后发送 `{"type":"subscribe","audio":true,"binaryAudio":true}`，再触发 Brain UI 的 TTS 回复，即可收到音频块 metadata 和二进制 chunk。
- 本版本广播的是当前 Provider 返回的原始 `audio/mpeg` chunk，还不是 Opus 编码帧。

## v2.1.219 - 2026-05-26

### 更新内容

- 新增语音事件类型 `tts:audio_ready`，在每个 TTS 分句即将请求音频时广播。
- Brain UI 分句 TTS 播放队列现在会为每个音频段生成稳定的 HTTP URL：`/tts/session/:id/audio/:index`。
- `/voice/events` WebSocket 会把 `tts:audio_ready` 映射为小智式 JSON：`{ "type": "tts", "state": "audio_ready", "sessionId", "index", "text", "url", "contentType" }`。
- 原始 `voice_event` 仍会保留完整 detail，包括 `absoluteUrl`，方便本机调试工具直接拉取音频。

### 改变原因

- v2.1.218 只暴露了 wake/stt/tts 生命周期 JSON，外部客户端知道“开始说第几句”，但不知道去哪取对应音频。
- 小智式体验最终需要“事件 + 音频数据”同步；本版本先用低风险的音频 URL/元数据方案，为后续 WebSocket 二进制 Opus 帧、硬件端播放和手机端播放打基础。

### 影响范围

- 不改变现有桌面端 TTS 播放效果。
- 不改变 TTS Provider，也不新增云端依赖。
- 新增事件只在分句 TTS 队列播放时产生；旧 `/tts/stream` 试听接口不广播音频段事件。

### 验证结果

- `node --check src/voice/voice-events.js` 通过。
- `node --check src/voice/voice-event-bus.js` 通过。
- `node --check src/ui/brain-ui/app.js` 通过。
- `node --check src/api.js` 通过。
- `npm run smoke:tools` 6/6 通过；本机 Node v24 下仍有已知 `better-sqlite3` ABI 日志警告。

### 部署注意事项

- 源码部署方式不变：`npm install` 后 `npm start`。
- 外部客户端仍连接 `ws://127.0.0.1:3721/voice/events`。
- 收到 `tts audio_ready` 后，可用同源 HTTP GET 拉取 `url` 字段对应音频；局域网客户端需要把 host 替换为运行白龙马的 Mac 地址，并确认端口暴露策略。

## v2.1.218 - 2026-05-26

### 更新内容

- 新增 `src/voice/voice-event-bus.js`，提供后端语音事件广播能力。
- 新增实验性 WebSocket 端点：`ws://127.0.0.1:3721/voice/events`。
- 新增 HTTP 状态/桥接端点：
  - `GET /voice/events/status`
  - `POST /voice/events/publish`
- Brain UI 会把浏览器端 `bailongma:voice-event` 转发给后端事件通道。
- WebSocket 客户端会收到两类消息：
  - 原始 `voice_event`；
  - 映射后的小智式 JSON，例如 `tts start`、`tts sentence_start`、`tts stop`、`stt final`、`wake accepted`。

### 改变原因

- v2.1.217 已经统一了浏览器内部语音事件；v2.1.218 把这些事件暴露给外部客户端，为手机端、硬件端或局域网调试工具接入做准备。
- 这一步先做 JSON 生命周期事件，不直接做二进制 Opus 音频帧，风险更低。

### 影响范围

- 不改变现有 Electron 语音交互。
- 不改变 ASR/TTS Provider。
- 新通道是实验性的，只广播事件，不传输音频帧。

### 验证结果

- `node --check src/voice/voice-event-bus.js` 通过。
- `node --check src/api.js` 通过。
- `node --check src/ui/brain-ui/app.js` 通过。
- `npm run smoke:tools` 6/6 通过；本机 Node v24 下仍有已知 `better-sqlite3` ABI 日志警告。

### 部署注意事项

- 源码部署方式不变。
- 外部客户端可以连接 `ws://127.0.0.1:3721/voice/events` 观察事件。
- 若要局域网访问，需要按现有 LAN 启动方式暴露后端端口，并自行注意安全。

## v2.1.217 - 2026-05-26

### 更新内容

- 新增 `src/voice/voice-events.js`，提供浏览器端统一语音事件总线。
- 新增统一事件 `bailongma:voice-event`，事件对象包含 `type`、`seq`、`at`、`detail`。
- 规范小智式语音事件类型：
  - `wake:start`
  - `wake:accepted`
  - `wake:rejected`
  - `asr:partial`
  - `asr:final`
  - `speaker:rejected`
  - `tts:start`
  - `tts:sentence_start`
  - `tts:sentence_end`
  - `tts:stop`
  - `interrupt`
  - `media:duck`
- 前端语音面板接入 wake、ASR、声纹拒绝、打断、视频降音事件。
- 分句式 TTS 播放队列接入 TTS session 和 sentence 生命周期事件。
- 设置页语音调试面板新增“最近事件”。

### 改变原因

- 小智协议的关键不是单个功能，而是统一的语音生命周期事件。
- 后续要做 WebSocket 语音通道、硬件/手机端接入、Opus 音频帧协议，需要先有稳定的事件对象。

### 影响范围

- 本版本不改变 ASR/TTS 模型。
- 不改变现有 DOM 事件，保留 `bailongma:assistant-wake`、`bailongma:voice-activity` 等旧集成。
- 新事件总线用于调试和后续协议转发。

### 验证结果

- `node --check src/voice/voice-events.js` 通过。
- `node --check src/ui/brain-ui/voice-panel.js` 通过。
- `node --check src/ui/brain-ui/app.js` 通过。
- `node --check src/ui/brain-ui/app-shell.js` 通过。
- `npm run smoke:tools` 6/6 通过；本机 Node v24 下仍有已知 `better-sqlite3` ABI 日志警告。

### 部署注意事项

- 源码部署方式不变。
- 本版本是浏览器内部事件协议，还不是对外 WebSocket 通道。

## v2.1.216 - 2026-05-26

### 更新内容

- 新增 `src/voice/sentence-splitter.js`，按中文/英文标点和长度把 AI 回复切成适合 TTS 的短句。
- 新增 `src/voice/tts-session.js`，提供 TTS sessionId、segment 列表、取消状态和单句音频流。
- 后端新增分句式 TTS API：
  - `POST /tts/session` 创建分句 TTS 会话；
  - `GET /tts/session/:id/audio/:index` 获取指定句子的音频；
  - `POST /tts/session/:id/cancel` 取消旧会话。
- 前端 `playTTSReply` 从“整段请求、整段 blob 完成后播放”改为“创建 session、按句请求、队列播放”。
- 用户打断、新回复开始时会取消旧 TTS session，避免旧音频串到新对话。
- 保留旧 `/tts/stream` 接口，兼容设置页试听和外部调用。

### 改变原因

- 小智的低延迟体验来自 LLM 流式输出 + 分句 TTS + 音频队列。
- 白龙马旧版虽然后端返回 stream，但前端等待完整 `blob()` 后才播放，用户感知延迟较高。
- 本版本先落地可靠的句子级队列播放，为后续真正流式 TTS、MediaSource 或 Opus/WebSocket 音频帧打基础。

### 影响范围

- 不替换现有 TTS Provider。
- 豆包、MiniMax、OpenAI、ElevenLabs、火山引擎仍走原 `streamTTS` 适配层。
- 长回复会被分句播放；短回复体验基本不变。

### 验证结果

- `node --check src/voice/sentence-splitter.js` 通过。
- `node --check src/voice/tts-session.js` 通过。
- `node --check src/api.js` 通过。
- `node --check src/ui/brain-ui/app.js` 通过。
- `npm run smoke:tools` 6/6 通过；本机 Node v24 下仍有已知 `better-sqlite3` ABI 日志警告。

### 部署注意事项

- 源码部署方式不变。
- 如果 TTS Provider 凭证未配置，分句会话创建成功但请求音频时仍会返回对应 Provider 的凭证错误。
- 本版本是句子级队列，不是最终的 Opus/WebSocket 帧级协议。

## v2.1.215 - 2026-05-26

### 更新内容

- 新增 `src/voice/asr-providers.js`，集中描述本地/云端 ASR Provider、模型列表和识别 Profile。
- 本地 ASR manager 状态新增 `profile`、`engineLabel`、`providerSummaries`，方便设置页和调试面板读取。
- 语音配置新增 `asrProfile`，支持 `speed / balanced / accuracy` 三种识别模式。
- `/voice/local/start` 和 `/voice/local/restart` 支持传入 `asrProfile`。
- Brain UI 设置页新增“识别模式”：
  - 极速：优先低延迟；
  - 平衡：推荐默认；
  - 高精度：优先准确率。
- 现有默认仍保持本地 SenseVoiceSmall，不改变用户当前中文优先本地 ASR 体验。

### 改变原因

- 用户要求中文优先、速度快、精准，并希望后续可以替换 Whisper。
- 在继续接 Sherpa、FunASR 其他模型或更强中文 ASR 之前，需要先把 ASR 从“硬编码模型选择”整理为 Provider + Profile 架构。

### 影响范围

- 不强制替换当前模型。
- 不改变本地 SenseVoiceSmall 默认行为。
- 为后续 v2.1.216 分句 TTS 以及后续 ASR 模型扩展提供更清晰的配置基础。

### 验证结果

- `node --check src/voice/asr-providers.js` 通过。
- `node --check src/voice/manager.js` 通过。
- `node --check src/config.js` 通过。
- `node --check src/api.js` 通过。
- `node --check src/ui/brain-ui/voice-panel.js` 通过。
- `node --check src/ui/brain-ui/app.js` 通过。
- `node --check src/ui/brain-ui/app-shell.js` 通过。
- `npm run smoke:tools` 6/6 通过；本机 Node v24 下仍有已知 `better-sqlite3` ABI 日志警告。

### 部署注意事项

- 源码部署方式不变。
- 已有配置会自动使用 `asrProfile=balanced`。
- 本版本没有新增大型模型文件。

## v2.1.214 - 2026-05-26

### 更新内容

- 视频播放时的近场人声检测从单帧阈值升级为连续帧确认，减少爆炸声、鼓点、视频瞬时峰值导致的误降音。
- 设置页新增视频降音目标，可在 2%–50% 之间调节。
- 设置页新增降音保持时间，可在 0.8–8 秒之间调节。
- 设置页新增人声触发灵敏度，可按环境噪声调高/调低。
- 媒体层 `startMediaVoiceDuck` 改为读取用户配置，不再固定 10% 音量和 1.8 秒保持。
- 新增 `bailongma:media-duck` 状态事件和设置页“当前降音状态”显示。

### 改变原因

- 用户提出视频播放声音会盖住自己的唤醒词。旧版虽然会自动降音/暂停，但触发阈值和保持时间硬编码，不同视频音量、麦克风距离和环境噪声下不够可调。
- 本版本让用户可以把视频降到更低、保持更久，或者在嘈杂视频里降低触发灵敏度门槛。

### 影响范围

- 不改变 ASR、声纹、唤醒词模型。
- 本地 mp4/网页视频/YouTube/Bilibili 仍使用现有媒体控制策略；只是降音参数变为可配置。
- 对 Bilibili 等跨域播放器，仍可能使用短暂停/恢复作为降音替代。

### 验证结果

- `node --check src/ui/brain-ui/voice-panel.js` 通过。
- `node --check src/ui/brain-ui/app.js` 通过。
- `node --check src/ui/brain-ui/app-shell.js` 通过。
- `npm run smoke:tools` 6/6 通过；本机 Node v24 下仍有已知 `better-sqlite3` ABI 日志警告。

### 部署注意事项

- 源码部署方式不变。
- 如果视频仍盖住唤醒词，建议把“视频降音目标”调到 2%–5%，把“降音保持时间”调到 3–5 秒，并保持 AEC 开启。

## v2.1.213 - 2026-05-26

### 更新内容

- 本地声纹从单一 embedding 升级为多样本声纹：录入时会把 7.5 秒语音拆成多个片段，分别提取 embedding，再计算中心声纹。
- 声纹验证改为“中心声纹 + 样本最佳分数”综合判断，降低同一用户因距离、音量、语速变化被误拒绝的概率。
- `data/voiceprint.json` 新增 `samples`、`sampleCount`、`calibration` 等元数据，同时保留旧 `embedding` 字段兼容旧版本。
- 本地 SenseVoice WebSocket 新增 `speaker_test_start` / `speaker_test_finish` 协议，可在不触发助手的情况下测试当前声音是否通过声纹。
- 设置页新增“测试我的声纹”按钮和“声纹状态”，会显示分数、阈值和样本数量。
- 录入完成后显示自校准均值和建议阈值；如果录入样本一致性较低，会建议更宽松阈值。

### 改变原因

- 用户反馈“录了声纹，但识别不到我的声音”。单次声纹样本在真实使用中容易受距离、麦克风角度、噪声、视频播放、语速变化影响。
- 多样本中心声纹和自测分数可以显著提升可调试性，让用户知道是阈值过高、录入质量差，还是当前环境噪声太强。

### 影响范围

- 不上传任何声纹数据；`data/voiceprint.json` 仍是本机隐私文件，不进入 GitHub。
- 兼容旧版单 embedding 声纹文件，读取时会自动作为一个样本使用。
- 本版本仍使用 `resemblyzer`，还没有切换到 3D-Speaker/ECAPA 等更重模型。

### 验证结果

- `python3 -m py_compile src/voice/sensevoice_server.py` 通过。
- `node --check src/ui/brain-ui/app.js` 通过。
- `node --check src/ui/brain-ui/app-shell.js` 通过。
- `node --check src/ui/brain-ui/voice-panel.js` 通过。
- `npm run smoke:tools` 6/6 通过；本机 Node v24 下仍有已知 `better-sqlite3` ABI 日志警告。

### 部署注意事项

- 已有声纹文件可继续使用，但建议用户在 v2.1.213 后重新录入一次，以获得多样本声纹和校准信息。
- 如果“测试我的声纹”未通过，优先降低声纹严格度到 0.50–0.55，或在安静环境重新录入。

## v2.1.212 - 2026-05-26

### 更新内容

- 唤醒词系统新增“严格 / 宽松”匹配模式：
  - 严格模式要求语音以唤醒词开头，适合视频播放、多人聊天和高噪声场景，默认启用。
  - 宽松模式保留旧体验，只要句中包含唤醒词即可触发。
- 唤醒后指令窗口从固定 8 秒改为可配置 3–30 秒。
- 新增“抑制重复误识别文本”开关，用于过滤连续重复的错误 ASR 文本，降低视频/噪声导致的误触发。
- `src/config.js` 增加 `wakeMode`、`wakeWindowSeconds`、`wakeRepeatSuppression` 配置，并通过 `/settings/voice` 保存。
- `voice-panel.js` 的 wake gate 现在会给状态机写入更明确的拒绝/唤醒原因，例如 `wake missing`、`wake not at prefix`、`repeat suppressed`、`wake matched`。
- 设置页“语音识别”新增唤醒匹配模式、唤醒窗口滑杆和重复误识别抑制选项。

### 改变原因

- 用户要求只有喊出关键词时才开始识别语音，避免普通聊天或视频声音误唤醒助手。
- 小智式交互强调明确的唤醒状态和短时间指令窗口，因此需要把旧版硬编码 8 秒窗口改成可配置。
- 之前出现过重复幻觉文本，本版本进一步在唤醒门控层抑制连续重复的无效文本。

### 影响范围

- 本版本不替换 ASR 模型，不改变声纹模型和视频抗干扰底层能力。
- 默认从“句中包含唤醒词即可”调整为“严格：必须以唤醒词开头”，误唤醒更少，但用户需要更明确地说“龙马，帮我……”。
- 如果用户喜欢旧体验，可以在设置里切换为“宽松”。

### 验证结果

- `node --check src/config.js` 通过。
- `node --check src/ui/brain-ui/voice-panel.js` 通过。
- `node --check src/ui/brain-ui/app.js` 通过。
- `node --check src/ui/brain-ui/app-shell.js` 通过。
- `npm run smoke:tools` 6/6 通过；本机 Node v24 下仍有已知 `better-sqlite3` ABI 日志警告，但不影响 smoke 断言。

### 部署注意事项

- 源码部署方式不变。
- 已有用户首次打开设置时会自动写入默认 `wakeMode=strict`、`wakeWindowSeconds=8`、`wakeRepeatSuppression=true`。

## v2.1.211 - 2026-05-26

### 更新内容

- 新增 `src/voice/voice-state-machine.js`，建立小智式语音状态机基础。
- 状态机统一管理 `idle / listening / wake_detected / recording / recognizing / thinking / speaking / interrupted / done / error / event`。
- 新增 `roundId`、`asrSessionId`、`ttsSessionId`，为后续“旧轮次识别结果丢弃”“旧 TTS 音频不串入新对话”“分句 TTS session”打基础。
- 前端 `voice-panel.js` 接入状态机，现有本地 SenseVoice、Whisper 备用、唤醒词、声纹、视频抗干扰、TTS 打断逻辑保持可用。
- 设置页“语音识别”新增“小智式语音状态机”调试面板，可查看当前状态、状态原因、Round、ASR Session、TTS Session。
- Brain UI“设置 -> 更新 -> 更新说明”新增 v2.1.211 版本说明。

### 改变原因

- 用户确认开始按小智架构对白龙马进行系统性优化。
- 后续要做分句 TTS、WebSocket 音频通道、唤醒/声纹/视频抗干扰协同，必须先有统一状态机和轮次守卫，避免旧识别、旧音频和新对话互相串扰。

### 影响范围

- 本版本是语音交互底座改造，不替换当前 ASR/TTS Provider。
- 当前听写、唤醒词、声纹、视频抗干扰逻辑仍沿用 v2.1.208-v2.1.210 的实现。
- 新增调试面板默认显示，可在设置中关闭。

### 验证结果

- `node --check src/voice/voice-state-machine.js` 通过。
- `node --check src/ui/brain-ui/voice-panel.js` 通过。
- `node --check src/ui/brain-ui/app.js` 通过。
- `node --check src/ui/brain-ui/app-shell.js` 通过。
- `npm run smoke:tools` 6/6 通过；本机 Node v24 下仍有已知 `better-sqlite3` ABI 日志警告，但不影响 smoke 断言。
- `npm run smoke:brain-ui` 当前超时等待 `#graph circle`，记录为非本次语音状态机改造引入的既有 UI smoke 阻塞点。

### 部署注意事项

- 源码部署仍按 `BACKUP-2026-05-26.md` 执行：`npm install`、准备 Python 3.11、本地 ASR 虚拟环境和 SenseVoiceSmall 模型。
- 本版本没有新增大型模型文件，`models/SenseVoiceSmall/` 和 `.venv-whisper/` 仍不进入 GitHub，需要本地重建。

## v2.1.210 - 2026-05-26

### 更新内容

- 固化维护规则：以后任何版本修改或更新都必须上传 GitHub，并创建 GitHub Release 作为正式备份。
- 新增小智 `xiaozhi-esp32` 借鉴研究报告：`research/xiaozhi-esp32-borrowing-report.md`。
- 报告整理了小智的本地/云端分工、低延迟原因、Opus 流式音频、唤醒词、声纹、AEC/VAD、状态机和对白龙马的落地路线。

### 改变原因

- 用户要求后续所有版本修改都必须 GitHub 备份。
- 用户要求研究小智哪些能力可以借鉴到白龙马。

### 影响范围

- 不改变运行逻辑。
- 本版本是维护规范和技术研究文档版本。

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
