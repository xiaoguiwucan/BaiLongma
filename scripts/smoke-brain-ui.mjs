import http from 'http'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { chromium } from 'playwright'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const brainUiRoot = path.join(root, 'src', 'ui', 'brain-ui')

function contentTypeFor(filePath) {
  switch (path.extname(filePath).toLowerCase()) {
    case '.html': return 'text/html; charset=utf-8'
    case '.js': return 'text/javascript; charset=utf-8'
    case '.css': return 'text/css; charset=utf-8'
    case '.json': return 'application/json; charset=utf-8'
    default: return 'text/plain; charset=utf-8'
  }
}

function sendJson(res, body) {
  res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(body))
}

function isPathInside(parentDir, candidatePath) {
  const parent = path.resolve(parentDir)
  const candidate = path.resolve(candidatePath)
  const relative = path.relative(parent, candidate)
  return relative === '' || (!!relative && !relative.startsWith('..') && !path.isAbsolute(relative))
}

function sendFile(res, filePath) {
  try {
    const stat = fs.statSync(filePath)
    if (!stat.isFile()) throw new Error('not a file')
    res.writeHead(200, {
      'Content-Type': contentTypeFor(filePath),
      'Content-Length': stat.size,
      'Cache-Control': 'no-cache',
    })
    fs.createReadStream(filePath).pipe(res)
  } catch {
    res.writeHead(404)
    res.end('not found')
  }
}

