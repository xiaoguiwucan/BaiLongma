# BaiLongma Voice Events Protocol

版本：v3（BaiLongma v2.1.224 文档固化）

本文档描述白龙马 `/voice/events` WebSocket 语音事件协议，用于调试工具、手机端、ESP32/硬件端或局域网客户端接入。

## 1. 端点

默认本机：

```text
ws://127.0.0.1:3721/voice/events
```

状态接口：

```text
GET http://127.0.0.1:3721/voice/events/status
```

如果白龙马运行在局域网 Mac 上，客户端需要把 `127.0.0.1` 替换为 Mac 的局域网 IP，并自行确认端口暴露和安全策略。

## 2. Hello

连接成功后服务端发送：

```json
{
  "type": "hello",
  "service": "bailongma.voice.events",
  "version": 3,
  "capabilities": ["json_events", "tts_audio_chunks", "tts_speak"],
  "history": []
}
```

字段说明：

| 字段 | 说明 |
|---|---|
| `version` | 当前协议版本。v3 支持 JSON 事件、TTS 音频块、直接 `tts:speak`。 |
| `capabilities` | 能力声明。客户端应按能力判断是否启用 speak/audio。 |
| `history` | 最近事件历史，方便调试客户端连上后看到上下文。 |

## 3. 心跳

客户端发送：

```json
{"type":"ping"}
```

服务端返回：

```json
{"type":"pong","at":1710000000000}
```

## 4. 被动订阅音频块

默认情况下，客户端会收到 JSON 生命周期事件，但不会收到 TTS 音频块。

订阅 base64 音频块：

```json
{"type":"subscribe","audio":true}
```

订阅二进制音频块：

```json
{"type":"subscribe","audio":true,"binaryAudio":true}
```

取消订阅：

```json
{"type":"unsubscribe","audio":false,"binaryAudio":false}
```

服务端确认：

```json
{
  "type": "subscribed",
  "service": "bailongma.voice.events",
  "options": { "audio": true, "binaryAudio": true }
}
```

## 5. 原始事件与小智式事件

白龙马会发送两种 JSON：

### 5.1 原始事件

```json
{
  "type": "voice_event",
  "event": {
    "type": "tts:sentence_start",
    "seq": 12,
    "at": 1710000000000,
    "detail": {
      "sessionId": "tts_xxx",
      "index": 0,
      "text": "你好。"
    }
  }
}
```

### 5.2 小智式映射事件

```json
{
  "type": "tts",
  "state": "sentence_start",
  "sessionId": "tts_xxx",
  "index": 0,
  "text": "你好。"
}
```

常见映射：

| 内部事件 | 小智式 JSON |
|---|---|
| `wake:accepted` | `{ "type":"wake", "state":"accepted" }` |
| `wake:rejected` | `{ "type":"wake", "state":"rejected" }` |
| `asr:partial` | `{ "type":"stt", "state":"partial" }` |
| `asr:final` | `{ "type":"stt", "state":"final" }` |
| `tts:start` | `{ "type":"tts", "state":"start" }` |
| `tts:sentence_start` | `{ "type":"tts", "state":"sentence_start" }` |
| `tts:audio_ready` | `{ "type":"tts", "state":"audio_ready" }` |
| `tts:sentence_end` | `{ "type":"tts", "state":"sentence_end" }` |
| `tts:stop` | `{ "type":"tts", "state":"stop" }` |
| `interrupt` | `{ "type":"interrupt" }` |

## 6. TTS 音频块

订阅音频后，HTTP TTS segment 播放或 WebSocket `tts:speak` 会产生音频块事件。

开始：

```json
{
  "type": "tts",
  "state": "audio_start",
  "sessionId": "tts_xxx",
  "index": 0,
  "contentType": "audio/mpeg"
}
```

音频块 metadata：

```json
{
  "type": "tts",
  "state": "audio_chunk",
  "sessionId": "tts_xxx",
  "index": 0,
  "contentType": "audio/mpeg",
  "bytes": 4096,
  "binary": true
}
```

