import { getWeChatGroupDigestConfig } from '../config.js'
import { nowTimestamp } from '../time.js'
import { getWechatyDutyGroupStatus, sendWechatyDutyGroupMessage } from './wechaty-duty-group.js'
import { buildWeChatGroupStatsDigest, getWeChatGroupStats, hasDigestBeenSent, markDigestSent, normalizeStatsGroupId } from './wechat-group-stats.js'
import { recordWeChatGroupAssistantReply } from './wechat-group-memory.js'

let digestTimer = null
let digestRunning = false

function localDateKey(date = new Date()) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function localMinute(date = new Date()) {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

function intervalPeriodKey(minutes = 180, date = new Date()) {
  const ms = Math.max(Number(minutes || 180), 1) * 60 * 1000
  return `${minutes}m:${Math.floor(date.getTime() / ms)}`
}

function includeConfig(cfg = {}) {
  return {
    messageLeaderboard: cfg.messageLeaderboard !== false,
    imageLeaderboard: cfg.imageLeaderboard !== false,
    emojiLeaderboard: cfg.emojiLeaderboard !== false,
    linkLeaderboard: cfg.linkLeaderboard !== false,
    bragLeaderboard: cfg.bragLeaderboard !== false,
  }
}

function resolveWechatyDigestGroups() {
  const cfg = getWeChatGroupDigestConfig()
  const selected = Array.isArray(cfg.selectedGroups) ? cfg.selectedGroups.map(v => String(v || '').trim()).filter(Boolean) : []
  if (!selected.length) return []
  const status = getWechatyDutyGroupStatus()
  const rooms = Array.isArray(status.rooms) ? status.rooms : []
  const roomIds = status.room_ids && typeof status.room_ids === 'object' ? status.room_ids : {}
  const cachedRoomIds = status.cached_room_ids && typeof status.cached_room_ids === 'object' ? status.cached_room_ids : {}
  const rows = []
  const seen = new Set()
  for (const room of rooms) {
    if (!room?.topic || room.selected !== true) continue
    const rid = roomIds[room.topic] || room.id || cachedRoomIds[room.topic] || ''
    if (!rid) continue
    const gid = normalizeStatsGroupId(`wechaty:${rid}`)
    if (!gid || seen.has(gid) || !matchesSelectedDigestGroup({ groupId: gid, groupName: room.topic, roomId: rid }, selected)) continue
    seen.add(gid)
    rows.push({ groupId: gid, groupName: room.topic, roomId: rid })
  }
  for (const [topic, rid] of Object.entries(roomIds)) {
    if (!topic || !rid) continue
    const gid = normalizeStatsGroupId(`wechaty:${rid}`)
    if (!gid || seen.has(gid) || !matchesSelectedDigestGroup({ groupId: gid, groupName: topic, roomId: rid }, selected)) continue
    seen.add(gid)
    rows.push({ groupId: gid, groupName: topic, roomId: rid })
  }
  return rows
}

function matchesSelectedDigestGroup({ groupId = '', groupName = '', roomId = '' } = {}, selected = []) {
  const gid = normalizeStatsGroupId(groupId)
  const rid = String(roomId || '').trim()
  const name = String(groupName || '').trim()
  return selected.some(item => {
    const value = String(item || '').trim()
    if (!value) return false
    const normalized = normalizeStatsGroupId(value)
    return value === gid
      || normalized === gid
      || value === rid
      || normalized === rid
      || value === `wechaty:${rid}`
      || normalized === `wechaty:${rid}`
      || (!!name && value === name)
  })
}

function rangeForMode(mode, cfg = {}, now = new Date()) {
  if (mode === 'daily') {
    const from = new Date(now)
    from.setHours(0, 0, 0, 0)
    return { from: from.toISOString(), to: now.toISOString() }
  }
  const minutes = Math.max(Number(cfg.intervalMinutes || 180), 30)
  return { from: new Date(now.getTime() - minutes * 60 * 1000).toISOString(), to: now.toISOString() }
}

export async function sendWeChatGroupDigestNow({ groupId, groupName = '', roomId = '', mode = 'interval', markSent = false, periodKey = '' } = {}) {
  const gid = normalizeStatsGroupId(groupId)
  if (!gid) return { ok: false, error: 'group_id required' }
  const cfg = getWeChatGroupDigestConfig()
  const now = new Date()
  const range = rangeForMode(mode, cfg, now)
  const stats = getWeChatGroupStats({ groupId: gid, from: range.from, to: range.to, limit: 8 })
  const summary = buildWeChatGroupStatsDigest({ ...stats, group_name: groupName || stats.group_name }, { mode, include: includeConfig(cfg) })
  if (!roomId) {
    const groups = resolveWechatyDigestGroups()
    const found = groups.find(group => normalizeStatsGroupId(group.groupId) === gid || group.groupName === groupName)
    roomId = found?.roomId || ''
    groupName = groupName || found?.groupName || ''
  }
  if (!roomId) return { ok: false, error: '没有找到可发送的 Wechaty roomId，请确认微信群助手真实在线并已勾选该群。', summary, stats }
  const result = await sendWechatyDutyGroupMessage(roomId, summary)
  if (result?.ok) {
    if (markSent && periodKey) markDigestSent({ groupId: gid, digestType: mode, periodKey, sentAt: nowTimestamp() })
    recordWeChatGroupAssistantReply({ groupId: gid, groupName, reply: summary, targetMemberName: '群聊定时总结', source: `wechat-${mode}-digest` }).catch(() => {})
  }
  return { ok: !!result?.ok, group_id: gid, group_name: groupName, room_id: roomId, summary, stats, sendResult: result }
}

async function maybeSend(mode, group, periodKey) {
  if (!group?.groupId || !periodKey) return null
  if (hasDigestBeenSent({ groupId: group.groupId, digestType: mode, periodKey })) return { ok: true, skipped: true, reason: 'already_sent', mode, group_id: group.groupId, periodKey }
  return sendWeChatGroupDigestNow({ groupId: group.groupId, groupName: group.groupName, roomId: group.roomId, mode, markSent: true, periodKey })
}

export async function runWeChatGroupDigestTick({ force = false } = {}) {
  if (digestRunning) return { ok: false, skipped: true, reason: 'digest_tick_running' }
  digestRunning = true
  try {
    const cfg = getWeChatGroupDigestConfig()
    if (!cfg.enabled && !force) return { ok: true, skipped: true, reason: 'digest_disabled' }
    const groups = resolveWechatyDigestGroups()
    if (!groups.length) return { ok: true, skipped: true, reason: 'no_digest_groups_selected' }
    const now = new Date()
    const results = []
    if ((cfg.intervalEnabled || force) && Number(cfg.intervalMinutes) > 0) {
      const periodKey = intervalPeriodKey(cfg.intervalMinutes, now)
      for (const group of groups) results.push(await maybeSend('interval', group, periodKey))
    }
    if ((cfg.dailyStatsEnabled || force) && (force || localMinute(now) === cfg.dailyStatsTime)) {
      const periodKey = localDateKey(now)
      for (const group of groups) results.push(await maybeSend('daily', group, periodKey))
    }
    return { ok: true, groups: groups.length, results: results.filter(Boolean) }
  } finally {
    digestRunning = false
  }
}

export function startWeChatGroupDigestScheduler() {
  if (digestTimer) return { ok: true, already_running: true }
  digestTimer = setInterval(() => {
    runWeChatGroupDigestTick().catch(err => console.warn(`[WechatDigest] 定时总结失败：${err?.message || err}`))
  }, 60 * 1000)
  // 启动后延迟检查一次：避免刚启动时错过已经到达的整点窗口。
  setTimeout(() => runWeChatGroupDigestTick().catch(() => {}), 15 * 1000)
  return { ok: true }
}

export function stopWeChatGroupDigestScheduler() {
  if (digestTimer) clearInterval(digestTimer)
  digestTimer = null
  return { ok: true }
}