function createServer() {
  const sseClients = new Set()
  let wakeTuningApplied = false
  let localDoctorFixed = false
  let localDoctorFixHistory = []
  let localDoctorRollback = false
  let speakerBackupAvailable = false
  let readinessApplied = false
  let externalVoiceService = false
  let localServiceStopped = false
  let speakerGateLocked = false
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1')

    if (url.pathname === '/brain-ui' || url.pathname === '/brain-ui.html' || url.pathname === '/') {
      sendFile(res, path.join(root, 'brain-ui.html'))
      return
    }

    if (url.pathname === '/vendor/d3/d3.min.js') {
      sendFile(res, path.join(root, 'node_modules', 'd3', 'dist', 'd3.min.js'))
      return
    }

    if (url.pathname.startsWith('/src/voice/')) {
      const relativePath = decodeURIComponent(url.pathname.slice('/src/voice/'.length))
      const assetPath = path.resolve(root, 'src', 'voice', relativePath)
      if (!isPathInside(path.join(root, 'src', 'voice'), assetPath)) {
        res.writeHead(403)
        res.end('forbidden')
        return
      }
      sendFile(res, assetPath)
      return
    }

    if (url.pathname.startsWith('/src/ui/brain-ui/')) {
      const relativePath = decodeURIComponent(url.pathname.slice('/src/ui/brain-ui/'.length))
      const assetPath = path.resolve(brainUiRoot, relativePath)
      if (!isPathInside(brainUiRoot, assetPath)) {
        res.writeHead(403)
        res.end('forbidden')
        return
      }
      sendFile(res, assetPath)
      return
    }

    if (url.pathname === '/agent-profile') {
      sendJson(res, { name: 'SmokeLongma' })
      return
    }

    if (url.pathname === '/memories') {
      sendJson(res, [
        { id: 1, mem_id: 'm1', type: 'fact', content: 'Alpha memory', detail: 'First smoke node', created_at: new Date().toISOString() },
        { id: 2, mem_id: 'm2', type: 'preference', content: 'Beta memory', detail: 'Second smoke node', created_at: new Date().toISOString() },
      ])
      return
    }

    if (url.pathname === '/conversations') {
      sendJson(res, [])
      return
    }

    if (url.pathname === '/settings') {
      sendJson(res, {
        llm: { activated: true, provider: 'deepseek', model: 'smoke', models: [{ id: 'smoke', label: 'Smoke' }] },
        providers: { deepseek: { models: [{ id: 'smoke', label: 'Smoke' }] } },
        minimax: { configured: false },
      })
      return
    }

    if (url.pathname === '/settings/voice') {
      sendJson(res, {
        ok: true,
        voice: {
          asrProvider: 'local',
          localAsrModel: 'sensevoice-small',
          asrProfile: 'balanced',
          wakeWordEnabled: true,
          wakeWords: ['小龙马', '龙马', '白龙马'],
          wakeDetectionProvider: 'hybrid',
          wakeKwsEngine: 'sherpa-onnx',
          wakeKwsModelPath: 'models/kws/longma.onnx',
          wakeKwsThreshold: 0.62,
          wakeMode: 'strict',
          wakeWindowSeconds: 8,
          wakeRepeatSuppression: true,
          wakeConfidenceThreshold: 0.72,
          wakeMinCommandChars: 2,
          wakeCooldownMs: 1200,
          wakeRequireSpeakerWhenEnabled: true,
          speakerVerificationEnabled: false,
          speakerThreshold: 0.63,
          videoVoiceDuckEnabled: false,
          videoVoicePttEnabled: true,
          videoVoiceAecEnabled: false,
          videoVoiceDuckLevel: 0.25,
          videoVoiceDuckHoldMs: 3600,
          videoVoiceDuckSensitivity: 1.35,
          videoVoicePreRollEnabled: true,
          videoVoicePreRollMs: 2800,
        },
      })
      return
    }

    if (url.pathname === '/settings/voice/presets') {
      sendJson(res, {
        ok: true,
        presets: [
          { id: 'quiet-room', label: '安静房间', description: '普通近场聊天，保留较自然的唤醒体验。', patch: { wakeMode: 'strict', wakeConfidenceThreshold: 0.70, speakerThreshold: 0.55, videoVoiceDuckEnabled: false, videoVoicePttEnabled: false, videoVoiceAecEnabled: true } },
          { id: 'video-guard', label: '视频抗干扰', description: '播放视频或别人说话时，优先避免误唤醒并打开降音/PTT/AEC。', patch: { wakeMode: 'strict', wakeConfidenceThreshold: 0.78, wakeMinCommandChars: 2, wakeCooldownMs: 1600, wakeRepeatSuppression: true, wakeRequireSpeakerWhenEnabled: true, speakerThreshold: 0.58, videoVoiceDuckEnabled: true, videoVoicePttEnabled: true, videoVoiceAecEnabled: true, videoVoiceDuckLevel: 0.08, videoVoiceDuckHoldMs: 3200, videoVoiceDuckSensitivity: 0.85, videoVoicePreRollEnabled: true, videoVoicePreRollMs: 3000 } },
        ],
        currentPreset: { id: 'balanced', label: '均衡推荐', exact: false, reason: '当前接近均衡推荐。' },
        recommended: { id: 'video-guard', label: '视频抗干扰', reason: '最近有唤醒拒绝/视频保护未全开，建议启用抗干扰预设。' },
      })
      return
    }

    if (url.pathname === '/settings/voice/preset/apply') {
      sendJson(res, {
        ok: true,
        preset: { id: 'video-guard', label: '视频抗干扰', description: '播放视频或别人说话时使用。', patch: {} },
        currentPreset: { id: 'video-guard', label: '视频抗干扰', exact: true },
        recommended: { id: 'video-guard', label: '视频抗干扰', reason: '已应用推荐预设。' },
        voice: {
          wakeMode: 'strict',
          wakeRepeatSuppression: true,
          wakeConfidenceThreshold: 0.78,
          wakeMinCommandChars: 2,
          wakeCooldownMs: 1600,
          wakeRequireSpeakerWhenEnabled: true,
          speakerVerificationEnabled: true,
          speakerThreshold: 0.58,
          videoVoiceDuckEnabled: true,
          videoVoicePttEnabled: true,
          videoVoiceAecEnabled: true,
          videoVoiceDuckLevel: 0.08,
          videoVoiceDuckHoldMs: 3200,
          videoVoiceDuckSensitivity: 0.85,
          videoVoicePreRollEnabled: true,
          videoVoicePreRollMs: 3000,
        },
      })
      return
    }

    if (url.pathname === '/voice/events/onboarding') {
      sendJson(res, {
        ok: true,
        service: 'bailongma.voice.events',
        version: 3,
        urls: {
          localWebSocket: 'ws://127.0.0.1:3721/voice/events',
          lanWebSocket: 'ws://<Mac局域网IP>:3721/voice/events',
        },
        commands: {
          local: 'npm run voice:events -- listen --url ws://127.0.0.1:3721/voice/events --audio --binary --client-id mac-debug',
          lan: 'npm run voice:events -- listen --url ws://<Mac局域网IP>:3721/voice/events --audio --binary --client-id esp32-test --device xiaozhi-esp32',
        },
        messages: {
          clientHello: { type: 'client:hello', clientId: 'esp32-living-room', device: 'xiaozhi-esp32', capabilities: ['binary_audio', 'wake'] },
          subscribe: { type: 'subscribe', audio: true, binaryAudio: true },
        },
      })
      return
    }

    if (url.pathname === '/voice/events/protocol') {
      sendJson(res, {
        ok: true,
        service: 'bailongma.voice.events',
        version: 3,
        capabilities: ['json_events', 'tts_speak', 'client_identity', 'audio_negotiation', 'client_diagnostics', 'event_history', 'link_summary', 'link_self_check', 'onboarding_package'],
        endpoints: {
          websocket: '/voice/events',
          clients: '/voice/events/clients',
          history: '/voice/events/history',
          summary: '/voice/events/summary',
          check: '/voice/events/check',
          package: '/voice/events/package',
          protocol: '/voice/events/protocol',
          publish: '/voice/events/publish',
        },
        negotiation: {
          audioModes: ['none', 'binary', 'base64'],
          autoSubscribe: false,
        },
      })
      return
    }


    if (url.pathname === '/voice/events/publish') {
      sendJson(res, { ok: true })
      return
    }

    if (url.pathname === '/voice/events/package') {
      const clientId = url.searchParams.get('clientId') || 'esp32-test'
      sendJson(res, {
        ok: true,
        service: 'bailongma.voice.events',
        version: 3,
        generatedAt: Date.now(),
        profile: { clientId, device: 'xiaozhi-esp32', platform: 'esp32', capabilities: ['binary_audio', 'tts_speak', 'wake', 'display'] },
        urls: { lanWebSocket: 'ws://<Mac局域网IP>:3721/voice/events', localWebSocket: 'ws://127.0.0.1:3721/voice/events', package: '/voice/events/package' },
        commands: { local: 'npm run voice:events -- listen --url ws://127.0.0.1:3721/voice/events --audio --binary --client-id mac-debug', lan: 'npm run voice:events -- listen --url ws://<Mac局域网IP>:3721/voice/events --audio --binary --client-id esp32-test' },
        messages: { clientHello: { type: 'client:hello', clientId }, subscribe: { type: 'subscribe', audio: true, binaryAudio: true } },
        files: {
          'README.md': `# BaiLongma Voice Client Onboarding Package

client:hello
`,
          '.env.voice': 'BAILONGMA_VOICE_WS=ws://<Mac局域网IP>:3721/voice/events',
          'client-hello.json': JSON.stringify({ type: 'client:hello', clientId }, null, 2),
          'node-client-example.mjs': `import WebSocket from 'ws'
new WebSocket(url)`,
        },
        checklist: ['Mac 与设备在同一局域网', '先发送 client:hello', '点击一键自检'],
      })
      return
    }

    if (url.pathname === '/voice/events/check') {
      sendJson(res, {
        ok: true,
        service: 'bailongma.voice.events',
        version: 3,
        checkedAt: Date.now(),
        overall: 'ok',
        counts: { ok: 7, warn: 0, pending: 0, error: 0 },
        steps: [
          { id: 'protocol', label: '协议能力', status: 'ok', detail: '协议 v3，能力 12 项', action: 'ok' },
          { id: 'clients', label: '客户端连接', status: 'ok', detail: '已连接 1 个客户端', action: '保持设备在线。' },
          { id: 'wake_asr_tts', label: '唤醒→识别→播报闭环', status: 'ok', detail: 'wake 1/0 · asrFinal 1 · tts 1/1', action: '可以实测。' },
        ],
        nextActions: [{ id: 'ready', label: '可以实测', action: '现在可以喊唤醒词并观察最近语音事件时间线。' }],
        commands: { local: 'npm run voice:events -- listen --url ws://127.0.0.1:3721/voice/events --audio --binary --client-id mac-debug', lan: 'npm run voice:events -- listen --url ws://<Mac局域网IP>:3721/voice/events --audio --binary --client-id esp32-test' },
        messages: { clientHello: { type: 'client:hello' } },
        urls: { check: '/voice/events/check' },
        summary: {
          ok: true,
          level: 'ok',
          windowMs: 60000,
          checkedAt: Date.now(),
          status: { clients: 1, audioSubscribers: 1, binaryAudioSubscribers: 1, history: 4, version: 3 },
          recent: { total: 6, wakeAccepted: 1, wakeRejected: 1, speakerAccepted: 0, speakerRejected: 1, asrFinal: 1, asrPartial: 1, ttsStart: 1, ttsStop: 1, interrupt: 0, wakeRejectedDetails: [{ reason: 'command too short', confidence: 0.81, threshold: 0.72, minCommandChars: 2, advice: '唤醒后指令太短：降低“最短指令字数”，或说完整命令如“龙马，打开灯”。' }], speakerRejectedDetails: [{ reason: 'speaker verification failed', score: 0.47, threshold: 0.63, advice: '声纹拒绝：如果这是你的声音，请降低“声纹严格度”、重新录入 6–8 秒声纹，或暂时关闭“只响应我的声音”。' }] },
          issues: [],
          suggestions: ['唤醒后指令太短：降低“最短指令字数”，或说完整命令如“龙马，打开灯”。', '最近声纹拒绝偏多：如果被拒绝的是你本人，请降低“声纹严格度”、重新录入声纹，或暂时关闭“只响应我的声音”。'],
          clientDetails: [],
        },
      })
      return
    }

    if (url.pathname === '/voice/events/summary') {
      sendJson(res, {
        ok: true,
        service: 'bailongma.voice.events',
        version: 3,
        summary: {
          ok: true,
          level: 'ok',
          windowMs: 60000,
          checkedAt: Date.now(),
          status: { clients: 1, audioSubscribers: 1, binaryAudioSubscribers: 1, history: 4, version: 3 },
          recent: { total: 6, wakeAccepted: 1, wakeRejected: 1, speakerAccepted: 0, speakerRejected: 1, asrFinal: 1, asrPartial: 1, ttsStart: 1, ttsStop: 1, interrupt: 0, wakeRejectedDetails: [{ reason: 'command too short', confidence: 0.81, threshold: 0.72, minCommandChars: 2, advice: '唤醒后指令太短：降低“最短指令字数”，或说完整命令如“龙马，打开灯”。' }], speakerRejectedDetails: [{ reason: 'speaker verification failed', score: 0.47, threshold: 0.63, advice: '声纹拒绝：如果这是你的声音，请降低“声纹严格度”、重新录入 6–8 秒声纹，或暂时关闭“只响应我的声音”。' }] },
          issues: [],
          suggestions: ['唤醒后指令太短：降低“最短指令字数”，或说完整命令如“龙马，打开灯”。', '最近声纹拒绝偏多：如果被拒绝的是你本人，请降低“声纹严格度”、重新录入声纹，或暂时关闭“只响应我的声音”。'],
          clientDetails: [],
        },
      })
      return
    }

    if (url.pathname === '/voice/events/history') {
      const type = url.searchParams.get('type') || ''
      const events = [
        { type: 'voice_event', event: { type: 'wake:accepted', word: '小白龙', ts: Date.now() - 2400, roundId: 'r1' }, xiaozhi: { type: 'wake', state: 'accepted', word: '小白龙' } },
        { type: 'voice_event', event: { type: 'asr:partial', text: '打开', ts: Date.now() - 1800, roundId: 'r1' }, xiaozhi: { type: 'stt', state: 'partial', text: '打开' } },
        { type: 'voice_event', event: { type: 'asr:final', text: '打开灯光', ts: Date.now() - 1200, roundId: 'r1' }, xiaozhi: { type: 'stt', state: 'final', text: '打开灯光' } },
        { type: 'voice_event', event: { type: 'wake:rejected', reason: 'command too short', confidence: 0.81, threshold: 0.72, minCommandChars: 2, ts: Date.now() - 900, roundId: 'r1' }, xiaozhi: { type: 'wake', state: 'rejected', reason: 'command too short' } },
        { type: 'voice_event', event: { type: 'tts:stop', reason: 'completed', ts: Date.now() - 600, roundId: 'r1' }, xiaozhi: { type: 'tts', state: 'stop', reason: 'completed' } },
      ].filter(item => !type || item.event.type === type || item.xiaozhi.type === type)
      sendJson(res, { ok: true, service: 'bailongma.voice.events', version: 3, total: events.length, limit: 20, events })
      return
    }

    if (url.pathname === '/voice/events/clients') {
      sendJson(res, {
        ok: true,
        service: 'bailongma.voice.events',
        version: 3,
        clients: 1,
        clientDetails: [
          {
            audio: true,
            binaryAudio: true,
            identity: {
              clientId: 'smoke-esp32',
              device: 'xiaozhi-esp32',
              app: 'brain-ui-smoke',
              version: '0.1.0',
              platform: 'esp32',
              capabilities: ['binary_audio', 'wake', 'display'],
              lastSeenAt: Date.now(),
            },
            negotiated: {
              audioMode: 'binary',
              binaryAudio: true,
              base64Audio: false,
              shouldSubscribeAudio: false,
              reason: 'client_capability',
            },
            health: { level: 'ok', ok: true, advice: ['链路正常'] },
            advice: ['链路正常'],
          },
        ],
      })
      return
    }



    if (url.pathname === '/voice/wake/tuning/auto') {
      sendJson(res, {
        ok: true,
        service: 'bailongma.voice.wake.auto_tuning',
        enabled: false,
        policy: { minRejects: 3, cooldownMs: 300000, maxActionsPerHour: 3 },
        topReason: { reason: 'command too short', count: 3 },
        hourlyCount: 0,
        blocked: ['auto_disabled'],
        eligible: false,
        action: null,
      })
      return
    }

    if (url.pathname === '/voice/wake/tuning') {
      sendJson(res, {
        ok: true,
        service: 'bailongma.voice.wake.tuning',
        current: { wakeMinCommandChars: 2, wakeConfidenceThreshold: 0.72, wakeCooldownMs: 1200, wakeRequireSpeakerWhenEnabled: true },
        actions: [
          { reason: 'command too short', label: '降低最短指令字数到 1 字', patch: { wakeMinCommandChars: 1 }, safe: true, advice: '降低最短指令字数' },
          { reason: 'speaker rejected', label: '降低声纹严格度到 0.50', patch: { speakerThreshold: 0.50 }, safe: true, advice: '降低声纹严格度' },
        ],
        history: wakeTuningApplied ? [{ id: 'wake_tune_smoke', label: '降低最短指令字数到 1 字', reason: 'command too short', before: { wakeMinCommandChars: 2, speakerThreshold: 0.63 }, after: { wakeMinCommandChars: 1, speakerThreshold: 0.50 }, applied: { wakeMinCommandChars: 1, speakerThreshold: 0.50 }, evaluation: { verdict: 'improved', advice: { level: 'ok', action: 'keep', text: '调参后唤醒表现变好，建议暂时保持当前参数并继续观察。' }, before: { wakeRejected: 2, wakeAccepted: 1, speakerRejected: 1 }, after: { wakeRejected: 0, wakeAccepted: 2, speakerRejected: 0 } } }] : [],
      })
      return
    }

    if (url.pathname === '/voice/wake/tuning/apply') {
      wakeTuningApplied = true
      sendJson(res, { ok: true, applied: { wakeMinCommandChars: 1, speakerThreshold: 0.50 }, record: { id: 'wake_tune_smoke', label: '降低最短指令字数到 1 字', before: { wakeMinCommandChars: 2, speakerThreshold: 0.63 }, after: { wakeMinCommandChars: 1, speakerThreshold: 0.50 }, applied: { wakeMinCommandChars: 1, speakerThreshold: 0.50 } }, history: [{ id: 'wake_tune_smoke', label: '降低最短指令字数到 1 字' }], voice: { wakeMinCommandChars: 1, speakerThreshold: 0.50, wakeConfidenceThreshold: 0.72, wakeCooldownMs: 1200, wakeRequireSpeakerWhenEnabled: true } })
      return
    }


    if (url.pathname === '/voice/wake/tuning/rollback') {
      wakeTuningApplied = false
      sendJson(res, { ok: true, rolledBack: 'wake_tune_smoke', record: { id: 'wake_tune_rollback', rollbackOf: 'wake_tune_smoke' }, voice: { wakeMinCommandChars: 2, speakerThreshold: 0.63, wakeConfidenceThreshold: 0.72, wakeCooldownMs: 1200, wakeRequireSpeakerWhenEnabled: true }, history: [] })
      return
    }

    if (url.pathname === '/voice/wake/tuning/clear') {
      wakeTuningApplied = false
      sendJson(res, { ok: true, cleared: 1, history: [], voice: { wakeMinCommandChars: 2, speakerThreshold: 0.63 } })
      return
    }

    if (url.pathname === '/settings/tts') {
      sendJson(res, {
        ok: true,
        tts: { ttsProvider: 'minimax', ttsVoiceId: 'male-qn-qingse' },
        providers: [{ id: 'minimax', label: 'MiniMax', streaming: false }],
        voices: { minimax: [{ id: 'male-qn-qingse', label: '青涩男声' }] },
      })
      return
    }

    if (url.pathname === '/hotspots') {
      sendJson(res, {
        ok: true,
        refreshMinutes: 30,
        fetchedAt: new Date().toISOString(),
        stale: false,
        platforms: {
          douyin: [
            { rank: 1, title: 'Smoke 热点一', heat: '100万', trend: 'same', isNew: false, source: 'smoke' },
            { rank: 2, title: 'Smoke 热点二', heat: '80万', trend: 'same', isNew: true, source: 'smoke' },
          ],
        },
      })
      return
    }

    if (url.pathname === '/person-card') {
      const name = url.searchParams.get('name') || ''
      if (name.includes('马云')) {
        sendJson(res, {
          ok: true,
          card: {
            name: '马云',
            title: '人物卡片',
            summary: '暂时没有内置资料。可以让 Longma 补充身份、代表作品和为什么被提到。',
            knownFor: [],
            tags: ['待补充'],
            image: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 640 360%22%3E%3Crect width=%22640%22 height=%22360%22 fill=%22%23112332%22/%3E%3Ccircle cx=%22320%22 cy=%22130%22 r=%2260%22 fill=%22%2382d2ff%22/%3E%3Crect x=%22205%22 y=%22210%22 width=%22230%22 height=%2280%22 rx=%2240%22 fill=%22%2382d2ff%22/%3E%3C/svg%3E',
            source: 'fallback',
            updatedAt: new Date().toISOString(),
          },
        })
        return
      }
      sendJson(res, {
        ok: true,
        card: {
          name: '周杰伦',
          title: '歌手 / 音乐人',
          summary: '华语流行音乐代表人物之一。',
          knownFor: ['七里香', '青花瓷'],
          tags: ['华语音乐', '创作歌手'],
          image: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 640 360%22%3E%3Crect width=%22640%22 height=%22360%22 fill=%22%23112332%22/%3E%3Ccircle cx=%22320%22 cy=%22130%22 r=%2260%22 fill=%22%2382d2ff%22/%3E%3Crect x=%22205%22 y=%22210%22 width=%22230%22 height=%2280%22 rx=%2240%22 fill=%22%2382d2ff%22/%3E%3C/svg%3E',
          source: 'smoke',
          updatedAt: new Date().toISOString(),
        },
      })
      return
    }

    if (url.pathname === '/person-card-state') {
      sendJson(res, { ok: true, state: { active: true } })
      return
    }

    if (url.pathname === '/social/wechat-clawbot/qr') {
      sendJson(res, { ok: true, qr: null, status: 'unavailable' })
      return
    }

    if (url.pathname === '/events') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      })
      res.write(`data: ${JSON.stringify({ type: 'connected', data: {}, ts: new Date().toISOString() })}\n\n`)
      sseClients.add(res)
      req.on('close', () => sseClients.delete(res))
      return
    }



    if (url.pathname === '/__smoke/external-voice-service') {
      externalVoiceService = true
      localServiceStopped = false
      sendJson(res, { ok: true })
      return
    }

    if (url.pathname === '/voice/local/stop') {
      localServiceStopped = true
      sendJson(res, { ok: true, status: 'stopped', external: externalVoiceService, message: externalVoiceService ? '已停止跟踪本地语音服务' : '已停止' })
      return
    }

    if (url.pathname === '/voice/local/restart') {
      localServiceStopped = true
      sendJson(res, { ok: true, status: 'stopped', externalStopped: externalVoiceService, requiresManualStop: externalVoiceService, engine: 'sensevoice', model: 'sensevoice-small' })
      return
    }

    if (url.pathname === '/voice/local/diagnostics/package') {
      sendJson(res, {
        ok: true,
        kind: 'bailongma.local_voice_diagnostics',
        schemaVersion: 1,
        generatedAt: Date.now(),
        app: { name: 'BaiLongma', version: '2.2.0', platform: 'darwin' },
        privacy: { secretsIncluded: false, audioIncluded: false, voiceprintIncluded: false },
        overview: { ok: true, level: readinessApplied ? 'ok' : 'pending' },
        readiness: { ok: true, level: readinessApplied ? 'ok' : 'warn' },
        doctor: { ok: true, level: readinessApplied ? 'ok' : 'warn' },
        speaker: { status: { reachable: readinessApplied, configured: localDoctorFixed }, backups: [] },
        events: { recent: [{ event: { type: 'wake:accepted' } }], summary: { level: 'ok' } },
      })
      return
    }

    if (url.pathname === '/voice/local/overview') {
      sendJson(res, {
        ok: true,
        level: readinessApplied ? 'ok' : 'pending',
        ready: readinessApplied,
        title: readinessApplied ? '本地语音基本可用' : '本地语音等待实测',
        summary: readinessApplied ? `复用已运行服务 · SenseVoice / sensevoice-small · ${localDoctorFixed ? '声纹已录入' : '声纹未录入'} · wake 1/0 · ASR 1` : '本地语音服务尚未运行。',
        issues: readinessApplied ? [] : ['最近还没有完成真实唤醒/识别实测。'],
        primaryAction: readinessApplied ? { id: 'ready', label: '可以使用', action: '现在可以直接用唤醒词发指令。' } : { id: 'prepare', label: '一键准备', action: '点击一键语音准备。' },
        local: { status: readinessApplied ? 'running' : 'stopped', external: externalVoiceService, model: 'sensevoice-small' },
        speaker: { reachable: readinessApplied, configured: localDoctorFixed },
        metrics: { wakeAccepted: readinessApplied ? 1 : 0, wakeRejected: 0, asrFinal: readinessApplied ? 1 : 0, ttsStop: readinessApplied ? 1 : 0 },
      })
      return
    }

    if (url.pathname === '/voice/local/self-test/start') {
      sendJson(res, {
        ok: true,
        since: Date.now(),
        selfTest: {
          ok: true,
          level: 'pending',
          instruction: '请说：龙马，测试一下',
          steps: [
            { id: 'local_process', label: '本地服务', status: 'ok', detail: externalVoiceService ? '运行中：SenseVoice / sensevoice-small（复用已运行服务）' : '运行中：SenseVoice / sensevoice-small' },
            { id: 'wake_event', label: '唤醒事件', status: 'pending', detail: '等待唤醒事件。' },
          ],
          events: [],
        },
      })
      return
    }

    if (url.pathname === '/voice/local/self-test') {
      sendJson(res, {
        ok: true,
        level: readinessApplied ? 'ok' : 'pending',
        instruction: '请说：龙马，测试一下',
        steps: readinessApplied ? [
          { id: 'local_process', label: '本地服务', status: 'ok', detail: externalVoiceService ? '运行中：SenseVoice / sensevoice-small（复用已运行服务）' : '运行中：SenseVoice / sensevoice-small' },
          { id: 'wake_event', label: '唤醒事件', status: 'ok', detail: '已接受 1 次，拒绝 0 次。' },
          { id: 'asr_final', label: '识别结果', status: 'ok', detail: '收到 1 条最终识别结果。' },
          { id: 'tts_loop', label: '播报闭环', status: 'ok', detail: 'TTS 已完成 1 次。' },
        ] : [
          { id: 'local_process', label: '本地服务', status: 'pending', detail: '等待开始实测。' },
          { id: 'wake_event', label: '唤醒事件', status: 'pending', detail: '等待唤醒事件。' },
        ],
        local: { external: externalVoiceService, port: 3723 },
        events: readinessApplied ? [{ event: { type: 'wake:accepted' } }, { event: { type: 'asr:final' } }, { event: { type: 'tts:stop' } }] : [],
      })
      return
    }

    if (url.pathname === '/__smoke/speaker-gate-lock') {
      speakerGateLocked = true
      sendJson(res, { ok: true })
      return
    }

    if (url.pathname === '/voice/local/readiness') {
      sendJson(res, {
        ok: true,
        level: localServiceStopped ? 'warn' : readinessApplied ? 'ok' : 'warn',
        recommendedPreset: { id: 'balanced', label: '均衡推荐', reason: '建立稳定语音基线。' },
        speakerStatus: { reachable: readinessApplied, configured: localDoctorFixed, sampleCount: localDoctorFixed ? 3 : 0, detail: readinessApplied ? '本地服务可达。' : '本地服务未运行。' },
        local: { status: localServiceStopped ? 'stopped' : readinessApplied ? 'running' : 'stopped', engine: 'sensevoice', model: 'sensevoice-small', external: externalVoiceService && !localServiceStopped, port: 3723 },
        voice: { asrProvider: 'local', localAsrModel: 'sensevoice-small', wakeWordEnabled: true, speakerVerificationEnabled: speakerGateLocked },
        steps: speakerGateLocked ? [
          { id: 'local_provider', label: '本地中文识别', status: 'ok', detail: '已使用本地 SenseVoiceSmall。' },
          { id: 'speaker_voiceprint', label: '本人声纹', status: 'warn', detail: '还没有录入声纹。', uiAction: 'enroll_speaker' },
          { id: 'speaker_gate_safe', label: '声纹门控安全', status: 'error', detail: '已开启“只响应我的声音”，但本地服务没有可用声纹；这会导致你也唤不醒。', fixAction: 'disable_speaker_gate' },
        ] : readinessApplied ? [
          { id: 'local_provider', label: '本地中文识别', status: 'ok', detail: '已使用本地 SenseVoiceSmall。' },
          { id: 'local_process', label: '本地服务启动', status: 'ok', detail: externalVoiceService ? '运行中：SenseVoice / sensevoice-small（复用已运行服务）' : '运行中：SenseVoice / sensevoice-small' },
          { id: 'wake_guard', label: '唤醒保护', status: 'ok', detail: '严格唤醒已开启。' },
          { id: 'wake_kws', label: '本地 KWS 唤醒模型', status: 'info', detail: '当前稳定路径是 ASR 文本唤醒；KWS 预留。' },
          { id: 'speaker_voiceprint', label: '本人声纹', status: 'warn', detail: '还没有录入声纹。', uiAction: 'enroll_speaker' },
        ] : [
          { id: 'local_provider', label: '本地中文识别', status: 'ok', detail: '已使用本地 SenseVoiceSmall。' },
          { id: 'local_process', label: '本地服务启动', status: 'warn', detail: '本地语音服务尚未运行。', fixAction: 'start_local_voice' },
          { id: 'video_guard', label: '视频抗干扰', status: 'warn', detail: '播放视频时建议开启保护。', fixAction: 'apply_video_guard' },
          { id: 'wake_kws', label: '本地 KWS 唤醒模型', status: 'info', detail: '当前稳定路径是 ASR 文本唤醒；KWS 预留。' },
          { id: 'speaker_voiceprint', label: '本人声纹', status: 'pending', detail: '本地服务启动后才能确认声纹。' },
          { id: 'speaker_gate_safe', label: '声纹门控安全', status: 'info', detail: '声纹门控未强制开启。' },
        ],
        nextActions: [],
      })
      return
    }

    if (url.pathname === '/voice/local/readiness/apply') {
      readinessApplied = true
      localDoctorFixed = true
      localDoctorFixHistory = [{ id: 'voice_readiness_smoke', at: Date.now(), action: 'voice_readiness_wizard', label: '一键语音准备', status: 'running', before: { localAsrModel: 'small' }, after: { asrProvider: 'local' } }]
      sendJson(res, {
        ok: true,
        started: { status: 'running', engine: 'sensevoice', engineLabel: 'SenseVoice', model: 'sensevoice-small' },
        record: localDoctorFixHistory[0],
        voice: { asrProvider: 'local', localAsrModel: 'sensevoice-small', asrProfile: 'balanced', wakeWordEnabled: true, wakeDetectionProvider: 'text', wakeKwsEngine: 'none', wakeKwsModelPath: '', wakeKwsThreshold: 0.50, wakeMode: 'strict', wakeRepeatSuppression: true, wakeConfidenceThreshold: 0.72, wakeMinCommandChars: 2, wakeCooldownMs: 1200, wakeRequireSpeakerWhenEnabled: true, speakerVerificationEnabled: false, speakerThreshold: 0.55, videoVoiceDuckEnabled: true, videoVoicePttEnabled: true, videoVoiceAecEnabled: true, videoVoiceDuckLevel: 0.10, videoVoiceDuckHoldMs: 2200, videoVoiceDuckSensitivity: 1.0, voiceLocalDoctorHistory: localDoctorFixHistory },
        readiness: { ok: true, level: 'ok' },
        speaker: { skipped: true },
      })
      return
    }

    if (url.pathname === '/voice/local/speaker/calibration') {
      sendJson(res, {
        ok: true,
        currentThreshold: 0.63,
        recommendedThreshold: 0.49,
        changed: true,
        mode: 'lower_for_owner',
        reason: '本次本人测试分数 0.520 低于当前阈值 0.63，建议降到 0.49，给本人声音留出余量。',
        test: { score: 0.52, passed: false },
        recent: { speakerAccepted: 0, speakerRejected: 1, rejectedScores: [0.52] },
        actions: [{ id: 'apply_threshold', label: '应用 0.49' }],
      })
      return
    }

    if (url.pathname === '/voice/local/speaker/calibration/apply') {
      localDoctorFixed = true
      sendJson(res, {
        ok: true,
        applied: { speakerThreshold: 0.49, speakerVerificationEnabled: true },
        voice: { speakerThreshold: 0.49, speakerVerificationEnabled: true },
        recommendation: { ok: true, currentThreshold: 0.49, recommendedThreshold: 0.49, changed: false, reason: '已应用建议阈值。', recent: { speakerAccepted: 0, speakerRejected: 1 } },
        record: { id: 'speaker_calibration_smoke', action: 'speaker_calibration' },
      })
      return
    }

    if (url.pathname === '/voice/local/speaker/status') {
      sendJson(res, {
        ok: true,
        speaker: localDoctorFixed
          ? { ok: true, reachable: true, configured: true, sampleCount: 3, threshold: 0.58, detail: '已录入 3 个声纹样本。' }
          : { ok: false, reachable: false, configured: false, reason: 'local_voice_not_running', detail: '本地语音服务未运行，无法读取声纹状态。' },
        local: { status: localDoctorFixed ? 'running' : 'stopped', model: 'sensevoice-small', external: externalVoiceService, port: 3723 },
        voice: { speakerVerificationEnabled: false, speakerThreshold: 0.63 },
      })
      return
    }


    if (url.pathname === '/voice/local/speaker/clear') {
      speakerBackupAvailable = true
      sendJson(res, { ok: true, cleared: true, speaker: { ok: true, mode: 'runtime', reachable: true, configured: false, sampleCount: 0, threshold: 0.55, backup: { name: 'voiceprint-smoke.json' } }, voice: { speakerVerificationEnabled: false } })
      return
    }


    if (url.pathname === '/voice/local/speaker/backups') {
      sendJson(res, { ok: true, backups: speakerBackupAvailable ? [{ name: 'voiceprint-smoke.json', size: 128, mtimeMs: Date.now() }] : [] })
      return
    }

    if (url.pathname === '/voice/local/speaker/restore') {
      localDoctorFixed = true
      speakerBackupAvailable = true
      sendJson(res, { ok: true, restored: true, backup: { name: 'voiceprint-smoke.json' }, voice: { speakerVerificationEnabled: true } })
      return
    }

    if (url.pathname === '/voice/local/doctor') {
      sendJson(res, {
        ok: true,
        level: localDoctorFixed ? 'ok' : 'warn',
        speakerStatus: { ok: true, reachable: true, configured: localDoctorFixed, sampleCount: localDoctorFixed ? 3 : 0, detail: localDoctorFixed ? '已录入 3 个声纹样本。' : '本地服务可达，但还没有录入声纹。' },
        recentFixes: localDoctorFixHistory,
        checks: localDoctorFixed ? [
          { id: 'provider', label: '识别服务商', status: 'ok', detail: '当前使用本地 ASR，音频不会上传云端。', action: '保持本地模式。' },
          { id: 'process', label: '本地 ASR 进程', status: 'ok', detail: externalVoiceService ? '运行中：sensevoice / sensevoice-small / port 3723（复用已运行服务）' : '运行中：sensevoice / sensevoice-small / port 3723', action: '可以开始麦克风测试。' },
        ] : [
          { id: 'provider', label: '识别服务商', status: 'ok', detail: '当前使用本地 ASR，音频不会上传云端。', action: '保持本地模式。' },
          { id: 'process', label: '本地 ASR 进程', status: 'warn', detail: 'stopped：本地语音服务未运行', action: '点击启动本地语音服务。', fixAction: 'start_local_voice' },
          { id: 'video_guard', label: '视频抗干扰', status: 'warn', detail: '视频播放场景下仍有保护项未开启。', action: '应用“视频抗干扰”预设。', fixAction: 'apply_video_guard' },
        ],
      })
      return
    }

    if (url.pathname === '/voice/local/doctor/fix') {
      const chunks = []
      req.on('data', chunk => chunks.push(chunk))
      req.on('end', () => {
        let action = 'start_local_voice'
        try { action = JSON.parse(Buffer.concat(chunks).toString('utf-8') || '{}').action || action } catch {}
        if (action === 'disable_speaker_gate') {
          speakerGateLocked = false
          localDoctorFixHistory = [{ id: 'voice_doctor_unlock', at: Date.now(), action: 'disable_speaker_gate', label: '关闭声纹门控防锁死', status: 'ok', before: { speakerVerificationEnabled: true }, after: { speakerVerificationEnabled: false } }]
          sendJson(res, { ok: true, action, record: localDoctorFixHistory[0], voice: { speakerVerificationEnabled: false, wakeRequireSpeakerWhenEnabled: false, voiceLocalDoctorHistory: localDoctorFixHistory }, doctor: { ok: true, level: 'ok', recentFixes: localDoctorFixHistory, checks: [] } })
          return
        }
        localDoctorFixed = true
        localDoctorFixHistory = [{ id: 'voice_doctor_smoke', at: Date.now(), action: 'start_local_voice', label: '启动本地语音服务', status: 'running', before: { localAsrModel: 'small' }, after: { localAsrModel: 'sensevoice-small' } }]
        sendJson(res, {
          ok: true,
          action: 'start_local_voice',
          record: localDoctorFixHistory[0],
          voice: { asrProvider: 'local', localAsrModel: 'sensevoice-small', asrProfile: 'balanced', voiceLocalDoctorHistory: localDoctorFixHistory },
          doctor: { ok: true, level: 'ok', local: { external: externalVoiceService, port: 3723 }, speakerStatus: { ok: true, reachable: true, configured: true, sampleCount: 3, detail: '已录入 3 个声纹样本。' }, recentFixes: localDoctorFixHistory, checks: [{ id: 'process', label: '本地 ASR 进程', status: 'ok', detail: externalVoiceService ? '运行中：sensevoice / sensevoice-small / port 3723（复用已运行服务）' : '运行中：sensevoice / sensevoice-small / port 3723' }] },
        })
      })
      return
    }


    if (url.pathname === '/voice/local/doctor/rollback') {
      localDoctorRollback = true
      localDoctorFixed = false
      localDoctorFixHistory = [{ id: 'voice_doctor_rollback', at: Date.now(), action: 'rollback_local_doctor_fix', label: '回滚：启动本地语音服务', status: 'ok', rollbackOf: 'voice_doctor_smoke' }]
      sendJson(res, {
        ok: true,
        rolledBack: 'voice_doctor_smoke',
        record: localDoctorFixHistory[0],
        voice: { asrProvider: 'local', localAsrModel: 'small', asrProfile: 'balanced', voiceLocalDoctorHistory: localDoctorFixHistory },
        doctor: { ok: true, level: 'warn', speakerStatus: { ok: true, reachable: true, configured: false, sampleCount: 0, detail: '本地服务可达，但还没有录入声纹。' }, recentFixes: localDoctorFixHistory, checks: [{ id: 'process', label: '本地 ASR 进程', status: 'warn', detail: 'stopped：本地语音服务未运行' }] },
      })
      return
    }

    if (url.pathname === '/voice/local/start') {
      localDoctorFixed = true
      sendJson(res, { ok: true, status: 'starting', engine: 'sensevoice', engineLabel: 'SenseVoice', model: 'sensevoice-small' })
      return
    }

    if (url.pathname === '/voice/local/status') {
      sendJson(res, { ok: true, running: localDoctorFixed, provider: 'local', model: 'sensevoice-small' })
      return
    }

    if (url.pathname === '/message') {
      sendJson(res, { ok: true })
      return
    }

    res.writeHead(404)
    res.end('not found')
  })

  server.closeAllSse = () => {
    for (const client of sseClients) {
      try { client.end() } catch {}
    }
    sseClients.clear()
  }
  server.emitSse = (event) => {
    for (const client of sseClients) {
      try { client.write(`data: ${JSON.stringify(event)}\n\n`) } catch {}
    }
  }
  return server
}

