import { nowTimestamp } from '../time.js'
import { getDB, insertConversation, normalizeConversationPartyId, upsertEntity } from '../db.js'
import { getWeChatGroupMemoryContext } from './wechat-group-memory.js'

export const WECHAT_GROUP_CHANNEL = 'WECHAT_CLAWBOT_GROUP'

export function makeWeChatGroupExternalId(groupId = '') {
  const id = String(groupId || '').trim()
  return id ? `wechat:clawbot-group:${id}` : ''
}

export function isWeChatGroupExternalId(id = '') {
  return String(id || '').startsWith('wechat:clawbot-group:')
}

export function extractWeChatGroupId(externalId = '') {
  const raw = String(externalId || '').trim()
  return raw.startsWith('wechat:clawbot-group:') ? raw.slice('wechat:clawbot-group:'.length) : raw
}

export function isGroupSummaryRequest(text = '') {
  const value = String(text || '').trim()
  return /(?:总结|汇总|概括|整理).{0,8}(?:这个群|本群|群聊|聊天记录|最近|今天)|(?:群里|大家|刚刚).{0,8}(?:说了什么|聊了什么|重点|结论|待办)/u.test(value)
}

export function shouldWakeInWeChatGroup(text = '') {
  const value = String(text || '').trim()
  if (!value) return false
  if (isGroupSummaryRequest(value)) return true
  // 群聊默认只归档；只有明确 @/呼叫助手才进入 AI，避免刷屏。
  // ClawBot/iLink 收到的群 @ 文本通常会保留为“@前夜 在吗”，所以必须识别当前登录微信名“前夜”。
  return /(?:^|[\s@＠])(?:前夜|小白龙|白龙马|贾维斯|jarvis|Jarvis)(?:[\u2005\u2006\u2007\u2008\u2009\u200a\s，,：:、]|$)/u.test(value)
}

export function archiveWeChatGroupMessage({ groupId, senderId = '', text, timestamp = nowTimestamp() } = {}) {
  const groupExternalId = makeWeChatGroupExternalId(groupId)
  const content = String(text || '').trim()
  if (!groupExternalId || !content) return null

  const normalizedGroupId = normalizeConversationPartyId(groupExternalId)
  upsertEntity(normalizedGroupId)
  insertConversation({
    role: 'user',
    from_id: normalizedGroupId,
    content: formatGroupLine(senderId, content),
    timestamp,
    channel: WECHAT_GROUP_CHANNEL,
    external_party_id: groupExternalId,
  })
  return { groupExternalId: normalizedGroupId, timestamp }
}

export function formatGroupLine(senderId = '', text = '') {
  const sender = String(senderId || '').trim()
  const body = String(text || '').trim()
  return sender ? `[群成员 ${sender}] ${body}` : body
}

export function getRecentWeChatGroupMessages(groupExternalId, { limit = 80, hours = 24 } = {}) {
  const db = getDB()
  const normalized = normalizeConversationPartyId(groupExternalId)
  const cutoff = new Date(Date.now() - Number(hours || 24) * 3600 * 1000).toISOString()
  return db.prepare(`
    SELECT id, role, from_id, to_id, content, timestamp, channel, external_party_id
    FROM conversations
    WHERE role = 'user'
      AND from_id = ?
      AND channel = ?
      AND timestamp >= ?
    ORDER BY id DESC
    LIMIT ?
  `).all(normalized, WECHAT_GROUP_CHANNEL, cutoff, Math.min(Math.max(Number(limit || 80), 1), 300)).reverse()
}

export function listRecentWeChatGroups({ limit = 20, hours = 72 } = {}) {
  const db = getDB()
  const cutoff = new Date(Date.now() - Number(hours || 72) * 3600 * 1000).toISOString()
  return db.prepare(`
    SELECT from_id AS group_id,
           external_party_id,
           COUNT(*) AS message_count,
           MAX(timestamp) AS last_ts,
           MAX(id) AS last_id
    FROM conversations
    WHERE role = 'user'
      AND channel = ?
      AND timestamp >= ?
    GROUP BY from_id, external_party_id
    ORDER BY last_id DESC
    LIMIT ?
  `).all(WECHAT_GROUP_CHANNEL, cutoff, Math.min(Math.max(Number(limit || 20), 1), 100))
}

