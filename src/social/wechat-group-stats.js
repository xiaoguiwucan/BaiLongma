import { getDB } from '../db.js'
import { nowTimestamp } from '../time.js'

const MAX_TEXT_LENGTH = 2400

const WECHATY_TYPE_NAMES = {
  0: 'unknown',
  1: 'attachment',
  2: 'audio',
  3: 'contact',
  4: 'chat_history',
  5: 'emoji',
  6: 'image',
  7: 'text',
  8: 'location',
  9: 'mini_program',
  10: 'group_note',
  11: 'transfer',
  12: 'red_envelope',
  13: 'recalled',
  14: 'link',
  15: 'video',
  16: 'post',
}

const BRAG_PATTERNS = [
  /(?:我|哥|爷|本人|咱|咱们).{0,8}(?:早就|随便|轻松|闭眼|秒|拿捏|吊打|乱杀|碾压|无敌|遥遥领先|封神|王者|顶级|高端|专业|天花板)/u,
  /(?:懂不懂|格局|这才叫|看我操作|不是我吹|不装了|摊牌了|低调|小意思|基操|洒洒水|随便拿捏)/u,
  /(?:牛逼|牛批|太强了|强无敌|大佬|大神|专家|大师|天才|遥遥领先|降维打击|秒了|赢麻了|装逼|凡尔赛)/u,
]

