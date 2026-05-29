import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import OpenAI from 'openai'
import { getDB } from '../db.js'
import { paths } from '../paths.js'
import { nowTimestamp } from '../time.js'
import { config, getSkillImageVisionCredentials } from '../config.js'

let schemaReady = false

function ensureSchema() {
  if (schemaReady) return
  const db = getDB()
  db.exec(`
    CREATE TABLE IF NOT EXISTS wechat_group_media_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      group_id TEXT NOT NULL,
      group_name TEXT NOT NULL DEFAULT '',
      sender_id TEXT NOT NULL DEFAULT '',
      sender_name TEXT NOT NULL DEFAULT '',
      message_type TEXT NOT NULL DEFAULT '',
      relative_path TEXT NOT NULL DEFAULT '',
      file_name TEXT NOT NULL DEFAULT '',
      mime_type TEXT NOT NULL DEFAULT '',
      bytes INTEGER NOT NULL DEFAULT 0,
      sha256 TEXT NOT NULL,
      base64 TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '',
      labels_json TEXT NOT NULL DEFAULT '[]',
      vision_status TEXT NOT NULL DEFAULT 'pending',
      vision_provider TEXT NOT NULL DEFAULT '',
      vision_model TEXT NOT NULL DEFAULT '',
      vision_error TEXT NOT NULL DEFAULT '',
      source_text TEXT NOT NULL DEFAULT '',
      described_at TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(group_id, sha256)
    );
    CREATE INDEX IF NOT EXISTS idx_wg_media_group_time ON wechat_group_media_items(group_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_wg_media_status ON wechat_group_media_items(vision_status, updated_at);
  `)
  schemaReady = true
}

function normalizeText(value = '') {
  return String(value || '').replace(/\s+/g, ' ').trim()
}

function normalizeSearchText(value = '') {
  try {
    return normalizeText(value)
      .normalize('NFKD')
      .replace(/\p{Mark}/gu, '')
      .toLowerCase()
  } catch {
    return normalizeText(value).toLowerCase()
  }
}

function compactSearchText(value = '') {
  return normalizeSearchText(value).replace(/[\s\p{P}\p{S}_-]+/gu, '')
}

function inferMimeType(filePath = '', fallback = '') {
  const value = String(fallback || '').toLowerCase()
  if (value.startsWith('image/')) return value
  switch (path.extname(String(filePath || '').toLowerCase())) {
    case '.jpg':
    case '.jpeg': return 'image/jpeg'
    case '.gif': return 'image/gif'
    case '.webp': return 'image/webp'
    case '.bmp': return 'image/bmp'
    case '.png':
    default: return 'image/png'
  }
}

function isImageMime(mime = '') {
  return /^image\/(?:png|jpe?g|webp|gif|bmp)$/iu.test(String(mime || ''))
}

export function isVisionCapableModel(model = '') {
  const value = String(model || '').toLowerCase()
  if (!value) return false
  if (/gpt-image|dall-e|embedding|whisper|tts|deepseek|m2\.7|moonshot-v1|glm-4-flash/u.test(value)) return false
  return /gpt-4o|gpt-4\.1|gpt-5|o3|o4|vision|vl|qwen.*vl|gemini|claude-3|pixtral|llava/u.test(value)
}

function resolveVisionRuntime(cfg = getSkillImageVisionCredentials()) {
  if (cfg.preferCurrentMultimodal && isVisionCapableModel(config.model) && config.apiKey && config.baseURL) {
    return { provider: config.provider || 'current', model: config.model, apiKey: config.apiKey, baseURL: config.baseURL, source: 'current' }
  }
  const profile = (config.llmProfiles || []).find(item => item?.enabled !== false && item?.apiKey && item?.baseURL && isVisionCapableModel(item.model))
  if (profile) {
    return { provider: profile.provider || 'profile', model: profile.model, apiKey: profile.apiKey, baseURL: profile.baseURL, source: 'llm_profile' }
  }
  if (cfg.apiKey && cfg.baseUrl && cfg.model) {
    return { provider: 'vision', model: cfg.model, apiKey: cfg.apiKey, baseURL: cfg.baseUrl, source: 'fallback_gpt' }
  }
  return null
}

