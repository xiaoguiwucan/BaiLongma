# BaiLongma Voice Events Protocol

版本：v3（BaiLongma v2.2.0 更新：小智式语音设备控制台、链路总控、自检和接入包）

本文档描述白龙马 `/voice/events` WebSocket 语音事件协议，用于调试工具、手机端、ESP32/硬件端或局域网客户端接入。

## 1. 核心端点

```text
WS  /voice/events              WebSocket 语音事件通道
GET /voice/events/status       总状态与 clientDetails
GET /voice/events/clients      聚焦客户端诊断
GET /voice/events/history      最近 raw + Xiaozhi mapped 语音事件
GET /voice/events/summary      语音链路总控摘要
GET /voice/events/check        一键语音链路自检
GET /voice/events/package      设备接入包
GET /voice/events/onboarding   接入向导数据
GET /voice/events/protocol     协议元数据
POST /voice/events/publish     浏览器/调试桥发布事件
```

默认本机 WebSocket：

```text
ws://127.0.0.1:3721/voice/events
```

CLI 快速检查：

```bash
npm run voice:events -- protocol
npm run voice:events -- listen --audio --binary --client-id mac-debug --device mac --platform macos --capability binary_audio --capability wake --capability display
```

如果白龙马运行在局域网 Mac 上，客户端需要把 `127.0.0.1` 替换为 Mac 的局域网 IP，并自行确认端口暴露和安全策略。

## 2. v2.2.0 新增诊断端点

### `/voice/events/history`

```bash
curl 'http://127.0.0.1:3721/voice/events/history?limit=20'
curl 'http://127.0.0.1:3721/voice/events/history?type=asr:final&limit=10'
```

返回最近事件：

```json
{
  "ok": true,
  "service": "bailongma.voice.events",
  "version": 3,
  "total": 2,
  "limit": 20,
  "events": [
    { "type": "voice_event", "event": { "type": "asr:final" }, "xiaozhi": { "type": "stt", "state": "final" } }
  ]
}
```

### `/voice/events/summary`

聚合最近窗口内客户端、订阅、wake/asr/tts/interrupt 计数、issues 和中文 suggestions。

```bash
curl 'http://127.0.0.1:3721/voice/events/summary?windowMs=60000'
```

### `/voice/events/check`

一键自检协议、客户端、握手、音频订阅、binary audio、最近事件和“唤醒→ASR→TTS”闭环。

```bash
curl http://127.0.0.1:3721/voice/events/check
```

返回 `overall`、`steps[]`、`nextActions[]`、`commands`、`messages`、`urls` 和 `summary`。

### `/voice/events/package`

生成设备接入包：README、环境变量、client hello、subscribe、Node WebSocket 示例和 ESP32 伪配置。

```bash
curl 'http://127.0.0.1:3721/voice/events/package?clientId=esp32-living-room&device=xiaozhi-esp32&platform=esp32'
```

## 3. 访问控制与 token

本机 localhost / Electron 默认可直接访问。外部设备或 LAN 客户端建议设置环境变量：

```bash
export BAILONGMA_API_TOKEN="换成强随机token"
export BAILONGMA_ALLOW_LAN=true
npm start
```

客户端可用两种方式传 token：

```text
Authorization: Bearer <token>
ws://<mac-ip>:3721/voice/events?token=<token>
```

服务端不会返回 token 明文。

## 4. Hello

连接成功后服务端发送：

```json
{
  "type": "hello",
  "service": "bailongma.voice.events",
  "version": 3,
  "capabilities": [
    "json_events",
    "tts_audio_chunks",
    "tts_speak",
    "protocol_errors",
    "tts_speak_limits",
    "client_identity",
    "audio_negotiation",
    "client_diagnostics",
    "client_onboarding",
    "event_history",
    "link_summary",
    "link_self_check",
    "onboarding_package"
  ]
}
```

## 5. 客户端握手

外部设备连接后建议先发送：

```json
{
  "type": "client:hello",
  "clientId": "esp32-living-room",
  "device": "xiaozhi-esp32",
  "app": "bailongma-bridge",
  "version": "0.1.0",
  "platform": "esp32",
  "capabilities": ["binary_audio", "tts_speak", "wake", "display"]
}
```

服务端返回 `client:accepted`，其中 `negotiated.audioMode` 为 `binary` / `base64` / `none`。

## 6. 订阅音频

二进制音频优先：

```json
{"type":"subscribe","audio":true,"binaryAudio":true}
```

仅 JSON/base64：

```json
{"type":"subscribe","audio":true}
```

## 7. 事件发布与映射

浏览器或调试桥可以发布：

```bash
curl -X POST http://127.0.0.1:3721/voice/events/publish \
  -H 'Content-Type: application/json' \
  -d '{"event":{"type":"asr:final","detail":{"text":"打开灯光"}}}'
```

服务端会广播 raw `voice_event`，并尽可能映射为小智式事件：

- `asr:partial` → `stt partial`
- `asr:final` → `stt final`
- `wake:accepted` → `wake accepted`
- `wake:rejected` → `wake rejected`
- `tts:start` / `tts:sentence_start` / `tts:audio_ready` / `tts:sentence_end` / `tts:stop`
- `interrupt`

## 8. TTS speak / cancel

外部客户端可发送：

```json
{"type":"tts:speak","text":"你好，我是白龙马"}
```

取消：

```json
{"type":"tts:cancel"}
```

文本长度和冷却限制见 `/voice/events/protocol` 的 `limits.ttsSpeak`。