const IMPORTANT_RE = /(重要|确定|决定|待办|安排|问题|风险|上线|发布|修复|报错|失败|需要|今天|明天|截止|会议|方案|结论|确认|负责人|进度|报警|告警|事故|复盘)/u
const URL_RE = /https?:\/\/[^\s<>'"）)]+/giu
const EMOJI_XML_RE = /<msg[\s\S]{0,800}<emoji|<emoji\b|cdnurl=|emoji[^>]{0,120}(?:md5|len|aeskey)/iu
const IMAGE_XML_RE = /<img\b|<image\b|cdnthumburl=|cdnmidimgurl=|(?:\.jpg|\.jpeg|\.png|\.gif|\.webp)(?:\?|$)/iu
const MINI_PROGRAM_RE = /<appmsg\b|<weappinfo\b|小程序/u
const XML_LIKE_RE = /^<\?xml|^<msg\b|^<appmsg\b|^<sysmsg\b/iu

let schemaReady = false

function ensureSchema() {
  if (schemaReady) return
  const db = getDB()
  db.exec(`
    CREATE TABLE IF NOT EXISTS wechat_group_activity (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      group_id TEXT NOT NULL,
      group_name TEXT NOT NULL DEFAULT '',
      sender_id TEXT NOT NULL DEFAULT '',
      sender_name TEXT NOT NULL DEFAULT '',
      message_type TEXT NOT NULL DEFAULT 'text',
      display_text TEXT NOT NULL DEFAULT '',
      raw_text TEXT NOT NULL DEFAULT '',
      text_length INTEGER NOT NULL DEFAULT 0,
      image_count INTEGER NOT NULL DEFAULT 0,
      emoji_count INTEGER NOT NULL DEFAULT 0,
      link_count INTEGER NOT NULL DEFAULT 0,
      brag_score INTEGER NOT NULL DEFAULT 0,
      mentioned_self INTEGER NOT NULL DEFAULT 0,
      source TEXT NOT NULL DEFAULT '',
      timestamp TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_wechat_group_activity_group_ts ON wechat_group_activity(group_id, timestamp);
    CREATE INDEX IF NOT EXISTS idx_wechat_group_activity_sender_ts ON wechat_group_activity(group_id, sender_id, timestamp);
    CREATE INDEX IF NOT EXISTS idx_wechat_group_activity_type ON wechat_group_activity(group_id, message_type, timestamp);

    CREATE TABLE IF NOT EXISTS wechat_group_digest_sent (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      group_id TEXT NOT NULL,
      digest_type TEXT NOT NULL,
      period_key TEXT NOT NULL,
      sent_at TEXT NOT NULL,
      UNIQUE(group_id, digest_type, period_key)
    );
    CREATE INDEX IF NOT EXISTS idx_wechat_group_digest_sent_at ON wechat_group_digest_sent(sent_at);
  `)
  schemaReady = true
}

function toLocalTimestamp(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date)
  if (Number.isNaN(d.getTime())) return nowTimestamp()
  const pad = n => String(n).padStart(2, '0')
  const offset = -d.getTimezoneOffset()
  const sign = offset >= 0 ? '+' : '-'
  const absOffset = Math.abs(offset)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}${sign}${pad(Math.floor(absOffset / 60))}:${pad(absOffset % 60)}`
}

export function normalizeStatsGroupId(groupId = '') {
  const raw = String(groupId || '').trim()
  return raw.startsWith('wechat:clawbot-group:') ? raw.slice('wechat:clawbot-group:'.length) : raw
}

export function normalizeWechatMessageType(messageType = '') {
  if (typeof messageType === 'number') return WECHATY_TYPE_NAMES[messageType] || `type_${messageType}`
  const raw = String(messageType || '').trim()
  if (!raw) return ''
  const numeric = Number(raw)
  if (Number.isInteger(numeric) && WECHATY_TYPE_NAMES[numeric]) return WECHATY_TYPE_NAMES[numeric]
  return raw.toLowerCase().replace(/[^a-z0-9_\u4e00-\u9fa5-]+/g, '_')
}

function countUnicodeEmoji(text = '') {
  try {
    const matches = String(text || '').match(/[\p{Extended_Pictographic}]/gu)
    return matches ? matches.length : 0
  } catch {
    return 0
  }
}

function countBracketEmoji(text = '') {
  return (String(text || '').match(/\[[\u4e00-\u9fa5A-Za-z]{1,8}\]/g) || []).length
}

function countBragScore(text = '') {
  const value = String(text || '')
  if (!value.trim()) return 0
  let score = 0
  for (const re of BRAG_PATTERNS) {
    if (re.test(value)) score += 1
  }
  return Math.min(score, 3)
}

function stripXmlNoise(text = '') {
  const value = String(text || '').trim()
  if (!XML_LIKE_RE.test(value) || value.length < 80) return value
  if (EMOJI_XML_RE.test(value)) return '[表情]'
  if (IMAGE_XML_RE.test(value)) return '[图片]'
  if (MINI_PROGRAM_RE.test(value)) return '[小程序/链接]'
  return '[微信结构化消息]'
}

export function analyzeWeChatGroupMessage({ text = '', messageType = '' } = {}) {
  const rawText = String(text || '').trim()
  const type = normalizeWechatMessageType(messageType)
  const lowerType = type.toLowerCase()
  const isImageType = /(image|img|photo|picture|video|attachment|6|15)/iu.test(lowerType)
  const isEmojiType = /(emoji|emoticon|sticker|5)/iu.test(lowerType)
  const isLinkType = /(link|url|post|mini_program|appmsg|14|16)/iu.test(lowerType)
  const imageXml = IMAGE_XML_RE.test(rawText)
  const emojiXml = EMOJI_XML_RE.test(rawText)
  const miniProgram = MINI_PROGRAM_RE.test(rawText)
  const urls = [...rawText.matchAll(URL_RE)].map(match => match[0].replace(/[。。，，、；;]+$/u, ''))
  const imageCount = (isImageType || imageXml) ? 1 : 0
  const emojiCount = (isEmojiType || emojiXml ? 1 : 0) + countBracketEmoji(rawText) + countUnicodeEmoji(rawText)
  const linkCount = urls.length + ((isLinkType || miniProgram) && !urls.length ? 1 : 0)
  let displayText = stripXmlNoise(rawText)
  if (!displayText) {
    if (imageCount) displayText = '[图片]'
    else if (emojiCount) displayText = '[表情]'
    else if (linkCount) displayText = '[链接]'
  }
  displayText = displayText.replace(/\s+/g, ' ').trim().slice(0, MAX_TEXT_LENGTH)
  const textLength = displayText.replace(/^\[(?:图片|表情|链接|小程序\/链接|微信结构化消息)\]$/u, '').length
  const bragScore = countBragScore(displayText)
  const kinds = []
  if (textLength > 0) kinds.push('text')
  if (imageCount) kinds.push('image')
  if (emojiCount) kinds.push('emoji')
  if (linkCount) kinds.push('link')
  if (!kinds.length && displayText) kinds.push('text')
  const messageKind = kinds.length > 1 ? 'mixed' : (kinds[0] || 'unknown')
  return {
    ok: !!displayText || imageCount > 0 || emojiCount > 0 || linkCount > 0,
    messageType: messageKind,
    sourceType: type || '',
    displayText,
    rawText: rawText.slice(0, MAX_TEXT_LENGTH),
    textLength,
    imageCount,
    emojiCount,
    linkCount,
    bragScore,
    urls: [...new Set(urls)].slice(0, 12),
    important: IMPORTANT_RE.test(displayText),
  }
}

export function normalizeWeChatGroupDisplayText(text = '', messageType = '') {
  return analyzeWeChatGroupMessage({ text, messageType }).displayText
}

export function recordWeChatGroupActivity({ groupId, groupName = '', senderId = '', senderName = '', text = '', messageType = '', mentionedSelf = false, source = 'wechaty', timestamp = nowTimestamp() } = {}) {
  const gid = normalizeStatsGroupId(groupId)
  const analysis = analyzeWeChatGroupMessage({ text, messageType })
  if (!gid || !analysis.ok) return { ok: false, skipped: true, reason: 'empty_activity', analysis }
  ensureSchema()
  const db = getDB()
  const info = db.prepare(`
    INSERT INTO wechat_group_activity (
      group_id, group_name, sender_id, sender_name, message_type, display_text, raw_text,
      text_length, image_count, emoji_count, link_count, brag_score, mentioned_self, source, timestamp
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    gid,
    String(groupName || '').trim(),
    String(senderId || '').trim(),
    String(senderName || senderId || '').trim(),
    analysis.messageType,
    analysis.displayText,
    analysis.rawText,
    analysis.textLength,
    analysis.imageCount,
    analysis.emojiCount,
    analysis.linkCount,
    analysis.bragScore,
    mentionedSelf ? 1 : 0,
    String(source || '').trim(),
    String(timestamp || nowTimestamp())
  )
  return { ok: true, id: info.lastInsertRowid, group_id: gid, ...analysis }
}

