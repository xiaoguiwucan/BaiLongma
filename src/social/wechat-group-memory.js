import { Honcho } from '@honcho-ai/sdk'
import { nowTimestamp } from '../time.js'
import { getHonchoConfig } from '../config.js'
import { extractWeChatGroupId } from './wechat-groups.js'
import { extractWeChatExplicitMemories } from './wechat-memory-extractor.js'
import { getDB, updateMemoryEmbedding } from '../db.js'

let client = null
let cachedKey = ''
let cachedBaseURL = ''
let cachedEnv = ''
let appIdCache = ''
const userCache = new Map()
const sessionCache = new Map()

let honchoDisabledUntil = 0
let honchoLastError = ''

function isHonchoTemporarilyDisabled() {
  return honchoDisabledUntil && Date.now() < honchoDisabledUntil
}

function markHonchoUnavailable(err, source = 'honcho') {
  const message = err?.message || String(err || 'unknown error')
  honchoLastError = message
  honchoDisabledUntil = Date.now() + 60_000
  client = null
  userCache.clear()
  sessionCache.clear()
  console.warn(`[Honcho] ${source} 暂不可用，60 秒内降级跳过：${message}`)
}

function honchoUnavailableResult(extra = {}) {
  return { ok: false, provider: 'honcho', skipped: true, degraded: true, error: honchoLastError || 'Honcho 暂不可用', ...extra }
}

const ASSISTANT_PEER_ID = 'bailongma_assistant'

const GROUP_SESSION_CONFIGURATION = {
  reasoning: { enabled: true },
  peerCard: { use: true, create: true },
  summary: { enabled: true, messagesPerShortSummary: 10, messagesPerLongSummary: 30 },
  dream: { enabled: true },
}

function normalizeText(text = '') {
  return String(text || '').replace(/\s+/g, ' ').trim()
}

function isInternalToolProtocolText(text = '') {
  return /I did not actually call the required tool|cannot claim the operation completed|execute the tool first|required tool/i.test(String(text || ''))
}

function normalizeMemoryDisplayText(text = '') {
  const value = normalizeText(text)
  if (!value) return ''
  if (isInternalToolProtocolText(value)) return '[历史内部协议误回复，已在 v0.4.1 隐藏；未来不会再发到群里]'
  if (/<msg[\s\S]{0,800}<emoji|<emoji\b|cdnurl=|emoji[^>]{0,120}(?:md5|len|aeskey)/iu.test(value)) return '[表情]'
  if (/<img\b|<image\b|cdnthumburl=|cdnmidimgurl=/iu.test(value)) return '[图片]'
  if (/^<appmsg\b|<weappinfo\b|小程序/u.test(value)) return '[小程序/链接]'
  if ((/^<\?xml|^<msg\b|^<sysmsg\b/iu.test(value)) && value.length > 80) return '[微信结构化消息]'
  return value.slice(0, 2400)
}

function safeIdPart(value = '') {
  return String(value || '').replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 80) || 'unknown'
}

function groupKey(groupId = '') {
  const raw = extractWeChatGroupId(groupId)
  return normalizeText(raw) || normalizeText(groupId)
}

function groupPeerIdFor(gid = '') {
  return `wechat_group_${safeIdPart(gid)}`
}

function memberPeerIdFor(senderId = '', senderName = '') {
  return `wechat_member_${safeIdPart(senderId || senderName)}`
}

function sessionIdFor(gid = '') {
  return `wechat_group_${safeIdPart(gid)}`
}


let localSchemaReady = false

function ensureLocalMemorySchema() {
  if (localSchemaReady) return
  const db = getDB()
  db.exec(`
    CREATE TABLE IF NOT EXISTS wechat_group_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      group_id TEXT NOT NULL,
      group_external_id TEXT NOT NULL,
      group_name TEXT NOT NULL DEFAULT '',
      member_id TEXT NOT NULL DEFAULT '',
      member_name TEXT NOT NULL DEFAULT '',
      content TEXT NOT NULL,
      mentioned_self INTEGER NOT NULL DEFAULT 0,
      source TEXT NOT NULL DEFAULT 'wechaty',
      timestamp TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_wgm_group_ts ON wechat_group_messages(group_id, timestamp);
    CREATE INDEX IF NOT EXISTS idx_wgm_member_ts ON wechat_group_messages(group_id, member_id, timestamp);

    CREATE TABLE IF NOT EXISTS wechat_group_memory_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      group_id TEXT NOT NULL,
      group_external_id TEXT NOT NULL,
      group_name TEXT NOT NULL DEFAULT '',
      member_id TEXT NOT NULL DEFAULT '',
      member_name TEXT NOT NULL DEFAULT '',
      category TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      salience INTEGER NOT NULL DEFAULT 3,
      source_message_id INTEGER,
      source_text TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_wgmi_group_member ON wechat_group_memory_items(group_id, member_id, status, updated_at);
    CREATE INDEX IF NOT EXISTS idx_wgmi_group_category ON wechat_group_memory_items(group_id, category, status, updated_at);
  `)
  try { db.exec(`ALTER TABLE wechat_group_messages ADD COLUMN embedding BLOB`) } catch {}
  try { db.exec(`ALTER TABLE wechat_group_messages ADD COLUMN honcho_synced_at TEXT NOT NULL DEFAULT ''`) } catch {}
  try { db.exec(`ALTER TABLE wechat_group_messages ADD COLUMN honcho_message_id TEXT NOT NULL DEFAULT ''`) } catch {}
  try { db.exec(`ALTER TABLE wechat_group_memory_items ADD COLUMN embedding BLOB`) } catch {}
  try { db.exec(`CREATE INDEX IF NOT EXISTS idx_wgm_group_text ON wechat_group_messages(group_id, content)`) } catch {}
  localSchemaReady = true
}

function localExternalGroupId(gid = '') { return `wechat:group:${safeIdPart(gid)}` }