function extractLabels(description = '') {
  const text = normalizeText(description)
  const match = text.match(/(?:关键标签|标签)[:：]\s*([\s\S]*?)(?:如果图中|文字摘录|$)/u)
  if (!match) return []
  return match[1].replace(/[。；;]+$/u, '').split(/[，,、/ ]+/u).map(v => v.trim()).filter(Boolean).slice(0, 16)
}

function safeRelativePath(rel = '') {
  const value = String(rel || '').trim().replace(/\\/g, '/')
  if (!value || value.includes('\0') || value.startsWith('/') || value.split('/').includes('..')) return ''
  return value
}

function extractStoredMediaPaths(text = '') {
  const rows = []
  for (const match of String(text || '').matchAll(/\[媒体文件\]\s+([^\n\r]+)/gu)) {
    const rel = safeRelativePath(match[1] || '')
    if (rel) rows.push(rel)
  }
  return [...new Set(rows)]
}

export function upsertWeChatImageMediaItem({ groupId = '', groupName = '', senderId = '', senderName = '', mediaInfo = {}, sourceText = '', messageType = '' } = {}) {
  ensureSchema()
  const filePath = String(mediaInfo.filePath || '').trim()
  const relativePath = safeRelativePath(mediaInfo.relativePath || '')
  if (!filePath || !relativePath || !fs.existsSync(filePath)) return { ok: false, skipped: true, reason: 'missing_file' }
  const stat = fs.statSync(filePath)
  if (!stat.isFile()) return { ok: false, skipped: true, reason: 'not_file' }
  const mimeType = inferMimeType(filePath, mediaInfo.contentType || mediaInfo.type || '')
  if (!isImageMime(mimeType)) return { ok: false, skipped: true, reason: 'not_image', mimeType }
  const buffer = fs.readFileSync(filePath)
  const sha256 = crypto.createHash('sha256').update(buffer).digest('hex')
  const cfg = getSkillImageVisionCredentials()
  const maxBytes = Math.max(Number(cfg.maxImageBytesMB || 8), 1) * 1024 * 1024
  const base64 = buffer.length <= maxBytes ? buffer.toString('base64') : ''
  const now = nowTimestamp()
  const db = getDB()
  db.prepare(`
    INSERT INTO wechat_group_media_items (
      group_id, group_name, sender_id, sender_name, message_type, relative_path, file_name, mime_type, bytes, sha256, base64, source_text, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(group_id, sha256) DO UPDATE SET
      group_name = CASE WHEN excluded.group_name <> '' THEN excluded.group_name ELSE wechat_group_media_items.group_name END,
      sender_id = CASE WHEN excluded.sender_id <> '' THEN excluded.sender_id ELSE wechat_group_media_items.sender_id END,
      sender_name = CASE WHEN excluded.sender_name <> '' THEN excluded.sender_name ELSE wechat_group_media_items.sender_name END,
      message_type = CASE WHEN excluded.message_type <> '' THEN excluded.message_type ELSE wechat_group_media_items.message_type END,
      relative_path = CASE WHEN excluded.relative_path <> '' THEN excluded.relative_path ELSE wechat_group_media_items.relative_path END,
      file_name = CASE WHEN excluded.file_name <> '' THEN excluded.file_name ELSE wechat_group_media_items.file_name END,
      mime_type = CASE WHEN excluded.mime_type <> '' THEN excluded.mime_type ELSE wechat_group_media_items.mime_type END,
      bytes = CASE WHEN excluded.bytes > 0 THEN excluded.bytes ELSE wechat_group_media_items.bytes END,
      base64 = CASE WHEN excluded.base64 <> '' THEN excluded.base64 ELSE wechat_group_media_items.base64 END,
      source_text = CASE WHEN excluded.source_text <> '' THEN excluded.source_text ELSE wechat_group_media_items.source_text END,
      updated_at = excluded.updated_at
  `).run(
    String(groupId || ''),
    String(groupName || ''),
    String(senderId || ''),
    String(senderName || ''),
    String(messageType || ''),
    relativePath,
    path.basename(filePath),
    mimeType,
    buffer.length,
    sha256,
    base64,
    String(sourceText || '').slice(0, 2000),
    now,
    now,
  )
  const row = db.prepare(`SELECT * FROM wechat_group_media_items WHERE group_id = ? AND sha256 = ?`).get(String(groupId || ''), sha256)
  return { ok: true, id: row?.id, item: row, storedBase64: !!base64, bytes: buffer.length, mimeType }
}