function rangeDates({ from = '', to = '', hours = 24, range = '' } = {}) {
  const now = new Date()
  let start = from ? new Date(from) : null
  let end = to ? new Date(to) : now
  if (range === 'today') {
    start = new Date(now)
    start.setHours(0, 0, 0, 0)
    end = now
  } else if (!start || Number.isNaN(start.getTime())) {
    start = new Date(now.getTime() - Math.min(Math.max(Number(hours || 24), 1), 24 * 90) * 3600 * 1000)
  }
  if (!end || Number.isNaN(end.getTime())) end = now
  return { from: toLocalTimestamp(start), to: toLocalTimestamp(end) }
}

function rowsByMetric(db, gid, from, to, metric, limit) {
  const safeMetric = {
    message_count: 'COUNT(*)',
    image_count: 'SUM(image_count)',
    emoji_count: 'SUM(emoji_count)',
    link_count: 'SUM(link_count)',
    brag_score: 'SUM(brag_score)',
    brag_count: 'SUM(CASE WHEN brag_score > 0 THEN 1 ELSE 0 END)',
  }[metric]
  if (!safeMetric) return []
  return db.prepare(`
    SELECT COALESCE(NULLIF(sender_name, ''), NULLIF(sender_id, ''), '未知成员') AS name,
           sender_id,
           ${safeMetric} AS value,
           COUNT(*) AS message_count
    FROM wechat_group_activity
    WHERE group_id = ? AND timestamp >= ? AND timestamp <= ?
    GROUP BY COALESCE(NULLIF(sender_id, ''), sender_name, 'unknown'), name
    HAVING value > 0
    ORDER BY value DESC, message_count DESC
    LIMIT ?
  `).all(gid, from, to, Math.min(Math.max(Number(limit || 10), 1), 30))
}

