import { nowTimestamp } from '../time.js'
import { getDB, insertConversation, normalizeConversationPartyId, upsertEntity } from '../db.js'
import { getWechatyDutyGroupConfig } from '../config.js'
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

export function stripLeadingWechatMentions(text = '') {
  let value = String(text || '').trim()
  // 微信 @ 后常见分隔符包括普通空格和 U+2005/U+2006 等窄空格。
  // 这里只剥离开头连续 @ 段，避免把正文里的 @ 人名误删。
  for (let i = 0; i < 5; i++) {
    const next = value.replace(/^[@＠][^\s\u2005\u2006\u2007\u2008\u2009\u200a，,：:、]{1,40}[\s\u2005\u2006\u2007\u2008\u2009\u200a，,：:、]*/u, '').trim()
    if (next === value) break
    value = next
  }
  return value
}

export function shouldWakeInWeChatGroup(text = '', { mentionedSelf = false } = {}) {
  // 群助手不再绑定“前夜/小白龙/贾维斯”等固定唤醒词。
  // 只有上游连接器明确确认“@ 当前登录账号”时才唤醒；昵称、群备注、微信名以后怎么改都不影响。
  return !!mentionedSelf
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

export async function buildWeChatGroupCommandPrompt({ groupId, groupName = '', senderId = '', senderName = '', text = '', mentionedSelf = false } = {}) {
  const groupExternalId = makeWeChatGroupExternalId(groupId)
  const messages = getRecentWeChatGroupMessages(groupExternalId, { limit: 100, hours: 24 })
  const transcript = messages.map(row => `${row.timestamp?.slice(5, 16) || ''} ${row.content}`).join('\n')
  const quickSummary = buildWeChatGroupSummary(messages)
  const memoryContext = await getWeChatGroupMemoryContext({ groupId, senderId, senderName, query: text, limit: 18 })
  const personaPrompt = String(getWechatyDutyGroupConfig().personaPrompt || '').trim()
  const rawText = String(text || '').trim()
  const commandText = stripLeadingWechatMentions(rawText) || rawText
  const verifiedMentionBlock = mentionedSelf
    ? [
        '<wechat-mention-verification>',
        'Wechaty 已经从微信消息结构确认：这条消息 @ 了当前登录的助手账号。',
        '这不是关键词判断，也不依赖微信昵称、群昵称或备注名；即使文本里显示的是“小风/风/前夜/其他新昵称”，也必须视为用户正在叫你。',
        '硬性要求：禁止回复“没叫我”“不是@我”“跳过”“无需回应”等内容；必须直接回答用户真正的问题或请求。',
        '</wechat-mention-verification>',
      ].join('\n')
    : ''
  return [
    verifiedMentionBlock,
    personaPrompt ? `<wechat-assistant-persona>\n${personaPrompt}\n</wechat-assistant-persona>` : '',
    '',
    `微信群${groupName ? `「${groupName}」` : ''}成员 ${senderName || senderId || '未知成员'} 已经 @ 你并发来消息。`,
    `用户原文：${rawText}`,
    `去掉开头 @ 后的实际请求：${commandText}`,
    '',
    '请基于用户的实际请求回复。群聊场景下要简洁自然；如果用户只是玩笑/吐槽/骂人，也要正常接话或简短化解，不要说没叫你。',
    '如果是总结群聊，给出「结论/重点/待办/风险」；不要编造记录里没有的信息。注意：不同微信群的记忆必须严格隔离，只能使用当前群的记忆。',
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
  ].filter(Boolean).join('\n')
}