async function callVisionModel(row, runtime, cfg) {
  const base64 = row.base64 || (() => {
    const filePath = path.join(paths.userDir, row.relative_path || '')
    return fs.existsSync(filePath) ? fs.readFileSync(filePath).toString('base64') : ''
  })()
  if (!base64) throw new Error('图片超过保存上限或文件不存在，无法转 base64 给识图模型')
  const client = new OpenAI({ apiKey: runtime.apiKey, baseURL: runtime.baseURL, timeout: Number(cfg.apiTimeoutSeconds || 45) * 1000 })
  const res = await client.chat.completions.create({
    model: runtime.model,
    temperature: 0.1,
    max_tokens: 420,
    messages: [
      {
        role: 'system',
        content: '你是微信群图片识别器。只描述图片可见内容，不要编造来源、人物身份或隐私。输出中文，适合后续让普通文本模型理解这张图。',
      },
      {
        role: 'user',
        content: [
          { type: 'text', text: '请识别这张微信群图片，输出三段：内容描述、关键标签、如果图中有文字请摘录。保持简洁但信息完整。' },
          { type: 'image_url', image_url: { url: `data:${row.mime_type || 'image/png'};base64,${base64}` } },
        ],
      },
    ],
  })
  return normalizeText(res?.choices?.[0]?.message?.content || '')
}

export async function describeWeChatImageMedia({ mediaId, force = false } = {}) {
  ensureSchema()
  const db = getDB()
  const row = db.prepare(`SELECT * FROM wechat_group_media_items WHERE id = ?`).get(mediaId)
  if (!row) return { ok: false, error: 'media not found' }
  if (row.description && !force) return { ok: true, skipped: true, description: row.description, item: row }
  const cfg = getSkillImageVisionCredentials()
  if (cfg.enabled === false || cfg.autoDescribe === false) {
    db.prepare(`UPDATE wechat_group_media_items SET vision_status='disabled', updated_at=? WHERE id=?`).run(nowTimestamp(), mediaId)
    return { ok: false, skipped: true, error: '识图功能未启用' }
  }
  const runtime = resolveVisionRuntime(cfg)
  if (!runtime) {
    db.prepare(`UPDATE wechat_group_media_items SET vision_status='no_model', vision_error=?, updated_at=? WHERE id=?`).run('未配置可用的多模态/GPT识图模型', nowTimestamp(), mediaId)
    return { ok: false, error: '未配置可用的多模态/GPT识图模型' }
  }
  try {
    db.prepare(`UPDATE wechat_group_media_items SET vision_status='running', vision_provider=?, vision_model=?, updated_at=? WHERE id=?`).run(runtime.provider, runtime.model, nowTimestamp(), mediaId)
    const description = await callVisionModel(row, runtime, cfg)
    if (!description) throw new Error('识图模型返回空内容')
    const labels = extractLabels(description)
    db.prepare(`
      UPDATE wechat_group_media_items
      SET description=?, labels_json=?, vision_status='done', vision_provider=?, vision_model=?, vision_error='', described_at=?, updated_at=?
      WHERE id=?
    `).run(description, JSON.stringify(labels), runtime.provider, runtime.model, nowTimestamp(), nowTimestamp(), mediaId)
    return { ok: true, id: mediaId, description, labels, provider: runtime.provider, model: runtime.model }
  } catch (err) {
    const message = err?.message || String(err)
    db.prepare(`UPDATE wechat_group_media_items SET vision_status='error', vision_error=?, updated_at=? WHERE id=?`).run(message.slice(0, 1000), nowTimestamp(), mediaId)
    return { ok: false, error: message }
  }
}