export function getWeChatGroupStats({ groupId, from = '', to = '', hours = 24, range = '', limit = 10 } = {}) {
  const gid = normalizeStatsGroupId(groupId)
  if (!gid) return { ok: false, error: 'group_id required' }
  ensureSchema()
  const db = getDB()
  const dates = rangeDates({ from, to, hours, range })
  const totals = db.prepare(`
    SELECT COUNT(*) AS message_count,
           COALESCE(SUM(text_length), 0) AS text_length,
           COALESCE(SUM(image_count), 0) AS image_count,
           COALESCE(SUM(emoji_count), 0) AS emoji_count,
           COALESCE(SUM(link_count), 0) AS link_count,
           COALESCE(SUM(brag_score), 0) AS brag_score,
           COALESCE(SUM(CASE WHEN brag_score > 0 THEN 1 ELSE 0 END), 0) AS brag_count,
           COUNT(DISTINCT COALESCE(NULLIF(sender_id, ''), sender_name)) AS participant_count,
           MAX(group_name) AS group_name
    FROM wechat_group_activity
    WHERE group_id = ? AND timestamp >= ? AND timestamp <= ?
  `).get(gid, dates.from, dates.to) || {}
  const recent = db.prepare(`
    SELECT id, group_id, group_name, sender_id, sender_name, message_type, display_text, image_count, emoji_count, link_count, brag_score, timestamp
    FROM wechat_group_activity
    WHERE group_id = ? AND timestamp >= ? AND timestamp <= ?
    ORDER BY id DESC
    LIMIT ?
  `).all(gid, dates.from, dates.to, 80).reverse()
  const important = recent.filter(row => IMPORTANT_RE.test(row.display_text || '')).slice(-12)
  const links = db.prepare(`
    SELECT display_text, sender_name, timestamp
    FROM wechat_group_activity
    WHERE group_id = ? AND timestamp >= ? AND timestamp <= ? AND link_count > 0
    ORDER BY id DESC
    LIMIT 20
  `).all(gid, dates.from, dates.to).reverse()
  return {
    ok: true,
    group_id: gid,
    group_name: totals.group_name || '',
    from: dates.from,
    to: dates.to,
    totals: {
      message_count: Number(totals.message_count || 0),
      text_length: Number(totals.text_length || 0),
      image_count: Number(totals.image_count || 0),
      emoji_count: Number(totals.emoji_count || 0),
      link_count: Number(totals.link_count || 0),
      brag_score: Number(totals.brag_score || 0),
      brag_count: Number(totals.brag_count || 0),
      participant_count: Number(totals.participant_count || 0),
    },
    leaderboards: {
      messages: rowsByMetric(db, gid, dates.from, dates.to, 'message_count', limit),
      images: rowsByMetric(db, gid, dates.from, dates.to, 'image_count', limit),
      emojis: rowsByMetric(db, gid, dates.from, dates.to, 'emoji_count', limit),
      links: rowsByMetric(db, gid, dates.from, dates.to, 'link_count', limit),
      brag: rowsByMetric(db, gid, dates.from, dates.to, 'brag_count', limit),
    },
    important,
    links,
    recent,
  }
}