如果 `binaryAudio=true`，metadata 后会紧跟一个 WebSocket binary frame。

如果未启用 binary，则会发送 base64 JSON：

```json
{
  "type": "tts",
  "state": "audio_chunk_base64",
  "sessionId": "tts_xxx",
  "index": 0,
  "contentType": "audio/mpeg",
  "data": "...base64..."
}
```

结束：

```json
{"type":"tts","state":"audio_end","sessionId":"tts_xxx","index":0}
```

错误：

```json
{"type":"tts","state":"audio_error","sessionId":"tts_xxx","index":0,"error":"..."}
```

当前音频格式是 TTS Provider 返回的 `audio/mpeg` chunk，不是 Opus 帧。

## 7. 直接 TTS：tts:speak

客户端可以直接请求服务端合成语音：

```json
{
  "type": "tts:speak",
  "requestId": "r1",
  "text": "测试白龙马语音服务端",
  "binaryAudio": true
}
```

兼容短写：

```json
{"type":"speak","text":"你好"}
```

典型返回顺序：

```text
hello
voice_event tts:start
{type:tts,state:start}
{type:tts,state:session}
voice_event tts:sentence_start
{type:tts,state:sentence_start}
voice_event tts:audio_ready
{type:tts,state:audio_ready}
{type:tts,state:audio_start}
{type:tts,state:audio_chunk}
[binary audio frame] 或 audio_chunk_base64
{type:tts,state:audio_end}
voice_event tts:sentence_end
{type:tts,state:sentence_end}
voice_event tts:stop
{type:tts,state:stop}
```

## 8. 取消 TTS：tts:cancel

取消当前连接上的 active speak：

```json
{"type":"tts:cancel","requestId":"r1"}
```

兼容短写：

```json
{"type":"cancel"}
```

服务端返回：

```json
{
  "type": "tts",
  "state": "cancelled",
  "requestId": "r1",
  "sessionId": "tts_xxx",
  "cancelled": true,
  "reason": "client_cancelled"
}
```

规则：

- 取消只作用于同一个 WebSocket 连接的 active speak。
- 同连接发起新的 `tts:speak` 会自动取消旧 speak，reason 为 `replaced_by_new_speak`。
- 连接关闭或错误会自动取消当前 speak，reason 为 `client_disconnected`。

## 9. 状态接口

```bash
curl http://127.0.0.1:3721/voice/events/status
```

示例：

```json
{
  "ok": true,
  "clients": 1,
  "history": 20,
  "audioSubscribers": 1,
  "binaryAudioSubscribers": 1,
  "version": 3
}
```

## 10. CLI 调试客户端

查看状态：

```bash
npm run voice:events -- status
```

监听事件：

```bash
npm run voice:events -- listen
```

订阅并保存音频：

```bash
npm run voice:events -- listen --audio --binary --save tmp/listen.mp3
```

直接 speak 并保存音频：

```bash
npm run voice:events -- speak "测试白龙马语音服务端" --binary --save tmp/tts.mp3
```

发送 cancel：

```bash
npm run voice:events -- cancel
```

指定局域网地址：

```bash
npm run voice:events -- listen --url ws://192.168.1.10:3721/voice/events
```

## 11. 客户端实现建议

- 优先解析 `hello.version` 和 `hello.capabilities`，不要硬编码能力。
- 如果是硬件端，建议使用 `binaryAudio=true`，避免 base64 体积膨胀。
- `audio_chunk` metadata 和紧随其后的 binary frame 应按顺序消费。
- 对每个 `requestId/sessionId/index` 建立播放队列，收到 `audio_end` 后进入下一段。
- 用户打断时立刻发送 `tts:cancel`。
- 断线重连后不要假设旧 speak 仍存在。

## 12. 已知限制

- 当前 TTS 音频是 `audio/mpeg`，不是小智最终常用的 Opus 帧。
- 当前协议未做鉴权，局域网暴露时请自行控制访问范围。
- 当前 `tts:cancel` 只取消同连接 active speak，不支持跨连接 session 管理。
- 当前调试客户端是参考实现，不是正式 SDK。