export async function maybeDescribeWeChatImageMedia({ mediaItem, wait = false } = {}) {
  if (!mediaItem?.id) return { ok: false, skipped: true, reason: 'missing_media' }
  const task = describeWeChatImageMedia({ mediaId: mediaItem.id })
  if (wait) return await task
  task.catch(err => console.warn(`[WechatImageVision] 图片识别失败：${err?.message || err}`))
  return { ok: true, scheduled: true, id: mediaItem.id }
}

export async function backfillWeChatImageMediaFromActivity({ groupId = '', groupName = '', limit = 200, describe = false } = {}) {
  ensureSchema()
  const db = getDB()
  const filters = [`(raw_text LIKE '%[媒体文件]%' OR display_text LIKE '%[媒体文件]%')`]
  const params = []
  if (groupId) { filters.push('group_id = ?'); params.push(String(groupId)) }
  if (groupName) { filters.push('group_name = ?'); params.push(String(groupName)) }
  const rows = db.prepare(`
    SELECT id, group_id, group_name, sender_id, sender_name, message_type, raw_text, display_text, timestamp
    FROM wechat_group_activity
    WHERE ${filters.join(' AND ')}
    ORDER BY id DESC
    LIMIT ?
  `).all(...params, Math.min(Math.max(Number(limit || 200), 1), 2000))
  let scanned = 0
  let imported = 0
  let described = 0
  const errors = []
  for (const row of rows) {
    const rels = extractStoredMediaPaths(`${row.raw_text || ''}\n${row.display_text || ''}`)
    for (const rel of rels) {
      scanned += 1
      const filePath = path.join(paths.userDir, rel)
      try {
        const result = upsertWeChatImageMediaItem({
          groupId: row.group_id,
          groupName: row.group_name,
          senderId: row.sender_id,
          senderName: row.sender_name,
          messageType: row.message_type,
          sourceText: row.display_text || row.raw_text || '',
          mediaInfo: { filePath, relativePath: rel, type: inferMimeType(filePath) },
        })
        if (result?.ok) {
          imported += 1
          if (describe && result.item?.id) {
            const desc = await describeWeChatImageMedia({ mediaId: result.item.id })
            if (desc?.ok || desc?.skipped) described += 1
            else if (desc?.error) errors.push(`${rel}: ${desc.error}`)
          }
        }
      } catch (err) {
        errors.push(`${rel}: ${err?.message || err}`)
      }
    }
  }
  return { ok: errors.length === 0, scanned, imported, described, errors: errors.slice(0, 20) }
}

export function getWeChatImageMemoryContext({ groupId = '', limit = 12, query = '' } = {}) {
  ensureSchema()
  const gid = String(groupId || '').trim()
  if (!gid) return ''
  const q = normalizeText(query)
  const db = getDB()
  let rows = []
  if (q) {
    rows = db.prepare(`
      SELECT * FROM wechat_group_media_items
      WHERE group_id = ? AND description <> '' AND (description LIKE ? OR source_text LIKE ? OR sender_name LIKE ?)
      ORDER BY described_at DESC, id DESC
      LIMIT ?
    `).all(gid, `%${q.slice(0, 80)}%`, `%${q.slice(0, 80)}%`, `%${q.slice(0, 80)}%`, Math.min(Math.max(Number(limit || 12), 1), 30))
  }
  if (!rows.length) {
    rows = db.prepare(`
      SELECT * FROM wechat_group_media_items
      WHERE group_id = ? AND description <> ''
      ORDER BY described_at DESC, id DESC
      LIMIT ?
    `).all(gid, Math.min(Math.max(Number(limit || 12), 1), 30))
  }
  if (!rows.length) return '<wechat-image-memory>当前群暂无已识别图片。</wechat-image-memory>'
  const lines = rows.map(row => {
    const ts = String(row.described_at || row.created_at || '').slice(0, 16)
    return `- ${ts} ${row.sender_name || row.sender_id || '群成员'} 发图：${row.description}`
  })
  return `<wechat-image-memory source="local-image-vision">\n${lines.join('\n')}\n</wechat-image-memory>`
}