export function listActiveWeChatGroupStatsGroups({ hours = 24 * 30, limit = 100 } = {}) {
  ensureSchema()
  const db = getDB()
  const cutoff = toLocalTimestamp(new Date(Date.now() - Math.min(Math.max(Number(hours || 720), 1), 24 * 365) * 3600 * 1000))
  return db.prepare(`
    SELECT group_id,
           COALESCE(NULLIF(MAX(group_name), ''), group_id) AS group_name,
           COUNT(*) AS message_count,
           MAX(timestamp) AS last_ts
    FROM wechat_group_activity
    WHERE timestamp >= ?
    GROUP BY group_id
    ORDER BY MAX(id) DESC
    LIMIT ?
  `).all(cutoff, Math.min(Math.max(Number(limit || 100), 1), 300))
}

export function hasDigestBeenSent({ groupId, digestType, periodKey } = {}) {
  const gid = normalizeStatsGroupId(groupId)
  if (!gid || !digestType || !periodKey) return false
  ensureSchema()
  const row = getDB().prepare(`SELECT 1 FROM wechat_group_digest_sent WHERE group_id = ? AND digest_type = ? AND period_key = ?`).get(gid, digestType, String(periodKey))
  return !!row
}

export function markDigestSent({ groupId, digestType, periodKey, sentAt = nowTimestamp() } = {}) {
  const gid = normalizeStatsGroupId(groupId)
  if (!gid || !digestType || !periodKey) return { ok: false, error: 'missing digest sent key' }
  ensureSchema()
  getDB().prepare(`INSERT OR IGNORE INTO wechat_group_digest_sent (group_id, digest_type, period_key, sent_at) VALUES (?, ?, ?, ?)`).run(gid, String(digestType), String(periodKey), String(sentAt))
  return { ok: true }
}

function formatRank(rows = [], suffix = '次') {
  if (!rows.length) return '暂无'
  return rows.slice(0, 5).map((row, index) => `${index + 1}. ${row.name || '未知成员'} ${Number(row.value || 0)}${suffix}`).join('\n')
}

function formatTime(iso = '') {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return String(iso).slice(0, 16)
  return d.toLocaleString('zh-CN', { hour12: false, month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export function buildWeChatGroupStatsDigest(stats = {}, { mode = 'interval', include = {} } = {}) {
  if (!stats?.ok) return '群统计生成失败：没有可用数据。'
  const totals = stats.totals || {}
  const name = stats.group_name || stats.group_id || '本群'
  const title = mode === 'daily' ? `📊 ${name} 今日群聊日报` : `🧾 ${name} 群聊阶段总结`
  const includeRank = key => include[key] !== false
  const highlights = (stats.important || []).slice(-8).map(row => `- ${formatTime(row.timestamp).slice(6)} ${row.sender_name || row.sender_id || '群成员'}：${String(row.display_text || '').slice(0, 90)}`)
  const lines = [
    title,
    `时间：${formatTime(stats.from)} ~ ${formatTime(stats.to)}`,
    `总量：${totals.message_count || 0} 条消息 / ${totals.participant_count || 0} 人参与 / 图片 ${totals.image_count || 0} / 表情 ${totals.emoji_count || 0} / 链接 ${totals.link_count || 0}`,
  ]
  if (includeRank('messageLeaderboard')) lines.push(`\n💬 发言榜\n${formatRank(stats.leaderboards?.messages, '条')}`)
  if (includeRank('imageLeaderboard')) lines.push(`\n🖼 发图榜\n${formatRank(stats.leaderboards?.images, '张')}`)
  if (includeRank('emojiLeaderboard')) lines.push(`\n😄 表情榜\n${formatRank(stats.leaderboards?.emojis, '个')}`)
  if (includeRank('linkLeaderboard')) lines.push(`\n🔗 链接榜\n${formatRank(stats.leaderboards?.links, '条')}`)
  if (includeRank('bragLeaderboard')) lines.push(`\n😎 装逼榜（启发式统计）\n${formatRank(stats.leaderboards?.brag, '次')}`)
  lines.push(highlights.length ? `\n📌 重点/待办线索\n${highlights.join('\n')}` : '\n📌 重点/待办线索\n暂未发现明显决定、待办或风险关键词。')
  return lines.join('\n').slice(0, 1800)
}
