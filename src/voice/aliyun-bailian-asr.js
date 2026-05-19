import crypto from 'crypto'
import { WebSocket } from 'ws'

const DASHSCOPE_ASR_WS_URL = 'wss://dashscope.aliyuncs.com/api-ws/v1/inference/'
const DEFAULT_MODEL = 'paraformer-realtime-v2'
const MAX_PENDING_CHUNKS = 32

function normalizeLanguage(lang = 'zh-CN') {
  const value = String(lang || 'zh-CN').trim().toLowerCase()
  if (value.startsWith('en')) return 'en'
  if (value.startsWith('yue')) return 'yue'
  if (value.startsWith('ja')) return 'ja'
  if (value.startsWith('ko')) return 'ko'
  return 'zh'
}

export function createAliyunBailianASRSession(config = {}, onTranscript, onError, onClose) {
  const apiKey = String(config.aliyunApiKey || config.dashscopeApiKey || '').trim()
  if (!apiKey) {
    onError?.('未配置阿里云百炼 API Key')
    return null
  }

  const taskId = crypto.randomUUID()
  const model = String(config.aliyunAsrModel || config.model || DEFAULT_MODEL).trim() || DEFAULT_MODEL
  const lang = normalizeLanguage(config.lang)
  const pending = []
  let taskStarted = false
  let closed = false

  const ws = new WebSocket(DASHSCOPE_ASR_WS_URL, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'X-DashScope-DataInspection': 'enable',
    },
  })

  function fail(message) {
    if (!closed) onError?.(message || '阿里云百炼语音识别错误')
  }

  function flushPending() {
    while (pending.length && ws.readyState === WebSocket.OPEN) {
      const buf = pending.shift()
      try { ws.send(buf) } catch {}
    }
  }

  ws.on('open', () => {
    const parameters = {
      sample_rate: 16000,
      format: 'pcm',
      language_hints: [lang],
      punctuation_prediction: true,
      inverse_text_normalization: true,
    }
    if (config.aliyunVocabularyId) parameters.vocabulary_id = String(config.aliyunVocabularyId).trim()

    ws.send(JSON.stringify({
      header: { action: 'run-task', task_id: taskId, streaming: 'duplex' },
      payload: {
        task_group: 'audio',
        task: 'asr',
        function: 'recognition',
        model,
        parameters,
        input: {},
      },
    }))
  })

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString())
      const event = msg?.header?.event
      if (event === 'task-started') {
        taskStarted = true
        flushPending()
        return
      }
      if (event === 'result-generated') {
        const sentence = msg?.payload?.output?.sentence
        const text = String(sentence?.text || '').trim()
        if (text) onTranscript?.(text, sentence?.status === 'sentence_end')
        return
      }
      if (event === 'task-failed') {
        fail(msg?.header?.error_message || msg?.header?.message || '阿里云百炼 ASR 任务失败')
      }
    } catch {}
  })

  ws.on('error', (err) => {
    pending.length = 0
    fail(err.message)
  })

  ws.on('close', () => {
    pending.length = 0
    closed = true
    onClose?.()
  })

  return {
    sendAudio(pcmBuffer) {
      if (!pcmBuffer?.length) return
      if (!taskStarted || ws.readyState !== WebSocket.OPEN) {
        if (pending.length < MAX_PENDING_CHUNKS) pending.push(Buffer.from(pcmBuffer))
        return
      }
      try { ws.send(pcmBuffer) } catch {}
    },
    flush() {
      if (ws.readyState !== WebSocket.OPEN) return
      try {
        ws.send(JSON.stringify({
          header: { action: 'finish-task', task_id: taskId, streaming: 'duplex' },
          payload: { input: {} },
        }))
      } catch {}
    },
    close() {
      closed = true
      try { ws.close() } catch {}
    },
  }
}