function localHashEmbeddingBuffer(text = '') {
  const dims = 384
  const vec = new Float32Array(dims)
  const value = normalizeText(text).toLowerCase()
  for (let i = 0; i < value.length; i++) {
    const gram = value.slice(i, i + 2)
    let h = 2166136261
    for (let j = 0; j < gram.length; j++) { h ^= gram.charCodeAt(j); h = Math.imul(h, 16777619) }
    vec[Math.abs(h) % dims] += 1
  }
  let norm = 0
  for (const n of vec) norm += n * n
  norm = Math.sqrt(norm) || 1
  for (let i = 0; i < vec.length; i++) vec[i] = vec[i] / norm
  return Buffer.from(vec.buffer)
}

function writeLocalEmbedding(table, id, text) {
  const body = normalizeText(text)
  if (!body || !id) return
  ;(async () => {
    try {
      let buffer = null
      try {
        const { computeEmbedding, isEmbeddingConfigured } = await import('../embedding.js')
        if (isEmbeddingConfigured()) buffer = await computeEmbedding(body)
      } catch {}
      if (!buffer) buffer = localHashEmbeddingBuffer(body)
      const db = getDB()
      db.prepare(`UPDATE ${table} SET embedding = ? WHERE id = ?`).run(buffer, id)
    } catch {}
  })()
}

