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
        ],
        history: wakeTuningApplied ? [{ id: 'wake_tune_smoke', label: '降低最短指令字数到 1 字', reason: 'command too short', applied: { wakeMinCommandChars: 1 }, evaluation: { verdict: 'improved', advice: { level: 'ok', action: 'keep', text: '调参后唤醒表现变好，建议暂时保持当前参数并继续观察。' }, before: { wakeRejected: 2, wakeAccepted: 1 }, after: { wakeRejected: 0, wakeAccepted: 2 } } }] : [],
      })
      return
    }

    if (url.pathname === '/voice/wake/tuning/apply') {
      wakeTuningApplied = true
      sendJson(res, { ok: true, applied: { wakeMinCommandChars: 1 }, record: { id: 'wake_tune_smoke', label: '降低最短指令字数到 1 字', before: { wakeMinCommandChars: 2 }, after: { wakeMinCommandChars: 1 }, applied: { wakeMinCommandChars: 1 } }, history: [{ id: 'wake_tune_smoke', label: '降低最短指令字数到 1 字' }], voice: { wakeMinCommandChars: 1, wakeConfidenceThreshold: 0.72, wakeCooldownMs: 1200, wakeRequireSpeakerWhenEnabled: true } })
      return
    }


    if (url.pathname === '/voice/wake/tuning/rollback') {
      wakeTuningApplied = false
      sendJson(res, { ok: true, rolledBack: 'wake_tune_smoke', record: { id: 'wake_tune_rollback', rollbackOf: 'wake_tune_smoke' }, voice: { wakeMinCommandChars: 2, wakeConfidenceThreshold: 0.72, wakeCooldownMs: 1200, wakeRequireSpeakerWhenEnabled: true }, history: [] })
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

    if (url.pathname === '/voice/local/start' || url.pathname === '/voice/local/status') {
      sendJson(res, { ok: true, running: false, provider: 'local', model: 'sensevoice-small' })
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
    duckLevel: document.querySelector('#voice-video-duck-level')?.value,
    duckHold: document.querySelector('#voice-video-duck-hold')?.value,
    sensitivity: document.querySelector('#voice-video-duck-sensitivity')?.value,
    speakerThreshold: document.querySelector('#voice-speaker-threshold')?.value,
    storedDuck: localStorage.getItem('bailongma-voice-video-duck'),
    storedPtt: localStorage.getItem('bailongma-voice-video-ptt'),
    storedAec: localStorage.getItem('bailongma-voice-video-aec'),
    storedLevel: localStorage.getItem('bailongma-voice-video-duck-level'),
    storedHold: localStorage.getItem('bailongma-voice-video-duck-hold'),
    storedSensitivity: localStorage.getItem('bailongma-voice-video-duck-sensitivity'),
    storedSpeakerThreshold: localStorage.getItem('bailongma-voice-speaker-threshold'),
  }))
  if (videoVoiceSnapshot.speakerThreshold !== '0.63' || videoVoiceSnapshot.storedSpeakerThreshold !== '0.63') throw new Error('server speaker threshold did not hydrate settings UI and localStorage')
  if (videoVoiceSnapshot.duckChecked !== false || videoVoiceSnapshot.pttChecked !== true || videoVoiceSnapshot.aecChecked !== false) throw new Error('server video voice booleans did not hydrate settings UI')
  if (videoVoiceSnapshot.duckLevel !== '0.25' || videoVoiceSnapshot.duckHold !== '3600' || videoVoiceSnapshot.sensitivity !== '1.35') throw new Error('server video voice numeric settings did not hydrate settings UI')
  if (videoVoiceSnapshot.storedDuck !== 'false' || videoVoiceSnapshot.storedPtt !== 'true' || videoVoiceSnapshot.storedAec !== 'false') throw new Error('server video voice booleans were not mirrored to localStorage')
  if (videoVoiceSnapshot.storedLevel !== '0.25' || videoVoiceSnapshot.storedHold !== '3600' || videoVoiceSnapshot.storedSensitivity !== '1.35') throw new Error('server video voice numeric settings were not mirrored to localStorage')
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
  await page.waitForFunction(() => document.querySelector('#voice-wake-tuning-actions')?.textContent.includes('降低最短指令字数') && document.querySelector('#voice-wake-tuning-actions')?.textContent.includes('安全自动调参'))
  await page.evaluate(() => document.querySelector('.voice-wake-tuning-action')?.click())
  await page.waitForFunction(() => document.querySelector('#voice-clients-feedback')?.textContent.includes('唤醒调参已应用'))
  await page.waitForFunction(() => document.querySelector('.voice-wake-tuning-rollback')?.textContent.includes('回滚') && document.querySelector('#voice-wake-tuning-actions')?.textContent.includes('improved') && document.querySelector('#voice-wake-tuning-actions')?.textContent.includes('应用前拒绝') && document.querySelector('#voice-wake-tuning-actions')?.textContent.includes('建议暂时保持当前参数'))
  await page.evaluate(() => document.querySelector('.voice-wake-tuning-rollback')?.click())
  await page.waitForFunction(() => document.querySelector('#voice-clients-feedback')?.textContent.includes('唤醒调参已回滚'))
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
