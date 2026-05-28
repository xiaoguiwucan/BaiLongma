import { Honcho } from '@honcho-ai/sdk'
import { nowTimestamp } from '../time.js'
import { getHonchoConfig } from '../config.js'
import { extractWeChatGroupId } from './wechat-groups.js'
import { extractWeChatExplicitMemories } from './wechat-memory-extractor.js'

let client = null
let cachedKey = ''
let cachedBaseURL = ''
let cachedEnv = ''
let appIdCache = ''
const userCache = new Map()
const sessionCache = new Map()

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
    content: normalizeText(item?.content || ''),
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
      const text = normalizeText(item?.content || '')
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
  await honcho.getMetadata().catch(() => ({}))
  const cfg = getHonchoConfig()
  appIdCache = cfg.workspaceId || cfg.appId || 'bailongma-wechat-memory'
  return appIdCache
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

async function collectConclusions({ assistantPeer, groupPeer, memberPeer, session, limit = 40, includeAllPeers = false } = {}) {
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
  const honcho = getClient()
  if (!honcho || !gid || !content) return { ok: false, skipped: true, reason: 'honcho_not_configured' }
  await ensureApp(honcho)
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
  return { ok: true, provider: 'honcho', workspaceId: appIdCache, sessionId: session.id, groupPeerId, memberPeerId, messageIds: created.map(item => item.id).filter(Boolean) }
}

export async function recordWeChatGroupAssistantReply({ groupId, groupName = '', reply = '', targetMemberName = '', source = 'wechaty', timestamp = nowTimestamp() } = {}) {
  const content = normalizeText(reply)
  const gid = groupKey(groupId)
  const honcho = getClient()
  if (!honcho || !gid || !content) return { ok: false, skipped: true, reason: 'honcho_not_configured' }
  await ensureApp(honcho)
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
  const honcho = getClient()
  if (!honcho || !gid) return { ok: false, provider: 'honcho', error: 'Honcho 未配置或未启用' }
  if (!body) return { ok: false, provider: 'honcho', error: '记忆内容不能为空' }
  await ensureApp(honcho)
  const groupPeer = await ensurePeer(honcho, groupPeerIdFor(gid), { type: 'wechat_group', group_id: gid, group_name: groupName })
  const assistantPeer = await ensurePeer(honcho, ASSISTANT_PEER_ID, { type: 'assistant', name: '小白龙' })
  const memberPeer = senderId || senderName ? await ensurePeer(honcho, memberPeerIdFor(senderId, senderName), { type: 'wechat_member', sender_id: senderId, sender_name: senderName, group_id: gid, group_name: groupName }) : null
  const session = await ensureSession(honcho, gid, { type: 'wechat_group_session', group_id: gid, group_name: groupName, source: 'manual' }, [groupPeer, assistantPeer, ...(memberPeer ? [memberPeer] : [])])
  const target = memberPeer || groupPeer
  const created = await assistantPeer.conclusionsOf(target).create({ content: body, sessionId: session })
  return {
    ok: true,
    provider: 'honcho',
    workspaceId: appIdCache,
    sessionId: session.id,
    group_id: gid,
    category,
    items: created.map(item => normalizeConclusionItem(item, memberPeer ? 'member' : 'group')),
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
  if (!honcho || !gid) return '<honcho-memory status="disabled">Honcho 未配置或未启用，本群无可用长期记忆。</honcho-memory>'
  await ensureApp(honcho)
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
    if (!sections.length) return '<honcho-group-memory>Honcho 暂无本群记忆。</honcho-group-memory>'
    return `<honcho-group-memory query="${normalizeText(query).slice(0, 120)}">\n${sections.join('\n')}\n</honcho-group-memory>`
  } catch (err) {
    return `<honcho-memory status="error">Honcho 读取失败：${normalizeText(err?.message || err)}</honcho-memory>`
  }
}

export async function listWeChatGroupMemory({ groupId, groupName = '', limit = 80, includeAllPeers = true } = {}) {
  const gid = groupKey(groupId)
  const honcho = getClient()
  if (!honcho || !gid) return { ok: false, provider: 'honcho', items: [], messages: [], conclusions: [], summaries: [], error: 'Honcho 未配置或未启用' }
  await ensureApp(honcho)
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

    const conclusionsResult = await collectConclusions({ assistantPeer, groupPeer, session, limit: size, includeAllPeers })
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
    return { ok: false, provider: 'honcho', items: [], messages: [], conclusions: [], summaries: [], error: err?.message || String(err), workspaceId: appIdCache, group_id: gid, sessionId: session.id }
  }
}

export async function listWeChatGroupMemoryOverview({ groups = [], limit = 20 } = {}) {
  const honcho = getClient()
  if (!honcho) return { ok: false, provider: 'honcho', groups: [], error: 'Honcho 未配置或未启用' }
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
  await ensureApp(honcho)
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