export function buildWeChatGroupSummary(messages = []) {
  const rows = Array.isArray(messages) ? messages : []
  if (!rows.length) return '这个群最近还没有可总结的聊天记录。'

  const participants = new Map()
  const keywordCount = new Map()
  const important = []
  const stop = new Set('这个 一个 我们 你们 他们 以及 然后 但是 如果 因为 所以 还是 可以 需要 没有 不是 什么 怎么 就是 现在 今天 最近 大家 群里'.split(' '))

  for (const row of rows) {
    const content = String(row.content || '').trim()
    const sender = content.match(/^\[群成员\s+([^\]]+)\]/)?.[1] || '未知成员'
    participants.set(sender, (participants.get(sender) || 0) + 1)
    const plain = content.replace(/^\[群成员\s+[^\]]+\]\s*/, '')
    if (/(重要|确定|决定|待办|安排|问题|风险|上线|发布|修复|报错|失败|需要|今天|明天|截止|会议|方案)/u.test(plain)) {
      important.push(`- ${row.timestamp?.slice(11, 16) || ''} ${sender}: ${plain.slice(0, 120)}`)
    }
    for (const token of plain.match(/[\u4e00-\u9fa5A-Za-z0-9]{2,12}/g) || []) {
      if (stop.has(token) || /^\d+$/.test(token)) continue
      keywordCount.set(token, (keywordCount.get(token) || 0) + 1)
    }
  }

  const topParticipants = [...participants.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([name, n]) => `${name}(${n})`).join('、')
  const topKeywords = [...keywordCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([k]) => k).join('、')
  const start = rows[0]?.timestamp || ''
  const end = rows[rows.length - 1]?.timestamp || ''
  const highlights = important.slice(-12)

  return [
    `群聊总结（${rows.length} 条，${start.slice(0, 16)} ~ ${end.slice(0, 16)}）`,
    topParticipants ? `活跃成员：${topParticipants}` : '',
    topKeywords ? `高频关键词：${topKeywords}` : '',
    highlights.length ? `重点消息：\n${highlights.join('\n')}` : '重点消息：最近聊天较分散，未发现明显待办/决定类关键词。',
  ].filter(Boolean).join('\n')
}

export async function buildWeChatGroupCommandPrompt({ groupId, senderId = '', senderName = '', text = '' } = {}) {
  const groupExternalId = makeWeChatGroupExternalId(groupId)
  const messages = getRecentWeChatGroupMessages(groupExternalId, { limit: 100, hours: 24 })
  const transcript = messages.map(row => `${row.timestamp?.slice(5, 16) || ''} ${row.content}`).join('\n')
  const quickSummary = buildWeChatGroupSummary(messages)
  const memoryContext = await getWeChatGroupMemoryContext({ groupId, senderId, senderName, query: text, limit: 18 })
  return [
    `微信群成员 ${senderId || '未知成员'} 发来群聊命令：${String(text || '').trim()}`,
    '',
    '请基于下面这个群最近 24 小时的聊天记录和该群专属长期记忆回复。要求：简洁、按要点整理；如果是总结群聊，给出「结论/重点/待办/风险」；不要编造记录里没有的信息。注意：不同微信群的记忆必须严格隔离，只能使用当前群的记忆。',
    '',
    memoryContext || '<group-long-term-memory>（暂无当前群长期记忆）</group-long-term-memory>',
    '',
    '<recent-wechat-group-transcript>',
    transcript || '（暂无最近聊天记录）',
    '</recent-wechat-group-transcript>',
    '',
    '<local-extractive-summary>',
    quickSummary,
    '</local-extractive-summary>',
  ].join('\n')
}
