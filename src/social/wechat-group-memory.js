import { Honcho } from '@honcho-ai/sdk'
import { nowTimestamp } from '../time.js'
import { getHonchoConfig } from '../config.js'
import { extractWeChatGroupId } from './wechat-groups.js'

let client = null
let cachedKey = ''
let cachedBaseURL = ''
let cachedEnv = ''
let appIdCache = ''
const userCache = new Map()
const sessionCache = new Map()

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

function messageCreatedAt(item) {
  return item?.createdAt || item?.created_at || item?.created_at_ || item?.metadata?.timestamp || ''
}

function messageSpeaker(item) {
  return item?.metadata?.sender_name || item?.metadata?.target_member_name || item?.peerId || item?.peer_id || '群成员'
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
  if (!usable.length) return '<honcho-group-memory>Honcho 暂无本群记忆。</honcho-group-memory>'
  return `<honcho-group-memory source="honcho-messages">\n${usable.join('\n')}\n</honcho-group-memory>`
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
  const session = await honcho.session(`wechat_group_${safeIdPart(groupId)}`, { metadata, peers })
  sessionCache.set(key, session)
  return session
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
  const groupPeerId = `wechat_group_${safeIdPart(gid)}`
  const memberPeerId = `wechat_member_${safeIdPart(senderId || senderName)}`
  const groupPeer = await ensurePeer(honcho, groupPeerId, { type: 'wechat_group', group_id: gid, group_name: groupName })
  const memberPeer = await ensurePeer(honcho, memberPeerId, { type: 'wechat_member', sender_id: senderId, sender_name: senderName, group_id: gid, group_name: groupName })
  const assistantPeer = await ensurePeer(honcho, 'bailongma_assistant', { type: 'assistant', name: '小白龙' })
  const session = await ensureSession(honcho, gid, { type: 'wechat_group_session', group_id: gid, group_name: groupName, source }, [groupPeer, memberPeer, assistantPeer])
  await session.addMessages(memberPeer.message(content, {
    metadata: { type: 'wechat_group_message', group_id: gid, group_name: groupName, sender_id: senderId, sender_name: senderName, mentioned_self: !!mentionedSelf, source, timestamp },
    createdAt: timestamp,
  }))
  return { ok: true, provider: 'honcho', workspaceId: appIdCache, sessionId: session.id, groupPeerId, memberPeerId }
}

export async function recordWeChatGroupAssistantReply({ groupId, groupName = '', reply = '', targetMemberName = '', source = 'wechaty', timestamp = nowTimestamp() } = {}) {
  const content = normalizeText(reply)
  const gid = groupKey(groupId)
  const honcho = getClient()
  if (!honcho || !gid || !content) return { ok: false, skipped: true, reason: 'honcho_not_configured' }
  await ensureApp(honcho)
  const groupPeer = await ensurePeer(honcho, `wechat_group_${safeIdPart(gid)}`, { type: 'wechat_group', group_id: gid, group_name: groupName })
  const assistantPeer = await ensurePeer(honcho, 'bailongma_assistant', { type: 'assistant', name: '小白龙' })
  const session = await ensureSession(honcho, gid, { type: 'wechat_group_session', group_id: gid, group_name: groupName, source }, [groupPeer, assistantPeer])
  await session.addMessages(assistantPeer.message(content, { metadata: { type: 'assistant_reply', group_id: gid, group_name: groupName, target_member_name: targetMemberName, source, timestamp }, createdAt: timestamp }))
  return { ok: true, provider: 'honcho', workspaceId: appIdCache, sessionId: session.id }
}

export async function getWeChatGroupMemoryContext({ groupId, senderId = '', senderName = '', query = '', limit = 16 } = {}) {
  const gid = groupKey(groupId)
  const honcho = getClient()
  if (!honcho || !gid) return '<honcho-memory status="disabled">Honcho 未配置或未启用，本群无可用长期记忆。</honcho-memory>'
  await ensureApp(honcho)
  const groupPeer = await ensurePeer(honcho, `wechat_group_${safeIdPart(gid)}`, { type: 'wechat_group', group_id: gid })
  const memberPeer = await ensurePeer(honcho, `wechat_member_${safeIdPart(senderId || senderName)}`, { type: 'wechat_member', sender_id: senderId, sender_name: senderName, group_id: gid })
  const session = await ensureSession(honcho, gid, { type: 'wechat_group_session', group_id: gid }, [groupPeer, memberPeer, 'bailongma_assistant'])
  try {
    const page = await session.messages({ reverse: true, size: Math.min(Math.max(Number(limit || 16), 1), 60) })
    const rows = page?.items || page?.data || (Array.isArray(page) ? page : [])
    return formatHonchoMessagesAsContext(rows)
  } catch (err) {
    return `<honcho-memory status="error">Honcho 读取失败：${normalizeText(err?.message || err)}</honcho-memory>`
  }
}

export async function listWeChatGroupMemory({ groupId, limit = 80 } = {}) {
  const gid = groupKey(groupId)
  const honcho = getClient()
  if (!honcho || !gid) return { ok: false, provider: 'honcho', items: [], error: 'Honcho 未配置或未启用' }
  await ensureApp(honcho)
  const groupPeer = await ensurePeer(honcho, `wechat_group_${safeIdPart(gid)}`, { type: 'wechat_group', group_id: gid })
  const session = await ensureSession(honcho, gid, { type: 'wechat_group_session', group_id: gid }, [groupPeer, 'bailongma_assistant'])
  try {
    const page = await session.messages({ reverse: true, size: Math.min(Math.max(Number(limit || 80), 1), 100) })
    const rows = page?.items || page?.data || (Array.isArray(page) ? page : [])
    return { ok: true, provider: 'honcho', workspaceId: appIdCache, sessionId: session.id, items: rows }
  } catch (err) {
    return { ok: false, provider: 'honcho', items: [], error: err?.message || String(err) }
  }
}