function localRecordGroupMessage({ groupId, groupName = '', senderId = '', senderName = '', text = '', mentionedSelf = false, source = 'wechaty', timestamp = nowTimestamp() } = {}) {
  const content = normalizeMemoryDisplayText(text)
  const gid = groupKey(groupId)
  if (!gid || !content) return { ok: false, provider: 'local', skipped: true, reason: 'empty_group_or_content' }
  ensureLocalMemorySchema()
  const db = getDB()
  const info = db.prepare(`
    INSERT INTO wechat_group_messages (group_id, group_external_id, group_name, member_id, member_name, content, mentioned_self, source, timestamp, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(gid, localExternalGroupId(gid), groupName, senderId || senderName, senderName, content, mentionedSelf ? 1 : 0, source, timestamp, nowTimestamp())
  writeLocalEmbedding('wechat_group_messages', info.lastInsertRowid, `${groupName} ${senderName}: ${content}`)
  return { ok: true, provider: 'local', id: info.lastInsertRowid, group_id: gid }
}

function localCreateMemory({ groupId, groupName = '', content = '', category = 'manual', senderId = '', senderName = '', sourceText = '', salience = 3 } = {}) {
  const body = normalizeMemoryDisplayText(content)
  const gid = groupKey(groupId)
  if (!gid || !body) return { ok: false, provider: 'local', error: '本地记忆内容为空' }
  ensureLocalMemorySchema()
  const db = getDB()
  const now = nowTimestamp()
  const title = body.slice(0, 48)
  const existing = db.prepare(`
    SELECT id, category, title, content, member_id, member_name, created_at, updated_at
    FROM wechat_group_memory_items
    WHERE group_id = ? AND COALESCE(member_id,'') = ? AND COALESCE(member_name,'') = ? AND category = ? AND content = ? AND status='active'
    LIMIT 1
  `).get(gid, senderId || senderName || '', senderName || '', category, body)
  if (existing) {
    return { ok: true, provider: 'local', deduped: true, group_id: gid, items: [{ id: String(existing.id), kind: 'conclusion', scope: senderId || senderName ? 'member' : 'group', category: existing.category, title: existing.title, content: existing.content, speaker: existing.member_name || groupName, createdAt: existing.created_at, updatedAt: existing.updated_at }] }
  }
  const info = db.prepare(`
    INSERT INTO wechat_group_memory_items (group_id, group_external_id, group_name, member_id, member_name, category, title, content, status, salience, source_text, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?)
  `).run(gid, localExternalGroupId(gid), groupName, senderId || senderName, senderName, category, title, body, Number(salience || 3), sourceText || '', now, now)
  writeLocalEmbedding('wechat_group_memory_items', info.lastInsertRowid, `${groupName} ${senderName} ${category}: ${body}`)
  return { ok: true, provider: 'local', group_id: gid, items: [{ id: String(info.lastInsertRowid), kind: 'conclusion', scope: senderId || senderName ? 'member' : 'group', category, title, content: body, speaker: senderName || groupName, createdAt: now, updatedAt: now }] }
}

function cosineSimilarityBuffer(a, b) {
  try {
    const fa = new Float32Array(a.buffer, a.byteOffset, Math.floor(a.byteLength / 4))
    const fb = new Float32Array(b.buffer, b.byteOffset, Math.floor(b.byteLength / 4))
    const n = Math.min(fa.length, fb.length)
    if (!n) return 0
    let dot = 0, na = 0, nb = 0
    for (let i = 0; i < n; i++) { dot += fa[i] * fb[i]; na += fa[i] * fa[i]; nb += fb[i] * fb[i] }
    return dot / (Math.sqrt(na) * Math.sqrt(nb) || 1)
  } catch { return 0 }
}

async function localSemanticRows({ table, groupId, query, limit = 8 }) {
  const gid = groupKey(groupId)
  const q = normalizeText(query)
  if (!gid || !q) return []
  try {
    let qbuf = null
    try {
      const { computeEmbedding, isEmbeddingConfigured } = await import('../embedding.js')
      if (isEmbeddingConfigured()) qbuf = await computeEmbedding(q)
    } catch {}
    if (!qbuf) qbuf = localHashEmbeddingBuffer(q)
    const rows = getDB().prepare(`SELECT * FROM ${table} WHERE group_id = ? AND embedding IS NOT NULL ORDER BY id DESC LIMIT 1200`).all(gid)
    return rows.map(row => ({ ...row, _score: cosineSimilarityBuffer(qbuf, row.embedding) }))
      .filter(row => row._score > 0.12)
      .sort((a, b) => b._score - a._score)
      .slice(0, limit)
  } catch { return [] }
}

async function getLocalGroupMemoryContext({ groupId, senderId = '', senderName = '', query = '', limit = 16 } = {}) {
  const gid = groupKey(groupId)
  if (!gid) return ''
  ensureLocalMemorySchema()
  const db = getDB()
  const q = normalizeText(query)
  const like = q ? `%${q.slice(0, 80)}%` : ''
  let memories = []
  if (like) {
    memories = db.prepare(`
      SELECT * FROM wechat_group_memory_items
      WHERE group_id = ? AND status='active' AND (member_id IN ('', ?) OR member_name IN ('', ?) OR member_id = ? OR member_name = ?) AND content LIKE ?
      ORDER BY salience DESC, updated_at DESC LIMIT ?
    `).all(gid, senderId || senderName, senderName, senderId || senderName, senderName, like, Math.min(limit, 20))
  }
  if (!memories.length) {
    memories = db.prepare(`
      SELECT * FROM wechat_group_memory_items
      WHERE group_id = ? AND status='active' AND (member_id IN ('', ?) OR member_name IN ('', ?) OR member_id = ? OR member_name = ?)
      ORDER BY salience DESC, updated_at DESC LIMIT ?
    `).all(gid, senderId || senderName, senderName, senderId || senderName, senderName, Math.min(limit, 20))
  }
  const semanticMemories = await localSemanticRows({ table: 'wechat_group_memory_items', groupId: gid, query: q, limit: 6 })
  const semanticMessages = await localSemanticRows({ table: 'wechat_group_messages', groupId: gid, query: q, limit: 8 })
  const recentMessages = db.prepare(`
    SELECT * FROM wechat_group_messages WHERE group_id = ? ORDER BY timestamp DESC, id DESC LIMIT ?
  `).all(gid, Math.min(limit, 30))
  const memoryLines = [...new Map([...semanticMemories, ...memories].map(row => [row.id, row])).values()]
    .slice(0, 12)
    .map(row => `- [${row.member_name || '群'}][${row.category || 'memory'}] ${row.content}`)
  const messageLines = [...new Map([...semanticMessages, ...recentMessages].map(row => [row.id, row])).values()]
    .slice(0, 16)
    .map(row => `- ${row.timestamp || row.created_at} ${row.member_name || '群成员'}：${row.content}`)
  if (!memoryLines.length && !messageLines.length) return '<local-group-memory>本地暂无本群记忆。</local-group-memory>'
  return `<local-group-memory query="${q.slice(0,120)}">
${memoryLines.length ? `<member-and-group-memories>\n${memoryLines.join('\n')}\n</member-and-group-memories>` : ''}
${messageLines.length ? `<recent-and-semantic-chat-records>\n${messageLines.join('\n')}\n</recent-and-semantic-chat-records>` : ''}
</local-group-memory>`
}

function listLocalGroupMemory({ groupId, groupName = '', limit = 80, includeAllPeers = true } = {}) {
  const gid = groupKey(groupId)
  if (!gid) return { ok: false, provider: 'local', items: [], messages: [], conclusions: [], summaries: [], error: 'missing group id' }
  ensureLocalMemorySchema()
  const db = getDB()
  const size = Math.min(Math.max(Number(limit || 80), 1), 300)
  const messages = db.prepare(`SELECT * FROM wechat_group_messages WHERE group_id = ? ORDER BY timestamp DESC, id DESC LIMIT ?`).all(gid, size)
    .map(row => ({ id: String(row.id), kind: 'message', type: 'wechat_group_message', content: row.content, speaker: row.member_name || row.member_id || '群成员', createdAt: row.timestamp || row.created_at, metadata: { sender_id: row.member_id, sender_name: row.member_name, group_id: row.group_id, group_name: row.group_name } }))
  const conclusions = db.prepare(`SELECT * FROM wechat_group_memory_items WHERE group_id = ? AND status='active' ORDER BY salience DESC, updated_at DESC LIMIT ?`).all(gid, size)
    .map(row => ({ id: String(row.id), kind: 'conclusion', scope: row.member_id || row.member_name ? 'member' : 'group', category: row.category, title: row.title, content: row.content, speaker: row.member_name || row.group_name || '群', createdAt: row.created_at, updatedAt: row.updated_at, metadata: { member_id: row.member_id, member_name: row.member_name } }))
  return { ok: true, provider: 'local', group_id: gid, group_name: groupName, items: messages, messages, conclusions, summaries: [], counts: { messages: messages.length, totalMessages: db.prepare('SELECT COUNT(*) AS n FROM wechat_group_messages WHERE group_id=?').get(gid).n, conclusions: conclusions.length, summaries: 0 }, errors: [] }
}

function messageCreatedAt(item) {
  return item?.createdAt || item?.created_at || item?.created_at_ || item?.metadata?.timestamp || ''
}

function messageSpeaker(item) {
  return item?.metadata?.sender_name || item?.metadata?.target_member_name || item?.peerId || item?.peer_id || '群成员'
}

function pageItems(page) {
  return page?.items || page?.data || (Array.isArray(page) ? page : [])
}

function pageTotal(page, rows = []) {
  return Number.isFinite(page?.total) ? page.total : rows.length
}

function normalizeMessageItem(item) {
  return {
    id: String(item?.id || ''),
    kind: 'message',
    type: String(item?.metadata?.type || 'wechat_group_message'),
    content: normalizeMemoryDisplayText(item?.content || ''),
    speaker: normalizeText(messageSpeaker(item)),
    peerId: item?.peerId || item?.peer_id || '',
    sessionId: item?.sessionId || item?.session_id || '',
    workspaceId: item?.workspaceId || item?.workspace_id || '',
    createdAt: messageCreatedAt(item),
    metadata: item?.metadata || {},
    deletable: false,
    deleteHint: 'Honcho SDK 当前不提供单条原始消息删除接口；如需清空请使用“清空本群 Honcho session”。',
  }
}

function normalizeConclusionItem(item, scope = 'group') {
  return {
    id: String(item?.id || ''),
    kind: 'conclusion',
    type: scope === 'member' ? 'member_memory' : 'group_memory',
    scope,
    content: normalizeText(item?.content || ''),
    observerId: item?.observerId || item?.observer_id || '',
    observedId: item?.observedId || item?.observed_id || '',
    sessionId: item?.sessionId || item?.session_id || '',
    createdAt: item?.createdAt || item?.created_at || '',
    deletable: true,
  }
}

function normalizeSummaryItem(summary, type = 'summary') {
  if (!summary?.content) return null
  return {
    id: String(summary.messageId || `${type}_summary`),
    kind: 'summary',
    type,
    content: normalizeText(summary.content),
    createdAt: summary.createdAt || '',
    tokenCount: summary.tokenCount || 0,
    deletable: false,
  }
}

function formatHonchoMessagesAsContext(rows = []) {
  const usable = rows
    .slice()
    .reverse()
    .map(item => {
      if (isInternalToolProtocolText(item?.content || '')) return ''
      const text = normalizeMemoryDisplayText(item?.content || '')
      if (!text) return ''
      const ts = String(messageCreatedAt(item) || '').slice(0, 16)
      const speaker = normalizeText(messageSpeaker(item))
      return `- ${ts ? `${ts} ` : ''}${speaker}：${text}`
    })
    .filter(Boolean)
  if (!usable.length) return ''
  return `<honcho-recent-group-messages source="honcho-messages">\n${usable.join('\n')}\n</honcho-recent-group-messages>`
}

function formatHonchoConclusionsAsContext(rows = []) {
  const usable = rows
    .map(item => normalizeText(item?.content || ''))
    .filter(Boolean)
    .slice(0, 20)
    .map(text => `- ${text}`)
  if (!usable.length) return ''
  return `<honcho-derived-memory source="honcho-conclusions">\n${usable.join('\n')}\n</honcho-derived-memory>`
}

function formatHonchoSummariesAsContext(summaries = []) {
  const usable = summaries
    .map(item => normalizeText(item?.content || ''))
    .filter(Boolean)
    .slice(0, 2)
    .map(text => `- ${text}`)
  if (!usable.length) return ''
  return `<honcho-session-summaries>\n${usable.join('\n')}\n</honcho-session-summaries>`
}

function getClient() {
  if (isHonchoTemporarilyDisabled()) return null
  const cfg = getHonchoConfig()
  if (!cfg.enabled || !cfg.apiKey) return null
  const key = cfg.apiKey
  const baseURL = cfg.baseURL || ''
  const env = cfg.environment || 'local'
  if (!client || key !== cachedKey || baseURL !== cachedBaseURL || env !== cachedEnv) {
    // @honcho-ai/sdk 会在 environment='local' 时强制覆盖 baseURL 为 localhost:8000。
    // 白龙马使用专用端口 8018，所以有 baseURL 时不传 environment，避免误连其它项目的 8000。
    client = new Honcho({
      apiKey: key,
      environment: baseURL ? undefined : env,
      baseURL: baseURL || undefined,
      workspaceId: cfg.workspaceId || cfg.appId || 'bailongma-wechat-memory',
      timeout: 8000,
      maxRetries: 0,
    })
    cachedKey = key
    cachedBaseURL = baseURL
    cachedEnv = env
    appIdCache = cfg.workspaceId || cfg.appId || 'bailongma-wechat-memory'
    userCache.clear()
    sessionCache.clear()
  }
  return client
}

async function ensureApp(honcho) {
  try {
    await honcho.getMetadata()
    const cfg = getHonchoConfig()
    appIdCache = cfg.workspaceId || cfg.appId || 'bailongma-wechat-memory'
    return appIdCache
  } catch (err) {
    markHonchoUnavailable(err, '连接')
    throw err
  }
}

async function ensurePeer(honcho, id, metadata = {}) {
  const key = id
  if (userCache.has(key)) return userCache.get(key)
  const peer = await honcho.peer(id, { metadata })
  userCache.set(key, peer)
  return peer
}

async function ensureSession(honcho, groupId, metadata = {}, peers = []) {
  const key = groupId
  if (sessionCache.has(key)) return sessionCache.get(key)
  const options = {
    metadata,
    configuration: GROUP_SESSION_CONFIGURATION,
  }
  const peerCount = Array.isArray(peers) ? peers.length : Object.keys(peers || {}).length
  if (peerCount > 0) options.peers = peers
  const session = await honcho.session(sessionIdFor(groupId), options)
  sessionCache.set(key, session)
  return session
}

async function scheduleDreams(honcho, session, observedPeerIds = []) {
  for (const observed of observedPeerIds.filter(Boolean)) {
    honcho.scheduleDream({ observer: ASSISTANT_PEER_ID, observed, session }).catch(() => {})
  }
}

async function collectSessionSummaries(session) {
  try {
    const summaries = await session.summaries()
    return [
      normalizeSummaryItem(summaries?.longSummary, 'long_summary'),
      normalizeSummaryItem(summaries?.shortSummary, 'short_summary'),
    ].filter(Boolean)
  } catch (err) {
    return { error: err?.message || String(err), items: [] }
  }
}

async function collectConclusions({ assistantPeer, groupPeer, memberPeer, session, limit = 40, includeAllPeers = false, extraMemberPeers = [] } = {}) {
  const rows = []
  const errors = []
  const seen = new Set()

  async function addScope(targetPeer, scope) {
    if (!targetPeer?.id || seen.has(`${scope}:${targetPeer.id}`)) return
    seen.add(`${scope}:${targetPeer.id}`)
    try {
      const page = await assistantPeer.conclusionsOf(targetPeer).list({ session, size: Math.min(Math.max(Number(limit || 40), 1), 100), reverse: true })
      rows.push(...pageItems(page).map(item => normalizeConclusionItem(item, scope)))
    } catch (err) {
      errors.push(`${targetPeer.id}: ${err?.message || err}`)
    }
  }

  await addScope(groupPeer, 'group')
  if (memberPeer) await addScope(memberPeer, 'member')
  for (const peer of extraMemberPeers || []) {
    if (!peer?.id || peer.id === memberPeer?.id || peer.id === groupPeer?.id || peer.id === ASSISTANT_PEER_ID) continue
    await addScope(peer, 'member')
  }

  if (includeAllPeers) {
    try {
      const peers = await session.peers()
      for (const peer of peers || []) {
        if (!peer?.id || peer.id === ASSISTANT_PEER_ID || peer.id === groupPeer?.id || peer.id === memberPeer?.id) continue
        await addScope(peer, 'member')
      }
    } catch (err) {
      errors.push(`peers: ${err?.message || err}`)
    }
  }

  rows.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
  return { items: rows.slice(0, Math.min(Math.max(Number(limit || 40), 1), 200)), errors }
}

async function getSessionQueueStatus(session) {
  try {
    return await session.queueStatus({ observer: ASSISTANT_PEER_ID })
  } catch {
    return null
  }
}

export function getWeChatGroupMemoryStatus() {
  const cfg = getHonchoConfig()
  return {
    provider: 'honcho',
    enabled: !!cfg.enabled,
    configured: !!cfg.apiKey,
    environment: cfg.environment || 'local',
    baseURL: cfg.baseURL || '',
    workspaceId: cfg.workspaceId || cfg.appId || appIdCache || 'bailongma-wechat-memory',
    appName: cfg.appName || 'BaiLongma WeChat Memory',
  }
}

export async function recordWeChatGroupMessage({ groupId, groupName = '', senderId = '', senderName = '', text = '', mentionedSelf = false, source = 'wechaty', timestamp = nowTimestamp() } = {}) {
  const content = normalizeText(text)
  const gid = groupKey(groupId)
  const local = localRecordGroupMessage({ groupId, groupName, senderId, senderName, text, mentionedSelf, source, timestamp })
  const honcho = getClient()
  if (!honcho || !gid || !content) return { ...local, honcho: { ok: false, skipped: true, reason: 'honcho_not_configured' } }
  try { await ensureApp(honcho) } catch (err) { return { ...local, honcho: honchoUnavailableResult({ reason: 'honcho_unavailable' }) } }
  const groupPeerId = groupPeerIdFor(gid)
  const memberPeerId = memberPeerIdFor(senderId, senderName)
  const groupPeer = await ensurePeer(honcho, groupPeerId, { type: 'wechat_group', group_id: gid, group_name: groupName })
  const memberPeer = await ensurePeer(honcho, memberPeerId, { type: 'wechat_member', sender_id: senderId, sender_name: senderName, group_id: gid, group_name: groupName })
  const assistantPeer = await ensurePeer(honcho, ASSISTANT_PEER_ID, { type: 'assistant', name: '小白龙' })
  const session = await ensureSession(honcho, gid, { type: 'wechat_group_session', group_id: gid, group_name: groupName, source }, [groupPeer, memberPeer, assistantPeer])
  const created = await session.addMessages(memberPeer.message(content, {
    metadata: { type: 'wechat_group_message', group_id: gid, group_name: groupName, sender_id: senderId, sender_name: senderName, mentioned_self: !!mentionedSelf, source, timestamp },
    createdAt: timestamp,
  }))
  scheduleDreams(honcho, session, [groupPeerId, memberPeerId])
  const honchoIds = created.map(item => item.id).filter(Boolean)
  try { if (local?.id) getDB().prepare(`UPDATE wechat_group_messages SET honcho_synced_at = ?, honcho_message_id = ? WHERE id = ?`).run(nowTimestamp(), honchoIds.join(','), local.id) } catch {}
  return { ok: true, provider: 'local+honcho', local, honcho: { ok: true, provider: 'honcho', workspaceId: appIdCache, sessionId: session.id, groupPeerId, memberPeerId, messageIds: honchoIds } }
}

export async function recordWeChatGroupAssistantReply({ groupId, groupName = '', reply = '', targetMemberName = '', source = 'wechaty', timestamp = nowTimestamp() } = {}) {
  const content = normalizeText(reply)
  const gid = groupKey(groupId)
  const honcho = getClient()
  if (!honcho || !gid || !content) return { ok: false, skipped: true, reason: 'honcho_not_configured' }
  try { await ensureApp(honcho) } catch (err) { return honchoUnavailableResult({ reason: 'honcho_unavailable' }) }
  const groupPeer = await ensurePeer(honcho, groupPeerIdFor(gid), { type: 'wechat_group', group_id: gid, group_name: groupName })
  const assistantPeer = await ensurePeer(honcho, ASSISTANT_PEER_ID, { type: 'assistant', name: '小白龙' })
  const session = await ensureSession(honcho, gid, { type: 'wechat_group_session', group_id: gid, group_name: groupName, source }, [groupPeer, assistantPeer])
  const created = await session.addMessages(assistantPeer.message(content, { metadata: { type: 'assistant_reply', group_id: gid, group_name: groupName, target_member_name: targetMemberName, source, timestamp }, createdAt: timestamp }))
  scheduleDreams(honcho, session, [groupPeer.id])
  return { ok: true, provider: 'honcho', workspaceId: appIdCache, sessionId: session.id, messageIds: created.map(item => item.id).filter(Boolean) }
}

export async function createWeChatGroupManualMemory({ groupId, groupName = '', content = '', category = 'manual', senderId = '', senderName = '' } = {}) {
  const body = normalizeText(content)
  const gid = groupKey(groupId)
  const local = localCreateMemory({ groupId, groupName, content, category, senderId, senderName })
  const honcho = getClient()
  if (!honcho || !gid) return { ...local, honcho: { ok: false, provider: 'honcho', error: 'Honcho 未配置或未启用' } }
  if (!body) return { ok: false, provider: 'local+honcho', error: '记忆内容不能为空' }
  try { await ensureApp(honcho) } catch (err) { return { ...local, honcho: honchoUnavailableResult({ error: `Honcho 暂不可用：${err?.message || err}` }) } }
  const groupPeer = await ensurePeer(honcho, groupPeerIdFor(gid), { type: 'wechat_group', group_id: gid, group_name: groupName })
  const assistantPeer = await ensurePeer(honcho, ASSISTANT_PEER_ID, { type: 'assistant', name: '小白龙' })
  const memberPeer = senderId || senderName ? await ensurePeer(honcho, memberPeerIdFor(senderId, senderName), { type: 'wechat_member', sender_id: senderId, sender_name: senderName, group_id: gid, group_name: groupName }) : null
  const session = await ensureSession(honcho, gid, { type: 'wechat_group_session', group_id: gid, group_name: groupName, source: 'manual' }, [groupPeer, assistantPeer, ...(memberPeer ? [memberPeer] : [])])
  const target = memberPeer || groupPeer
  const created = await assistantPeer.conclusionsOf(target).create({ content: body, sessionId: session })
  return {
    ok: true,
    provider: 'local+honcho',
    workspaceId: appIdCache,
    sessionId: session.id,
    group_id: gid,
    category,
    items: created.map(item => normalizeConclusionItem(item, memberPeer ? 'member' : 'group')),
    local,
  }
}

export async function recordWeChatGroupExplicitMemories({ groupId, groupName = '', senderId = '', senderName = '', text = '', source = 'wechaty' } = {}) {
  const memories = extractWeChatExplicitMemories({ text, senderName, senderId })
  if (!memories.length) return { ok: true, skipped: true, count: 0, memories: [] }
  const written = []
  const errors = []
  for (const memory of memories) {
    try {
      const memberResult = await createWeChatGroupManualMemory({
        groupId,
        groupName,
        senderId,
        senderName,
        content: memory.content,
        category: memory.category || 'explicit',
      })
      written.push({ scope: 'member', category: memory.category, result: memberResult })
    } catch (err) {
      errors.push(`member:${err?.message || err}`)
    }
    if (memory.groupContent && memory.groupContent !== memory.content) {
      try {
        const groupResult = await createWeChatGroupManualMemory({
          groupId,
          groupName,
          content: memory.groupContent,
          category: memory.category || 'explicit',
        })
        written.push({ scope: 'group', category: memory.category, result: groupResult })
      } catch (err) {
        errors.push(`group:${err?.message || err}`)
      }
    }
  }
  return { ok: errors.length === 0, source, count: written.length, memories, written, errors }
}

export async function getWeChatGroupMemoryContext({ groupId, senderId = '', senderName = '', query = '', limit = 16 } = {}) {
  const gid = groupKey(groupId)
  const honcho = getClient()
  if (!honcho || !gid) return await getLocalGroupMemoryContext({ groupId, senderId, senderName, query, limit })
  try { await ensureApp(honcho) } catch (err) { return `${await getLocalGroupMemoryContext({ groupId, senderId, senderName, query, limit })}
<honcho-memory status="error">Honcho 暂不可用，已降级使用本地记忆：${normalizeText(err?.message || err)}</honcho-memory>` }
  const groupPeer = await ensurePeer(honcho, groupPeerIdFor(gid), { type: 'wechat_group', group_id: gid })
  const memberPeer = await ensurePeer(honcho, memberPeerIdFor(senderId, senderName), { type: 'wechat_member', sender_id: senderId, sender_name: senderName, group_id: gid })
  const assistantPeer = await ensurePeer(honcho, ASSISTANT_PEER_ID, { type: 'assistant', name: '小白龙' })
  const session = await ensureSession(honcho, gid, { type: 'wechat_group_session', group_id: gid }, [groupPeer, memberPeer, assistantPeer])
  try {
    const page = await session.messages({ reverse: true, size: Math.min(Math.max(Number(limit || 16), 1), 60) })
    const rows = pageItems(page)
    const summariesResult = await collectSessionSummaries(session)
    const summaries = Array.isArray(summariesResult) ? summariesResult : []
    const conclusions = await collectConclusions({ assistantPeer, groupPeer, memberPeer, session, limit: 16, includeAllPeers: false })
    const sections = [
      formatHonchoConclusionsAsContext(conclusions.items),
      formatHonchoSummariesAsContext(summaries),
      formatHonchoMessagesAsContext(rows),
    ].filter(Boolean)
    if (!sections.length) return await getLocalGroupMemoryContext({ groupId, senderId, senderName, query, limit })
    return `<honcho-group-memory query="${normalizeText(query).slice(0, 120)}">\n${sections.join('\n')}\n</honcho-group-memory>`
  } catch (err) {
    return `${await getLocalGroupMemoryContext({ groupId, senderId, senderName, query, limit })}
<honcho-memory status="error">Honcho 读取失败，已降级使用本地记忆：${normalizeText(err?.message || err)}</honcho-memory>`
  }
}

export async function listWeChatGroupMemory({ groupId, groupName = '', limit = 80, includeAllPeers = true } = {}) {
  const gid = groupKey(groupId)
  const honcho = getClient()
  if (!honcho || !gid) return listLocalGroupMemory({ groupId, groupName, limit, includeAllPeers })
  try { await ensureApp(honcho) } catch (err) { const local = listLocalGroupMemory({ groupId, groupName, limit, includeAllPeers }); return { ...local, degraded: true, honcho: honchoUnavailableResult({ error: `Honcho 暂不可用：${err?.message || err}` }) } }
  const groupPeer = await ensurePeer(honcho, groupPeerIdFor(gid), { type: 'wechat_group', group_id: gid, group_name: groupName })
  const assistantPeer = await ensurePeer(honcho, ASSISTANT_PEER_ID, { type: 'assistant', name: '小白龙' })
  const session = await ensureSession(honcho, gid, { type: 'wechat_group_session', group_id: gid, group_name: groupName }, [groupPeer, assistantPeer])
  const errors = []
  try {
    const size = Math.min(Math.max(Number(limit || 80), 1), 300)
    let messageRows = []
    let messageTotal = 0
    try {
      const page = await session.messages({ reverse: true, size })
      messageRows = pageItems(page).map(normalizeMessageItem)
      messageTotal = pageTotal(page, messageRows)
    } catch (err) {
      errors.push(`messages: ${err?.message || err}`)
    }

    const summaryResult = await collectSessionSummaries(session)
    const summaries = Array.isArray(summaryResult) ? summaryResult : []
    if (!Array.isArray(summaryResult) && summaryResult?.error) errors.push(`summaries: ${summaryResult.error}`)

    const extraMemberPeers = []
    if (includeAllPeers && messageRows.length) {
      const seenMembers = new Set()
      for (const row of messageRows) {
        const senderId = row?.metadata?.sender_id || ''
        const senderName = row?.metadata?.sender_name || row?.speaker || ''
        const memberPeerId = memberPeerIdFor(senderId, senderName)
        if (!senderId && !senderName) continue
        if (seenMembers.has(memberPeerId)) continue
        seenMembers.add(memberPeerId)
        try {
          extraMemberPeers.push(await ensurePeer(honcho, memberPeerId, { type: 'wechat_member', sender_id: senderId, sender_name: senderName, group_id: gid, group_name: groupName }))
        } catch (err) {
          errors.push(`member-peer:${senderName || senderId}: ${err?.message || err}`)
        }
      }
    }

    const conclusionsResult = await collectConclusions({ assistantPeer, groupPeer, session, limit: size, includeAllPeers, extraMemberPeers })
    const conclusions = conclusionsResult.items || []
    if (conclusionsResult.errors?.length) errors.push(...conclusionsResult.errors.map(err => `conclusions: ${err}`))

    const queue = await getSessionQueueStatus(session)
    return {
      ok: true,
      provider: 'honcho',
      workspaceId: appIdCache,
      group_id: gid,
      group_name: groupName,
      groupPeerId: groupPeer.id,
      sessionId: session.id,
      items: messageRows,
      messages: messageRows,
      conclusions,
      summaries,
      counts: {
        messages: messageRows.length,
        totalMessages: messageTotal,
        conclusions: conclusions.length,
        summaries: summaries.length,
      },
      queue,
      errors,
    }
  } catch (err) {
    return { ok: false, provider: 'honcho', items: [], messages: [], conclusions: [], summaries: [], error: err?.message || String(err), workspaceId: appIdCache, group_id: gid, sessionId: session?.id || '' }
  }
}

export async function listWeChatGroupMemoryOverview({ groups = [], limit = 20 } = {}) {
  const honcho = getClient()
  if (!honcho) return { ok: false, provider: 'honcho', groups: [], degraded: isHonchoTemporarilyDisabled(), error: isHonchoTemporarilyDisabled() ? `Honcho 暂不可用：${honchoLastError}` : 'Honcho 未配置或未启用' }
  const unique = []
  const seen = new Set()
  for (const group of groups || []) {
    const rawId = group?.id || group?.groupId || group?.group_id || group?.topic || group?.name || ''
    const id = rawId && !String(rawId).startsWith('wechaty:') && group?.id ? `wechaty:${rawId}` : String(rawId || '')
    const gid = groupKey(id)
    if (!gid || seen.has(gid)) continue
    seen.add(gid)
    unique.push({ id, gid, topic: group?.topic || group?.name || group?.groupName || group?.group_name || gid, selected: group?.selected === true })
  }
  const rows = []
  for (const group of unique.slice(0, 50)) {
    const detail = await listWeChatGroupMemory({ groupId: group.id || group.gid, groupName: group.topic, limit, includeAllPeers: false })
    rows.push({
      id: group.id || group.gid,
      group_id: detail.group_id || group.gid,
      group_name: group.topic,
      selected: group.selected,
      ok: detail.ok,
      sessionId: detail.sessionId,
      counts: detail.counts || { messages: 0, conclusions: 0, summaries: 0 },
      latest: (detail.messages || [])[0] || (detail.conclusions || [])[0] || null,
      errors: detail.errors || (detail.error ? [detail.error] : []),
    })
  }
  return { ok: true, provider: 'honcho', workspaceId: appIdCache, groups: rows }
}

export async function deleteWeChatGroupMemory({ groupId, kind = '', itemId = '', observerId = ASSISTANT_PEER_ID, observedId = '' } = {}) {
  const gid = groupKey(groupId)
  const honcho = getClient()
  if (!honcho || !gid) return { ok: false, provider: 'honcho', error: 'Honcho 未配置或未启用' }
  try { await ensureApp(honcho) } catch (err) { return honchoUnavailableResult({ error: `Honcho 暂不可用：${err?.message || err}` }) }
  const session = await ensureSession(honcho, gid, { type: 'wechat_group_session', group_id: gid }, [])
  const normalizedKind = String(kind || '').trim().toLowerCase()
  if (normalizedKind === 'session' || normalizedKind === 'group' || normalizedKind === 'all') {
    await session.delete()
    sessionCache.delete(gid)
    return { ok: true, provider: 'honcho', deleted: 'session', group_id: gid, sessionId: session.id }
  }
  if (normalizedKind === 'conclusion') {
    const id = String(itemId || '').trim()
    if (!id) return { ok: false, provider: 'honcho', error: 'conclusion id required' }
    const observerPeer = await ensurePeer(honcho, observerId || ASSISTANT_PEER_ID, { type: 'assistant' })
    const targetObservedId = observedId || groupPeerIdFor(gid)
    await observerPeer.conclusionsOf(targetObservedId).delete(id)
    return { ok: true, provider: 'honcho', deleted: 'conclusion', id, group_id: gid }
  }
  return { ok: false, provider: 'honcho', error: '当前只支持删除 Honcho 结论记忆或清空本群 session；原始消息不支持单条删除。' }
}

export function backfillLocalWeChatMemoryEmbeddings({ limit = 2000 } = {}) {
  ensureLocalMemorySchema()
  const db = getDB()
  const max = Math.min(Math.max(Number(limit || 2000), 1), 10000)
  let messages = 0
  let memories = 0
  const messageRows = db.prepare(`SELECT id, group_name, member_name, content FROM wechat_group_messages WHERE embedding IS NULL AND content <> '' ORDER BY id DESC LIMIT ?`).all(max)
  const memoryRows = db.prepare(`SELECT id, group_name, member_name, category, content FROM wechat_group_memory_items WHERE embedding IS NULL AND content <> '' ORDER BY id DESC LIMIT ?`).all(max)
  const tx = db.transaction(() => {
    for (const row of messageRows) {
      db.prepare(`UPDATE wechat_group_messages SET embedding = ? WHERE id = ?`).run(localHashEmbeddingBuffer(`${row.group_name || ''} ${row.member_name || ''}: ${row.content || ''}`), row.id)
      messages += 1
    }
    for (const row of memoryRows) {
      db.prepare(`UPDATE wechat_group_memory_items SET embedding = ? WHERE id = ?`).run(localHashEmbeddingBuffer(`${row.group_name || ''} ${row.member_name || ''} ${row.category || ''}: ${row.content || ''}`), row.id)
      memories += 1
    }
  })
  tx()
  return { ok: true, provider: 'local-hash', messages, memories }
}

export async function backfillWeChatExplicitMemoriesFromMessages({ limit = 5000 } = {}) {
  ensureLocalMemorySchema()
  const db = getDB()
  const max = Math.min(Math.max(Number(limit || 5000), 1), 20000)
  const rows = db.prepare(`
    SELECT id, group_id, group_name, member_id, member_name, content, source
    FROM wechat_group_messages
    WHERE content <> ''
    ORDER BY id ASC LIMIT ?
  `).all(max)
  let scanned = 0
  let extracted = 0
  const errors = []
  for (const row of rows) {
    scanned += 1
    const memories = extractWeChatExplicitMemories({ text: row.content, senderName: row.member_name, senderId: row.member_id })
    if (!memories.length) continue
    try {
      const result = await recordWeChatGroupExplicitMemories({
        groupId: row.group_id,
        groupName: row.group_name,
        senderId: row.member_id,
        senderName: row.member_name,
        text: row.content,
        source: row.source || 'local-backfill',
      })
      extracted += Number(result?.count || memories.length || 0)
    } catch (err) {
      errors.push(`${row.id}: ${err?.message || err}`)
      if (errors.length >= 20) break
    }
  }
  return { ok: errors.length === 0, provider: 'local+honcho', scanned, extracted, errors }
}


export async function syncLocalWeChatMessagesToHoncho({ limit = 300 } = {}) {
  ensureLocalMemorySchema()
  const honcho = getClient()
  if (!honcho) return { ok: false, provider: 'honcho', error: 'Honcho 未配置或未启用' }
  try { await ensureApp(honcho) } catch (err) { return honchoUnavailableResult({ error: `Honcho 暂不可用：${err?.message || err}` }) }
  const db = getDB()
  const rows = db.prepare(`
    SELECT * FROM wechat_group_messages
    WHERE COALESCE(honcho_synced_at, '') = '' AND content <> ''
    ORDER BY timestamp ASC, id ASC
    LIMIT ?
  `).all(Math.min(Math.max(Number(limit || 300), 1), 2000))
  let synced = 0
  const errors = []
  for (const row of rows) {
    try {
      const gid = groupKey(row.group_id)
      const groupPeerId = groupPeerIdFor(gid)
      const memberPeerId = memberPeerIdFor(row.member_id, row.member_name)
      const groupPeer = await ensurePeer(honcho, groupPeerId, { type: 'wechat_group', group_id: gid, group_name: row.group_name })
      const memberPeer = await ensurePeer(honcho, memberPeerId, { type: 'wechat_member', sender_id: row.member_id, sender_name: row.member_name, group_id: gid, group_name: row.group_name })
      const assistantPeer = await ensurePeer(honcho, ASSISTANT_PEER_ID, { type: 'assistant', name: '小白龙' })
      const session = await ensureSession(honcho, gid, { type: 'wechat_group_session', group_id: gid, group_name: row.group_name, source: 'local-backfill' }, [groupPeer, memberPeer, assistantPeer])
      const created = await session.addMessages(memberPeer.message(row.content, { metadata: { type: 'wechat_group_message', local_message_id: row.id, group_id: gid, group_name: row.group_name, sender_id: row.member_id, sender_name: row.member_name, mentioned_self: !!row.mentioned_self, source: row.source || 'local-backfill', timestamp: row.timestamp }, createdAt: row.timestamp }))
      const ids = created.map(item => item.id).filter(Boolean).join(',')
      db.prepare(`UPDATE wechat_group_messages SET honcho_synced_at = ?, honcho_message_id = ? WHERE id = ?`).run(nowTimestamp(), ids, row.id)
      synced += 1
    } catch (err) {
      errors.push(`${row.id}: ${err?.message || err}`)
      if (errors.length >= 10) break
    }
  }
  return { ok: errors.length === 0, provider: 'honcho', scanned: rows.length, synced, errors }
}