function extractImageSearchTerms(text = '') {
  const cleaned = normalizeText(text)
    .replace(/^[@＠][^\s\u2005\u2006\u2007\u2008\u2009\u200a，,：:、]{1,40}/u, ' ')
    .replace(/(?:发|发送|转发|传|给我|发我|拿给我|那张|这张|刚才|刚刚|上面|前面|原图|图片|图|照片|引用|一下|吧|啊|呀|哈|的)/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  const tokens = []
  for (const match of cleaned.matchAll(/[\u4e00-\u9fa5A-Za-z0-9]{2,18}/gu)) {
    const token = match[0]
    if (/^(给我|发送|那张|这张|图片|照片|引用|前夜)$/u.test(token)) continue
    tokens.push(token)
  }
  return [...new Set(tokens)].slice(0, 8)
}

function expandImageSearchTerms(terms = [], query = '') {
  const all = new Set((terms || []).map(v => String(v || '').trim()).filter(Boolean))
  const raw = `${query || ''} ${(terms || []).join(' ')}`
  const norm = normalizeSearchText(raw)
  const compact = compactSearchText(raw)

  // 识图模型经常把 NewAPI 识别成 “New API”；用户一般会连续写成 newapi。
  // 搜索时两个写法必须视为同一个词，否则“给我那张 newapi 图”会找不到。
  if (compact.includes('newapi') || /new\s*api/u.test(norm)) {
    all.add('newapi')
    all.add('new api')
    all.add('new-api')
  }

  // 微信群里常用外号，不一定等于 Wechaty 采到的花体昵称。
  // 先内置当前已出现的“力佬/大力/Dali”别名，后续可再接到成员别名管理。
  if (/力佬|大力/u.test(raw) || compact.includes('dali') || compact.includes('dafi')) {
    all.add('力佬')
    all.add('大力')
    all.add('dali')
    all.add('dafi')
  }

  return [...all].slice(0, 14)
}

function scoreImageSearchTerm({ hay = '', hayCompact = '', term = '', row = {} } = {}) {
  const rawTerm = String(term || '').trim()
  if (!rawTerm) return 0
  const t = normalizeSearchText(rawTerm)
  const tc = compactSearchText(rawTerm)
  if (!t && !tc) return 0
  let score = 0
  const weight = Math.max(2, Math.min(8, (tc || t).length))
  if (hay.includes(t)) score += weight
  if (tc && tc !== t && hay.includes(tc)) score += weight
  if (tc && hayCompact.includes(tc)) score += weight + (tc.length >= 4 ? 2 : 0)

  const senderHay = normalizeSearchText(`${row.sender_name || ''} ${row.sender_id || ''}`)
  const senderCompact = compactSearchText(`${row.sender_name || ''} ${row.sender_id || ''}`)
  if (senderHay.includes(t) || (tc && senderCompact.includes(tc))) score += 6
  return score
}

export function findWeChatImageMediaForRequest({ groupId = '', groupName = '', query = '', limit = 8 } = {}) {
  ensureSchema()
  const db = getDB()
  const gid = String(groupId || '').trim()
  const name = String(groupName || '').trim()
  const filters = [`relative_path <> ''`]
  const params = []
  if (gid || name) {
    const sub = []
    if (gid) { sub.push('group_id = ?'); params.push(gid) }
    if (name) { sub.push('group_name = ?'); params.push(name) }
    filters.push(`(${sub.join(' OR ')})`)
  }
  const rows = db.prepare(`
    SELECT * FROM wechat_group_media_items
    WHERE ${filters.join(' AND ')}
    ORDER BY described_at DESC, id DESC
    LIMIT 120
  `).all(...params)
  const terms = expandImageSearchTerms(extractImageSearchTerms(query), query)
  const queryNorm = normalizeSearchText(query)
  const queryCompact = compactSearchText(query)
  const scored = rows.map(row => {
    const hayText = [
      row.description || '',
      row.source_text || '',
      row.sender_name || '',
      row.sender_id || '',
      row.file_name || '',
    ].join(' ')
    const hay = normalizeSearchText(hayText)
    const hayCompact = compactSearchText(hayText)
    let score = 0
    for (const term of terms) {
      score += scoreImageSearchTerm({ hay, hayCompact, term, row })
    }
    if (/山水|水墨|国画|山水画/u.test(query) && /山水|水墨|国画|群山|云雾|瀑布/u.test(row.description || '')) score += 10
    if (/截图|报错|错误|502|hermes|Hermes/u.test(query) && /截图|报错|错误|502|Hermes|hermes|provider|重试/u.test(row.description || '')) score += 10
    if ((queryCompact.includes('newapi') || /new\s*api/u.test(queryNorm)) && /new\s*api|newapi/u.test(hay)) score += 10
    if (/力佬|大力/u.test(query) && (/大力/u.test(row.description || '') || compactSearchText(row.sender_name || '').includes('dali'))) score += 8
    if (!row.description && /(?:刚才|刚刚|上面|前面|最近|他发|她发|发的)/u.test(query)) score += 1
    return { row, score }
  }).filter(item => item.score > 0 || terms.length === 0)
    .sort((a, b) => b.score - a.score || Number(b.row.id || 0) - Number(a.row.id || 0))
    .slice(0, Math.min(Math.max(Number(limit || 8), 1), 30))
  return { ok: true, terms, items: scored.map(item => ({ ...item.row, _score: item.score })) }
}

export function resolveWeChatImageMediaFile(row = {}) {
  const rel = safeRelativePath(row.relative_path || '')
  if (!rel) return { ok: false, error: 'invalid media path' }
  const root = path.resolve(paths.userDir)
  const filePath = path.resolve(root, rel)
  const diff = path.relative(root, filePath)
  if (!diff || diff.startsWith('..') || path.isAbsolute(diff)) return { ok: false, error: 'invalid media path' }
  try {
    const stat = fs.statSync(filePath)
    if (!stat.isFile()) return { ok: false, error: 'media file not found' }
    if (!isImageMime(inferMimeType(filePath, row.mime_type))) return { ok: false, error: 'not image' }
    return { ok: true, filePath, bytes: stat.size, mimeType: inferMimeType(filePath, row.mime_type), relativePath: rel }
  } catch {
    return { ok: false, error: 'media file not found' }
  }
}

export function getWeChatImageVisionStatus() {
  ensureSchema()
  const db = getDB()
  const cfg = getSkillImageVisionCredentials()
  const runtime = resolveVisionRuntime(cfg)
  const scalar = sql => {
    try { return Number(Object.values(db.prepare(sql).get() || {})[0] || 0) } catch { return 0 }
  }
  return {
    enabled: cfg.enabled !== false,
    autoDescribe: cfg.autoDescribe !== false,
    configured: !!runtime,
    runtime: runtime ? { provider: runtime.provider, model: runtime.model, baseURL: runtime.baseURL, source: runtime.source } : null,
    counts: {
      total: scalar('SELECT COUNT(*) FROM wechat_group_media_items'),
      described: scalar("SELECT COUNT(*) FROM wechat_group_media_items WHERE description <> ''"),
      pending: scalar("SELECT COUNT(*) FROM wechat_group_media_items WHERE vision_status IN ('pending','running','error','no_model') AND description = ''"),
      base64: scalar("SELECT COUNT(*) FROM wechat_group_media_items WHERE base64 <> ''"),
    },
  }
}

export async function testWeChatImageVision({ imagePath = '' } = {}) {
  const filePath = imagePath || path.join(paths.dataDir, 'generated-images')
  return getWeChatImageVisionStatus()
}