function listen(server) {
  return new Promise((resolve, reject) => {
    server.listen(0, '127.0.0.1', () => resolve(server.address().port))
    server.on('error', reject)
  })
}

const server = createServer()
const port = await listen(server)
const baseUrl = `http://127.0.0.1:${port}`
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1280, height: 840 } })
await page.addInitScript(() => {
  localStorage.setItem('bailongma-memory-graph-enabled', 'true')
})
const errors = []
page.on('pageerror', err => errors.push(err.message))
page.on('console', msg => {
  if (msg.text().includes('/acui') && msg.text().includes('WebSocket connection')) return
  if (msg.text().includes('Failed to load resource: the server responded with a status of 404')) return
  if (msg.type() === 'error') errors.push(msg.text())
})
page.on('response', response => {
  if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`)
})

try {
  const vendorResponse = await page.goto(`${baseUrl}/vendor/d3/d3.min.js`)
  if (!vendorResponse?.ok()) throw new Error('local d3 vendor route failed')

  await page.goto(`${baseUrl}/brain-ui`, { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => window.d3, null, { timeout: 5000 })
  await page.waitForFunction(() => Number(document.querySelector('#node-count')?.textContent || 0) >= 2, null, { timeout: 5000 })
  await page.waitForFunction(() => window.d3 && document.querySelector('#agent-brand-name')?.textContent.includes('SmokeLongma'))
  await page.fill('#msg-input', '马云是谁')
  await page.click('#send-btn')
  await page.waitForTimeout(300)
  const appearedTooFast = await page.evaluate(() => document.body.classList.contains('person-card-mode'))
  if (appearedTooFast) throw new Error('person card appeared before the intended reveal delay')
  await page.waitForFunction(() => document.body.classList.contains('person-card-mode') && document.querySelector('#pc-name')?.textContent.includes('马云'))
  const enteringSeen = await page.evaluate(() => document.querySelector('#person-card-panel')?.classList.contains('pc-entering'))
  if (!enteringSeen) throw new Error('person card did not use the entering glitch state')
  server.emitSse({
    type: 'message',
    data: {
      from: 'consciousness',
      content: '马云，1964年生，浙江杭州人，阿里巴巴集团创始人，曾任董事局主席，创办了淘宝、支付宝，多次成为中国首富。',
    },
    ts: new Date().toISOString(),
  })
  await page.waitForFunction(() => document.querySelector('#pc-summary')?.textContent.includes('阿里巴巴集团创始人'))

  const snapshot = await page.evaluate(() => ({
    d3: Boolean(window.d3),
    nodes: Number(document.querySelector('#node-count')?.textContent || 0),
    links: Number(document.querySelector('#link-count')?.textContent || 0),
    acuiHost: Boolean(document.getElementById('acui-host')),
    personCard: document.querySelector('#pc-name')?.textContent || '',
    personSummary: document.querySelector('#pc-summary')?.textContent || '',
    personKnownFor: [...document.querySelectorAll('#pc-known-list li')].map(li => li.textContent).join(' / '),
    personImage: !document.querySelector('#pc-hero-img')?.hidden,
    closeHidden: getComputedStyle(document.querySelector('#pc-exit-btn')).opacity === '0',
    brand: document.querySelector('#agent-brand-name')?.textContent || '',
    voiceClientsCount: document.querySelector('#voice-clients-count')?.textContent || '',
    voiceClientCard: document.querySelector('.voice-client-card')?.textContent || '',
  }))

  if (!snapshot.d3) throw new Error('d3 global missing')
  if (snapshot.nodes < 2) throw new Error(`expected at least 2 graph nodes, saw ${snapshot.nodes}`)
  if (!snapshot.acuiHost) throw new Error('ACUI host was not bootstrapped')
  if (!snapshot.personCard.includes('马云')) throw new Error('person card did not render the requested person')
  if (!snapshot.personSummary.includes('阿里巴巴集团创始人')) throw new Error('person card did not absorb assistant summary')
  if (!snapshot.personKnownFor.includes('淘宝')) throw new Error('person card did not absorb assistant known-for items')
  if (!snapshot.personImage) throw new Error('person card hero image was not visible')
  if (!snapshot.closeHidden) throw new Error('person card close button should be hidden until hover')
  await page.waitForFunction(() => document.querySelector('#voice-clients-count')?.textContent === '1' && document.querySelector('.voice-client-card')?.textContent.includes('smoke-esp32'))
  await page.click('#settings-btn')
  await page.waitForSelector('#settings-overlay:not([hidden])')
  await page.evaluate(() => {
    document.querySelectorAll('.settings-nav-item').forEach(btn => btn.classList.toggle('active', btn.dataset.tab === 'voice'))
    document.querySelectorAll('.settings-tab').forEach(tab => tab.classList.toggle('active', tab.dataset.tab === 'voice'))
  })
  await page.waitForFunction(() => document.querySelector('#voice-video-duck-level-val')?.textContent.includes('25%'), null, { timeout: 5000 }).catch(() => {})
  const videoVoiceLabelDebug = await page.evaluate(() => ({
    level: document.querySelector('#voice-video-duck-level-val')?.textContent || '',
    hold: document.querySelector('#voice-video-duck-hold-val')?.textContent || '',
    hasFetch: typeof window.fetch,
  }))
  if (!videoVoiceLabelDebug.level.includes('25%') || !videoVoiceLabelDebug.hold.includes('3.6s')) throw new Error(`server video voice labels did not hydrate settings UI: ${JSON.stringify(videoVoiceLabelDebug)}`)
  const videoVoiceSnapshot = await page.evaluate(() => ({
    duckChecked: document.querySelector('#voice-video-duck')?.checked,
    pttChecked: document.querySelector('#voice-video-ptt')?.checked,
    aecChecked: document.querySelector('#voice-video-aec')?.checked,
    preRollChecked: document.querySelector('#voice-video-preroll')?.checked,
    duckLevel: document.querySelector('#voice-video-duck-level')?.value,
    duckHold: document.querySelector('#voice-video-duck-hold')?.value,
    sensitivity: document.querySelector('#voice-video-duck-sensitivity')?.value,
    preRollMs: document.querySelector('#voice-video-preroll-ms')?.value,
    preRollLabel: document.querySelector('#voice-video-preroll-ms-val')?.textContent,
    speakerThreshold: document.querySelector('#voice-speaker-threshold')?.value,
    wakeDetectionProvider: document.querySelector('#voice-wake-detection-provider')?.value,
    kwsEngine: document.querySelector('#voice-kws-engine')?.value,
    kwsModelPath: document.querySelector('#voice-kws-model-path')?.value,
    kwsThreshold: document.querySelector('#voice-kws-threshold')?.value,
    kwsThresholdLabel: document.querySelector('#voice-kws-threshold-val')?.textContent,
    storedWakeDetectionProvider: localStorage.getItem('bailongma-voice-wake-detection-provider'),
    storedKwsEngine: localStorage.getItem('bailongma-voice-kws-engine'),
    storedKwsModelPath: localStorage.getItem('bailongma-voice-kws-model-path'),
    storedKwsThreshold: localStorage.getItem('bailongma-voice-kws-threshold'),
    storedDuck: localStorage.getItem('bailongma-voice-video-duck'),
    storedPtt: localStorage.getItem('bailongma-voice-video-ptt'),
    storedAec: localStorage.getItem('bailongma-voice-video-aec'),
    storedLevel: localStorage.getItem('bailongma-voice-video-duck-level'),
    storedHold: localStorage.getItem('bailongma-voice-video-duck-hold'),
    storedSensitivity: localStorage.getItem('bailongma-voice-video-duck-sensitivity'),
    storedPreRoll: localStorage.getItem('bailongma-voice-video-preroll-enabled'),
    storedPreRollMs: localStorage.getItem('bailongma-voice-video-preroll-ms'),
    storedSpeakerThreshold: localStorage.getItem('bailongma-voice-speaker-threshold'),
  }))
  if (videoVoiceSnapshot.speakerThreshold !== '0.63' || videoVoiceSnapshot.storedSpeakerThreshold !== '0.63') throw new Error('server speaker threshold did not hydrate settings UI and localStorage')
  if (videoVoiceSnapshot.wakeDetectionProvider !== 'hybrid' || videoVoiceSnapshot.kwsEngine !== 'sherpa-onnx' || videoVoiceSnapshot.kwsModelPath !== 'models/kws/longma.onnx' || videoVoiceSnapshot.kwsThreshold !== '0.62' || !videoVoiceSnapshot.kwsThresholdLabel.includes('0.62')) throw new Error(`server KWS wake settings did not hydrate settings UI: ${JSON.stringify(videoVoiceSnapshot)}`)
  if (videoVoiceSnapshot.storedWakeDetectionProvider !== 'hybrid' || videoVoiceSnapshot.storedKwsEngine !== 'sherpa-onnx' || videoVoiceSnapshot.storedKwsModelPath !== 'models/kws/longma.onnx' || videoVoiceSnapshot.storedKwsThreshold !== '0.62') throw new Error('server KWS wake settings were not mirrored to localStorage')
  if (videoVoiceSnapshot.duckChecked !== false || videoVoiceSnapshot.pttChecked !== true || videoVoiceSnapshot.aecChecked !== false) throw new Error('server video voice booleans did not hydrate settings UI')
  if (videoVoiceSnapshot.duckLevel !== '0.25' || videoVoiceSnapshot.duckHold !== '3600' || videoVoiceSnapshot.sensitivity !== '1.35' || videoVoiceSnapshot.preRollMs !== '2800' || !videoVoiceSnapshot.preRollLabel.includes('2.8s')) throw new Error('server video voice numeric settings did not hydrate settings UI')
  if (videoVoiceSnapshot.storedDuck !== 'false' || videoVoiceSnapshot.storedPtt !== 'true' || videoVoiceSnapshot.storedAec !== 'false') throw new Error('server video voice booleans were not mirrored to localStorage')
  if (videoVoiceSnapshot.preRollChecked !== true || videoVoiceSnapshot.storedPreRoll !== 'true') throw new Error('server video pre-roll toggle did not hydrate settings UI/localStorage')
  if (videoVoiceSnapshot.storedLevel !== '0.25' || videoVoiceSnapshot.storedHold !== '3600' || videoVoiceSnapshot.storedSensitivity !== '1.35' || videoVoiceSnapshot.storedPreRollMs !== '2800') throw new Error('server video voice numeric settings were not mirrored to localStorage')
  const speakerStatusText = await page.textContent('#voice-speaker-status')
  if (!speakerStatusText.includes('服务不可达') || !speakerStatusText.includes('本地语音服务未运行')) throw new Error(`speaker status did not use backend runtime endpoint: ${speakerStatusText}`)
  const speakerActionVisible = await page.evaluate(() => ({
    startHidden: document.querySelector('#voice-speaker-start-service')?.hidden,
    enrollHidden: document.querySelector('#voice-speaker-enroll-shortcut')?.hidden,
    refreshHidden: document.querySelector('#voice-speaker-refresh-status')?.hidden,
  }))
  if (speakerActionVisible.startHidden !== false || speakerActionVisible.enrollHidden !== true || speakerActionVisible.refreshHidden !== false) throw new Error(`speaker status action buttons not shown for unreachable service: ${JSON.stringify(speakerActionVisible)}`)
  await page.waitForFunction(() => document.querySelector('#voice-local-overview')?.textContent.includes('本地语音'))
  const overviewInitial = await page.textContent('#voice-local-overview')
  if (!overviewInitial.includes('一键准备') && !overviewInitial.includes('等待实测')) throw new Error(`voice overview did not render initial action: ${overviewInitial}`)
  await page.evaluate(() => { window.__voiceDiagnosticsClipboard = ''; navigator.clipboard = { writeText: async text => { window.__voiceDiagnosticsClipboard = text; } } })
  await page.click('#voice-diagnostics-export')
  await page.waitForFunction(() => document.querySelector('#voice-diagnostics-feedback')?.textContent.includes('诊断包已复制'))
  const diagnosticsClipboard = await page.evaluate(() => window.__voiceDiagnosticsClipboard || window.__lastVoiceDiagnosticsPackage || '')
  if (!diagnosticsClipboard.includes('bailongma.local_voice_diagnostics') || diagnosticsClipboard.includes('sk-')) throw new Error(`voice diagnostics export did not copy safe package: ${diagnosticsClipboard.slice(0, 200)}`)
  const readinessText = await page.textContent('#voice-readiness-list')
  if (!readinessText.includes('本地中文识别') || !readinessText.includes('本地服务启动') || !readinessText.includes('本人声纹') || !readinessText.includes('本地 KWS 唤醒模型')) throw new Error(`voice readiness wizard did not render guided steps: ${readinessText}`)
  await page.click('#voice-readiness-apply')
  await page.waitForFunction(() => document.querySelector('#voice-readiness-feedback')?.textContent.includes('已应用本地语音基线'))
  await page.waitForFunction(() => document.querySelector('#voice-readiness-list')?.textContent.includes('运行中：SenseVoice'))
  await page.waitForFunction(() => document.querySelector('#voice-local-overview')?.textContent.includes('本地语音基本可用') || document.querySelector('#voice-local-overview')?.textContent.includes('可以使用'))
  await fetch(`${baseUrl}/__smoke/external-voice-service`, { method: 'POST' })
  await page.click('#voice-local-doctor-refresh')
  await page.waitForFunction(() => document.querySelector('#voice-local-doctor-list')?.textContent.includes('复用') || document.querySelector('#voice-local-doctor-list')?.textContent.includes('本地 ASR 进程'))
  await page.click('#voice-readiness-apply')
  await page.waitForFunction(() => document.querySelector('#voice-readiness-list')?.textContent.includes('复用已运行服务'))
  await page.click('#voice-local-restart')
  await page.waitForFunction(() => document.querySelector('#voice-local-service-feedback')?.textContent.includes('取消跟踪复用服务'))
  await fetch(`${baseUrl}/__smoke/external-voice-service`, { method: 'POST' })
  await page.click('#voice-local-stop')
  await page.waitForFunction(() => document.querySelector('#voice-local-service-feedback')?.textContent.includes('取消跟踪复用服务'))
  const selfTestInitial = await page.textContent('#voice-self-test-list')
  if (!selfTestInitial.includes('语音实测') && !selfTestInitial.includes('本地服务')) throw new Error(`voice self-test panel did not initialize: ${selfTestInitial}`)
  await page.click('#voice-self-test-start')
  await page.waitForFunction(() => document.querySelector('#voice-self-test-feedback')?.textContent.includes('实测已开始') || document.querySelector('#voice-self-test-feedback')?.textContent.includes('闭环通过'))
  await page.waitForFunction(() => document.querySelector('#voice-self-test-list')?.textContent.includes('唤醒事件') && document.querySelector('#voice-self-test-list')?.textContent.includes('识别结果'))
  const readinessSnapshot = await page.evaluate(() => ({
    wakeMode: document.querySelector('#voice-wake-mode')?.value,
    duck: document.querySelector('#voice-video-duck')?.checked,
    aec: document.querySelector('#voice-video-aec')?.checked,
    speakerVerify: document.querySelector('#voice-speaker-verify')?.checked,
    storedProvider: localStorage.getItem('bailongma-voice-provider'),
  }))
  if (readinessSnapshot.wakeMode !== 'strict' || readinessSnapshot.duck !== true || readinessSnapshot.aec !== true || readinessSnapshot.speakerVerify !== false) throw new Error(`voice readiness wizard did not sync controls: ${JSON.stringify(readinessSnapshot)}`)
  await page.waitForFunction(() => document.querySelector('#voice-readiness-list')?.textContent.includes('去录入'))
  const enrollActionVisible = await page.evaluate(() => Boolean(document.querySelector('.voice-readiness-action[data-action="enroll_speaker"]')))
  if (!enrollActionVisible) throw new Error('voice readiness wizard did not expose enroll speaker action')
  await fetch(`${baseUrl}/__smoke/speaker-gate-lock`, { method: 'POST' })
  await page.click('#voice-readiness-apply')
  await page.waitForFunction(() => document.querySelector('#voice-readiness-feedback')?.textContent.includes('声纹未录入，已保持关闭防锁死'))
  const localDoctorText = await page.textContent('#voice-local-doctor-list')
  if (!localDoctorText.includes('本地 ASR 进程') || !localDoctorText.includes('声纹服务')) throw new Error('local voice doctor did not render readiness checks')
  await page.evaluate(() => document.querySelector('.voice-local-doctor-rollback')?.click())
  await page.waitForFunction(() => document.querySelector('#voice-local-doctor-list')?.textContent.includes('回滚：'))
  await fetch(`${baseUrl}/voice/local/start`, { method: 'POST' })
  await page.click('#voice-speaker-refresh-status')
  await page.waitForFunction(() => document.querySelector('#voice-speaker-status')?.textContent.includes('已录入'))
  await page.click('#voice-calibrate-speaker')
  await page.waitForFunction(() => document.querySelector('#voice-speaker-calibration')?.textContent.includes('建议调整声纹严格度'))
  await page.click('#voice-apply-speaker-calibration')
  await page.waitForFunction(() => document.querySelector('#voice-speaker-feedback')?.textContent.includes('已应用声纹阈值'))
  const speakerCalibrationSnapshot = await page.evaluate(() => ({
    threshold: document.querySelector('#voice-speaker-threshold')?.value,
    label: document.querySelector('#voice-speaker-threshold-val')?.textContent,
    panel: document.querySelector('#voice-speaker-calibration')?.textContent || '',
    stored: localStorage.getItem('bailongma-voice-speaker-threshold'),
  }))
  if (speakerCalibrationSnapshot.threshold !== '0.49' || speakerCalibrationSnapshot.label !== '0.49' || speakerCalibrationSnapshot.stored !== '0.49') throw new Error(`speaker calibration did not sync threshold: ${JSON.stringify(speakerCalibrationSnapshot)}`)
  await page.click('#voice-clear-speaker')
  await page.waitForFunction(() => document.querySelector('#voice-speaker-feedback')?.textContent.includes('声纹已备份并清除'))
  await page.waitForFunction(() => localStorage.getItem('bailongma-voice-speaker-verify') === 'false')
  await page.waitForFunction(() => document.querySelector('#voice-speaker-backup-select')?.textContent.includes('smoke'))
  await page.selectOption('#voice-speaker-backup-select', 'voiceprint-smoke.json')
  await page.click('#voice-restore-speaker')
  await page.waitForFunction(() => document.querySelector('#voice-speaker-feedback')?.textContent.includes('已恢复声纹备份'))
  await page.waitForFunction(() => localStorage.getItem('bailongma-voice-speaker-verify') === 'true')
  await page.waitForFunction(() => document.querySelector('#voice-preset-list')?.textContent.includes('视频抗干扰') && document.querySelector('#voice-preset-list')?.textContent.includes('建议：视频抗干扰'), null, { timeout: 5000 })
  await page.evaluate(() => [...document.querySelectorAll('.voice-preset-card')].find(btn => btn.textContent.includes('视频抗干扰'))?.click())
  await page.waitForFunction(() => document.querySelector('#voice-preset-feedback')?.textContent.includes('已应用'))
  await page.waitForFunction(() => document.querySelector('#voice-preset-feedback')?.textContent.includes('已应用'))
  const presetSnapshot = await page.evaluate(() => ({
    wakeConfidence: document.querySelector('#voice-wake-confidence')?.value,
    wakeConfidenceLabel: document.querySelector('#voice-wake-confidence-val')?.textContent,
    cooldown: document.querySelector('#voice-wake-cooldown')?.value,
    cooldownLabel: document.querySelector('#voice-wake-cooldown-val')?.textContent,
    speakerThreshold: document.querySelector('#voice-speaker-threshold')?.value,
    speakerLabel: document.querySelector('#voice-speaker-threshold-val')?.textContent,
    duckChecked: document.querySelector('#voice-video-duck')?.checked,
    pttChecked: document.querySelector('#voice-video-ptt')?.checked,
    aecChecked: document.querySelector('#voice-video-aec')?.checked,
    preRollChecked: document.querySelector('#voice-video-preroll')?.checked,
    duckLevel: document.querySelector('#voice-video-duck-level')?.value,
    duckLabel: document.querySelector('#voice-video-duck-level-val')?.textContent,
    preRollMs: document.querySelector('#voice-video-preroll-ms')?.value,
    preRollLabel: document.querySelector('#voice-video-preroll-ms-val')?.textContent,
    storedConfidence: localStorage.getItem('bailongma-voice-wake-confidence-threshold'),
    storedSpeakerThreshold: localStorage.getItem('bailongma-voice-speaker-threshold'),
    storedDuck: localStorage.getItem('bailongma-voice-video-duck'),
    storedDuckLevel: localStorage.getItem('bailongma-voice-video-duck-level'),
    storedPreRoll: localStorage.getItem('bailongma-voice-video-preroll-enabled'),
    storedPreRollMs: localStorage.getItem('bailongma-voice-video-preroll-ms'),
  }))
  if (presetSnapshot.wakeConfidence !== '0.78' || presetSnapshot.wakeConfidenceLabel !== '0.78' || presetSnapshot.storedConfidence !== '0.78') throw new Error(`voice preset did not sync wake confidence: ${JSON.stringify(presetSnapshot)}`)
  if (presetSnapshot.cooldown !== '1600' || presetSnapshot.cooldownLabel !== '1.6s') throw new Error(`voice preset did not sync wake cooldown: ${JSON.stringify(presetSnapshot)}`)
  if (presetSnapshot.speakerThreshold !== '0.58' || presetSnapshot.speakerLabel !== '0.58' || presetSnapshot.storedSpeakerThreshold !== '0.58') throw new Error(`voice preset did not sync speaker threshold: ${JSON.stringify(presetSnapshot)}`)
  if (presetSnapshot.duckChecked !== true || presetSnapshot.pttChecked !== true || presetSnapshot.aecChecked !== true || presetSnapshot.preRollChecked !== true || presetSnapshot.storedDuck !== 'true' || presetSnapshot.storedPreRoll !== 'true') throw new Error(`voice preset did not sync video toggles: ${JSON.stringify(presetSnapshot)}`)
  if (presetSnapshot.duckLevel !== '0.08' || presetSnapshot.duckLabel !== '8%' || presetSnapshot.storedDuckLevel !== '0.08') throw new Error(`voice preset did not sync video duck level: ${JSON.stringify(presetSnapshot)}`)
  if (presetSnapshot.preRollMs !== '3000' || presetSnapshot.preRollLabel !== '3.0s' || presetSnapshot.storedPreRollMs !== '3000') throw new Error(`voice preset did not sync video pre-roll: ${JSON.stringify(presetSnapshot)}`)

  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent('bailongma:mic-level', { detail: { current: 0.021, peak: 0.034, threshold: 0.008, active: true, updatedAt: Date.now() } }))
    window.dispatchEvent(new CustomEvent('bailongma:voice-event', { detail: { type: 'wake:rejected', seq: 9001, detail: { reason: 'wake missing', confidence: 0.41 } } }))
    window.dispatchEvent(new CustomEvent('bailongma:voice-event', { detail: { type: 'speaker:rejected', seq: 9002, detail: { score: 0.42, threshold: 0.58, reason: 'not owner' } } }))
    window.dispatchEvent(new CustomEvent('bailongma:voice-event', { detail: { type: 'media:duck', seq: 9003, detail: { phase: 'asr_gate_open', holdMs: 3200, preRollChunks: 9, flushedChunks: 8 } } }))
  })
  await page.waitForFunction(() => document.querySelector('#voice-debug-mic')?.textContent.includes('cur 0.021') && document.querySelector('#voice-debug-wake')?.textContent.includes('拒绝：wake missing') && document.querySelector('#voice-debug-speaker')?.textContent.includes('拒绝：0.420') && document.querySelector('#voice-debug-media')?.textContent.includes('ASR门控开'))

  await page.click('#settings-close')
  await page.waitForFunction(() => document.querySelector('#settings-overlay')?.hidden === true)
  const voiceClientSnapshot = await page.evaluate(() => ({
    count: document.querySelector('#voice-clients-count')?.textContent || '',
    audio: document.querySelector('#voice-clients-audio-count')?.textContent || '',
    binary: document.querySelector('#voice-clients-binary-count')?.textContent || '',
    card: document.querySelector('.voice-client-card')?.textContent || '',
    diagnostics: document.querySelector('#voice-clients-diagnostics')?.textContent || '',
    guide: document.querySelector('#voice-clients-guide')?.textContent || '',
    history: document.querySelector('#voice-events-history-list')?.textContent || '',
    summary: document.querySelector('#voice-link-summary')?.textContent || '',
    check: document.querySelector('#voice-link-check')?.textContent || '',
  }))
  if (voiceClientSnapshot.count !== '1') throw new Error('voice clients panel did not show connected client count')
  if (!voiceClientSnapshot.card.includes('binary')) throw new Error('voice clients panel did not render negotiated binary mode')
  if (!voiceClientSnapshot.card.includes('链路正常')) throw new Error('voice clients panel did not render human advice')
  if (!voiceClientSnapshot.card.includes('Healthok')) throw new Error('voice clients panel did not render backend health level')
  if (!voiceClientSnapshot.diagnostics.includes('/voice/events/clients')) throw new Error('voice clients protocol diagnostics did not render clients endpoint')
  if (!voiceClientSnapshot.diagnostics.includes('/voice/events/history')) throw new Error('voice clients protocol diagnostics did not render history endpoint')
  if (!voiceClientSnapshot.diagnostics.includes('/voice/events/summary')) throw new Error('voice clients protocol diagnostics did not render summary endpoint')
  if (!voiceClientSnapshot.diagnostics.includes('/voice/events/check')) throw new Error('voice clients protocol diagnostics did not render check endpoint')
  if (!voiceClientSnapshot.diagnostics.includes('/voice/events/package')) throw new Error('voice clients protocol diagnostics did not render package endpoint')
  if (!voiceClientSnapshot.summary.includes('语音链路总控') || !voiceClientSnapshot.summary.includes('最短指令字数')) throw new Error('voice link summary did not render wake reject tuning advice')
  if (!voiceClientSnapshot.summary.includes('声纹拒绝') || !voiceClientSnapshot.summary.includes('声纹严格度')) throw new Error('voice link summary did not render speaker rejection diagnostics')
  await page.waitForFunction(() => document.querySelector('#voice-wake-tuning-actions')?.textContent.includes('降低最短指令字数') && document.querySelector('#voice-wake-tuning-actions')?.textContent.includes('降低声纹严格度') && document.querySelector('#voice-wake-tuning-actions')?.textContent.includes('安全自动调参'))
  await page.evaluate(() => document.querySelector('.voice-wake-tuning-action')?.click())
  await page.waitForFunction(() => document.querySelector('#voice-clients-feedback')?.textContent.includes('唤醒调参已应用'))
  await page.waitForFunction(() => localStorage.getItem('bailongma-voice-speaker-threshold') === '0.5')
  await page.waitForFunction(() => document.querySelector('.voice-wake-tuning-rollback')?.textContent.includes('回滚') && document.querySelector('.voice-wake-tuning-clear')?.textContent.includes('清空历史') && document.querySelector('#voice-wake-tuning-actions')?.textContent.includes('improved') && document.querySelector('#voice-wake-tuning-actions')?.textContent.includes('应用前拒绝') && document.querySelector('#voice-wake-tuning-actions')?.textContent.includes('声纹拒绝') && document.querySelector('#voice-wake-tuning-actions')?.textContent.includes('最短指令字数') && document.querySelector('#voice-wake-tuning-actions')?.textContent.includes('2字 → 1字') && document.querySelector('#voice-wake-tuning-actions')?.textContent.includes('声纹严格度') && document.querySelector('#voice-wake-tuning-actions')?.textContent.includes('0.63 → 0.50') && document.querySelector('#voice-wake-tuning-actions')?.textContent.includes('建议暂时保持当前参数'))
  await page.evaluate(() => document.querySelector('.voice-wake-tuning-clear')?.click())
  await page.waitForFunction(() => document.querySelector('#voice-clients-feedback')?.textContent.includes('已清空'))
  await page.waitForFunction(() => !document.querySelector('.voice-wake-tuning-rollback') && !document.querySelector('.voice-wake-tuning-clear'))
  await page.evaluate(() => document.querySelector('.voice-wake-tuning-action')?.click())
  await page.waitForFunction(() => document.querySelector('.voice-wake-tuning-rollback')?.textContent.includes('回滚'))
  await page.evaluate(() => document.querySelector('.voice-wake-tuning-rollback')?.click())
  await page.waitForFunction(() => document.querySelector('#voice-clients-feedback')?.textContent.includes('唤醒调参已回滚'))
  await page.waitForFunction(() => localStorage.getItem('bailongma-voice-speaker-threshold') === '0.63')
  if (!voiceClientSnapshot.history.includes('识别完成：打开灯光') || !voiceClientSnapshot.history.includes('tts:stop') || !voiceClientSnapshot.history.includes('confidence:0.81')) throw new Error('voice events history timeline did not render recent events and wake guard meta')
  await page.evaluate(() => document.querySelector('#voice-link-check-btn')?.click())
  await page.waitForFunction(() => document.querySelector('#voice-link-check')?.textContent.includes('一键语音链路自检'))
  const selfCheckText = await page.textContent('#voice-link-check')
  if (!selfCheckText.includes('全部通过') || !selfCheckText.includes('客户端连接') || !selfCheckText.includes('可以实测')) throw new Error('voice link self-check panel did not render expected status and actions')
  await page.evaluate(() => document.querySelector('#voice-package-btn')?.click())
  await page.waitForFunction(() => document.querySelector('#voice-package-panel')?.textContent.includes('设备接入包'))
  const packageText = await page.textContent('#voice-package-panel')
  if (!packageText.includes('README.md') || !packageText.includes('node-client-example.mjs') || !packageText.includes('client:hello')) throw new Error('voice onboarding package panel did not render files and client hello')
  if (!voiceClientSnapshot.guide.includes('npm run voice:events -- listen')) throw new Error('voice clients guide did not render debug connect command')
  if (!voiceClientSnapshot.guide.includes('esp32-test') || !voiceClientSnapshot.guide.includes('client:hello')) throw new Error('voice clients guide did not render LAN command and handshake example')
  await page.hover('.pc-card')
  await page.waitForFunction(() => Number(getComputedStyle(document.querySelector('#pc-exit-btn')).opacity) > 0.5)
  await page.click('#pc-exit-btn')
  const leavingSeen = await page.waitForFunction(() => document.querySelector('#person-card-panel')?.classList.contains('pc-leaving'), null, { timeout: 1000 })
  if (!leavingSeen) throw new Error('person card did not use the leaving glitch state')
  await page.waitForFunction(() => !document.body.classList.contains('person-card-mode') && !document.querySelector('#person-card-panel')?.classList.contains('pc-visible'))
  if (errors.length) throw new Error(`browser errors:\n${errors.join('\n')}`)

  console.log('[PASS] brain-ui smoke')
  console.log(JSON.stringify(snapshot, null, 2))
} finally {
  await browser.close()
  server.closeAllSse()
  await new Promise(resolve => server.close(resolve))
}
