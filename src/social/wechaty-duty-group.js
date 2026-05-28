import qrcodeTerminal from 'qrcode-terminal'
import { WechatyBuilder, ScanStatus } from 'wechaty'
import { PuppetWechat4u } from 'wechaty-puppet-wechat4u'
import { FileBox } from 'file-box'
import { archiveWeChatGroupMessage, buildWeChatGroupCommandPrompt, formatGroupLine, makeWeChatGroupExternalId, WECHAT_GROUP_CHANNEL } from './wechat-groups.js'
import { getWechatyDutyGroupConfig, setWechatyDutyGroupRuntime } from '../config.js'
import { recordWeChatGroupMessage, recordWeChatGroupAssistantReply, recordWeChatGroupExplicitMemories } from './wechat-group-memory.js'
import { isWeChatInternalIdLike, listWeChatGroupMembers, normalizeWechatMessageType, normalizeWeChatGroupDisplayText, recordWeChatGroupActivity, upsertWeChatGroupMemberName } from './wechat-group-stats.js'
import { checkWeChatGroupCommandSafety } from './wechat-command-guard.js'
import { paths } from '../paths.js'
import path from 'path'
import fs from 'fs'

const FALLBACK_GROUP_NAMES = ['值班群', 'PT站看片狂魔小群']
const WECHATY_MEMORY_NAME = path.join(paths.userDir, 'wechaty-duty-group')
const WECHATY_MEMORY_FILE = `${WECHATY_MEMORY_NAME}.memory-card.json`
const WECHAT_MEDIA_DIR = path.join(paths.dataDir, 'wechat-media')
const ROOM_REFRESH_STALE_MS = 2 * 60 * 1000
const MESSAGE_HEALTH_STALE_MS = 10 * 60 * 1000
const MEMBER_NAME_REFRESH_STALE_MS = 10 * 60 * 1000
const START_WATCHDOG_MS = 60 * 1000
const OFFLINE_DETECT_INTERVAL_MS = 30 * 1000
const STARTING_RELOGIN_REQUIRED_MS = 90 * 1000
const PUBLIC_IMAGE_URL_RE = /^https?:\/\/[^\s<>"'`]+\.(?:png|jpe?g|gif|webp)(?:[?#][^\s<>"'`]*)?$/iu
const LOCAL_FILE_REFERENCE_RE = /(?:file:\/\/|\/Users\/|~\/|[A-Za-z]:\\|(?:桌面|下载|文档|相册|截图|本机|本地).{0,20}(?:图片|文件|照片|截图))/iu

let bot = null
let status = 'idle' // idle | starting | qr_ready | logged_in | connected | error
let lastQr = ''
let lastQrAscii = ''
let lastError = ''
let wechatyGroupReplyEnabled = getWechatyDutyGroupConfig().enabled !== false
let targetGroupNames = getConfiguredGroupNames()
let targetRoomId = ''
let targetRoom = null
const targetRooms = new Map()
let pushMessageRef = null
let emitEventRef = null
let lastLoginUser = ''
let roomSnapshot = []
let lastRoomRefreshAt = ''
let lastMessageAt = ''
let activePuppetName = ''
let reconnectTimer = null
let reconnectAttempts = 0
let suppressReconnectUntil = 0
let startWatchdogTimer = null
let offlineDetectTimer = null
let connectionAttemptStartedAt = 0
let lastOfflineAlertKey = ''
const memberNameRefreshAt = new Map()

export function extractPublicImageUrlsFromWechatText(content = '') {
  const text = String(content || '')
  const urls = new Set()
  for (const match of text.matchAll(/!\[[^\]]*\]\((https?:\/\/[^)\s]+)\)/giu)) {
    if (PUBLIC_IMAGE_URL_RE.test(match[1])) urls.add(match[1])
  }
  for (const match of text.matchAll(/https?:\/\/[^\s<>"'`）)]+/giu)) {
    const url = match[0].replace(/[。。，，、；;]+$/u, '')
    if (PUBLIC_IMAGE_URL_RE.test(url)) urls.add(url)
  }
  return [...urls].slice(0, 3)
}

function stripImageMarkdown(content = '', imageUrls = []) {
  let text = String(content || '')
  for (const url of imageUrls) {
    text = text.replace(new RegExp(`!\\\\[[^\\\\]]*\\\\]\\\\(${url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\\\)`, 'g'), '')
  }
  return text.replace(/\n{3,}/g, '\n\n').trim()
}

function makeWechatyGroupReplyTargetId(roomId = '', senderId = '', senderName = '') {
  const roomKey = encodeURIComponent(String(roomId || 'unknown-room').trim())
  const memberKey = encodeURIComponent(String(senderId || senderName || 'unknown-member').trim())
  return `wechaty:room:${roomKey}:member:${memberKey}`
}

async function resolveWechatyMentionContact(room, mentionId = '') {
  const wanted = String(mentionId || '').trim()
  if (!wanted || !room || !bot) return null

  // 优先从“当前群成员列表”按 contact.id 精确找人。
  // 不能用昵称/备注兜底，否则群成员改名或同名时又会 @ 错人。
  try {
    const members = await room.memberAll()
    const found = (members || []).find(contact => getWechatyContactId(contact) === wanted)
    if (found) return found
  } catch {}

  // Contact.load 是按微信内部 UserName 精确加载；如果拿不到成员对象就宁可不 @，
  // 也不要按名字模糊查，避免把回复错 @ 到上一位提问人/管理员。
  try {
    const loaded = bot.Contact.load?.(wanted)
    if (loaded) {
      const loadedId = getWechatyContactId(loaded)
      if (!loadedId || loadedId === wanted) return loaded
    }
  } catch {}
  try {
    const found = await bot.Contact.find?.({ id: wanted })
    if (found && getWechatyContactId(found) === wanted) return found
  } catch {}
  return null
}
restoreRuntimeSnapshot()

function isLoginActive() {
  return status === 'logged_in' || status === 'connected'
}

function isConnectedStatus() {
  return status === 'connected'
}

function ageMs(iso = '') {
  const ts = Date.parse(String(iso || ''))
  if (!Number.isFinite(ts)) return Infinity
  return Date.now() - ts
}

function isFreshRoomRefresh() {
  return ageMs(lastRoomRefreshAt) <= ROOM_REFRESH_STALE_MS
}

function isMessageHealthy() {
  return !!lastMessageAt && ageMs(lastMessageAt) <= MESSAGE_HEALTH_STALE_MS
}

function hasCurrentResolvedRooms() {
  return !!targetRoomId && targetRooms.size > 0
}

function isTrulyOnline() {
  // “在线”必须代表当前进程真的能接入群，而不是只保存了历史登录用户/历史群快照。
  // connected + 当前 room 对象 + 最近刷新/收到消息，才允许 UI 显示为可用。
  return !!bot && isConnectedStatus() && hasCurrentResolvedRooms() && (isFreshRoomRefresh() || isMessageHealthy())
}

function emitWechatyStatusEvent(extra = {}) {
  emitEventRef?.('social_status', {
    platform: 'wechaty-duty-group',
    status: extra.status || status,
    group_names: [...targetGroupNames],
    online: isTrulyOnline(),
    rooms_stale: !!roomSnapshot.length && !isTrulyOnline(),
    needs_relogin: needsWechatyRelogin(),
    hint: getConnectionHint({ online: isTrulyOnline(), rooms: roomSnapshot }),
    rooms: roomSnapshot,
    login_user: isLoginActive() ? previousLoginUser() : '',
    last_login_user: previousLoginUser(),
    ...extra,
  })
}

function notifyWechatyOffline(reason = '', { force = false } = {}) {
  const key = `${status}:${reason}:${lastQr ? 'qr' : 'noqr'}`
  if (!force && key === lastOfflineAlertKey) return
  lastOfflineAlertKey = key
  const hint = getConnectionHint({ online: false, rooms: roomSnapshot })
  console.warn(`[Wechaty] 离线提醒：${hint}${reason ? ` (${reason})` : ''}`)
  try {
    globalThis.bailongmaAppControl?.notify?.({
      title: '微信群助手已离线',
      body: hint || '微信群助手当前不可接收 @ 消息，请重新扫码登录。',
      urgency: 'critical',
      showWindow: true,
    })
  } catch {}
  emitWechatyStatusEvent({ alert: 'offline', reason, error: lastError })
}

function needsWechatyRelogin() {
  if (isTrulyOnline()) return false
  if (status === 'qr_ready') return false
  if (status === 'starting' && connectionAttemptStartedAt && Date.now() - connectionAttemptStartedAt > STARTING_RELOGIN_REQUIRED_MS) return true
  return ['logged_in', 'connected', 'rooms_stale', 'group_lookup_error', 'rooms_pending', 'group_not_found', 'error', 'disconnected', 'relogin_required'].includes(status)
}

function startOfflineDetector() {
  if (offlineDetectTimer) return
  offlineDetectTimer = setInterval(() => {
    if (!wechatyGroupReplyEnabled) return
    if (isTrulyOnline()) {
      lastOfflineAlertKey = ''
      return
    }
    if (needsWechatyRelogin()) {
      if (status === 'starting') {
        status = 'relogin_required'
        lastError = lastError || '微信登录态恢复超时，需要重新扫码。'
        persistRuntime(status)
      }
      notifyWechatyOffline('health_check')
    }
  }, OFFLINE_DETECT_INTERVAL_MS)
}

function stopOfflineDetector() {
  if (offlineDetectTimer) clearInterval(offlineDetectTimer)
  offlineDetectTimer = null
}

function previousLoginUser() {
  try {
    const runtime = getWechatyDutyGroupConfig().runtime || {}
    return lastLoginUser || String(runtime.loginUser || '')
  } catch {
    return lastLoginUser || ''
  }
}

function hasResolvedRooms() {
  // 这里只能看当前进程实际解析到的 room，不能看 roomSnapshot。
  // roomSnapshot 是上次运行留下的 UI 快照；如果把它当成当前在线证据，
  // 重启后等待扫码时遇到 wechat4u 暂态错误会被误标成 logged_in。
  return !!targetRoomId || targetRooms.size > 0
}

function clearStartWatchdog() {
  if (startWatchdogTimer) clearTimeout(startWatchdogTimer)
  startWatchdogTimer = null
}

function armStartWatchdog(currentBot) {
  clearStartWatchdog()
  startWatchdogTimer = setTimeout(async () => {
    startWatchdogTimer = null
    if (bot !== currentBot) return
    if (isTrulyOnline() || status !== 'starting') return
    console.warn(`[Wechaty] 启动 ${Math.round(START_WATCHDOG_MS / 1000)} 秒仍未拿到二维码/登录事件，自动重启 Wechaty 连接，避免卡在 starting 导致群消息不入库。`)
    try {
      await stopWechatyGroupOnly()
      await startWechatyDutyGroupConnector({ pushMessage: pushMessageRef, emitEvent: emitEventRef, groupNames: targetGroupNames, enabled: true })
    } catch (err) {
      lastError = err?.message || String(err)
      persistRuntime('error')
      scheduleReconnect('start_watchdog_failed')
    }
  }, START_WATCHDOG_MS)
}

function isWechat4uTransientError(message = '') {
  const value = String(message || '').trim()
  return /^-?1\s*==\s*0$/i.test(value)
    || /^400\s*!=\s*400$/i.test(value)
    || /batchGetContact|contactRawPayload|unknownContactId/i.test(value)
}

function escapeRegExp(value = '') {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function textMentionsLoginUser(text = '') {
  const value = String(text || '')
  const names = [...new Set([lastLoginUser, previousLoginUser()].map(v => String(v || '').trim()).filter(Boolean))]
  if (!names.length) return false
  return names.some(name => new RegExp(`[@＠]\\s*${escapeRegExp(name)}(?=$|[\\s\\u2005\\u2006\\u2007\\u2008\\u2009\\u200a,，:：、])`, 'iu').test(value))
}

function getConnectionHint({ online = isTrulyOnline(), rooms = roomSnapshot } = {}) {
  if (online) return '已真实接入微信群，可以接收 @ 消息。'
  if (status === 'qr_ready') return '等待扫码登录。'
  if (status === 'starting') return '正在启动/恢复微信登录。'
  if (status === 'connected' && !isFreshRoomRefresh() && !isMessageHealthy()) return '当前只保留了历史群列表，最近没有真实刷新/消息心跳；如果群里 @ 无回复，请强制重新扫码。'
  if ((status === 'logged_in' || status === 'connected') && !hasCurrentResolvedRooms()) return '微信登录态可能存在，但当前进程没有真实接入目标群；请刷新真实群列表或强制重新扫码。'
  if (status === 'rooms_stale') return '没有获取到真实群列表；下方仅为上次缓存，请强制重新扫码。'
  if (status === 'group_lookup_error') return '查找微信群失败，请刷新群列表；如果持续失败请强制重新扫码。'
  if (status === 'rooms_pending') return '已登录但还没有拿到真实群列表，请稍等或强制重新扫码。'
  if (status === 'group_not_found') return '已登录但没有找到已勾选的群，请确认该微信在群里，或重新扫码。'
  if (status === 'disconnected') return '微信连接已断开，请重新登录。'
  if (status === 'error') return '微信连接异常，请强制重新扫码。'
  if (rooms?.length) return '未连接；下方仅为上次缓存的群列表。'
  return '未登录。'
}

export function getWechatyDutyGroupStatus() {
  const runtime = getWechatyDutyGroupConfig().runtime || {}
  const rooms = roomSnapshot.length
    ? roomSnapshot
    : (Array.isArray(runtime.rooms) ? markSelectedRooms(runtime.rooms) : [])
  const runtimeRoomIds = runtime.roomIds && typeof runtime.roomIds === 'object' ? runtime.roomIds : {}
  const roomIds = Object.keys(runtimeRoomIds).length
    ? runtimeRoomIds
    : Object.fromEntries([...targetRooms.entries()].map(([name, room]) => [name, room?.id || '']))
  const online = isTrulyOnline()
  const currentRoomIds = Object.fromEntries([...targetRooms.entries()].map(([name, room]) => [name, room?.id || '']))
  const stale = !!rooms.length && !online
  return {
    status,
    connection_state: online ? 'online' : (needsWechatyRelogin() ? 'offline' : (status === 'qr_ready' ? 'qr_ready' : 'connecting')),
    enabled: wechatyGroupReplyEnabled,
    group_name: targetGroupNames[0] || '',
    group_names: [...targetGroupNames],
    room_id: online ? targetRoomId : '',
    room_ids: online ? currentRoomIds : {},
    cached_room_ids: roomIds,
    qr: lastQr,
    qr_ascii: lastQrAscii,
    error: lastError,
    online,
    login_user: isLoginActive() ? previousLoginUser() : '',
    last_login_user: previousLoginUser(),
    room_count: online ? rooms.length : 0,
    cached_room_count: rooms.length,
    rooms,
    rooms_stale: stale,
    needs_relogin: needsWechatyRelogin(),
    hint: getConnectionHint({ online, rooms }),
    last_room_refresh_at: lastRoomRefreshAt || String(runtime.lastRoomRefreshAt || ''),
    last_message_at: lastMessageAt || String(runtime.lastMessageAt || ''),
    health: {
      current_room_count: targetRooms.size,
      has_current_room: hasCurrentResolvedRooms(),
      room_refresh_fresh: isFreshRoomRefresh(),
      message_healthy: isMessageHealthy(),
      room_refresh_age_ms: Number.isFinite(ageMs(lastRoomRefreshAt)) ? ageMs(lastRoomRefreshAt) : null,
      message_age_ms: Number.isFinite(ageMs(lastMessageAt)) ? ageMs(lastMessageAt) : null,
    },
    puppet: activePuppetName || String(runtime.puppet || ''),
    login_memory: getWechatyMemoryState(),
  }
}

export function configureWechatyDutyGroup({ groupName, groupNames, enabled } = {}) {
  if (enabled !== undefined) wechatyGroupReplyEnabled = enabled !== false
  targetGroupNames = normalizeGroupNames(groupNames ?? groupName)
  roomSnapshot = markSelectedRooms(roomSnapshot)
  for (const [name, room] of [...targetRooms.entries()]) {
    if (!targetGroupNames.some(target => name === target || name.includes(target) || target.includes(name))) targetRooms.delete(name)
  }
  targetRoom = [...targetRooms.values()][0] || targetRoom
  targetRoomId = targetRoom?.id || targetRoomId
  persistRuntime(status)
  return getWechatyDutyGroupStatus()
}


export async function sendWechatyDutyGroupMessage(roomId, content, opts = {}) {
  if (!bot || status !== 'connected') return { ok: false, reason: 'wechaty-duty-group not connected' }
  const rid = String(roomId || targetRoomId || '').trim()
  if (!rid) return { ok: false, reason: 'room id missing' }
  try {
    let room = (rid === targetRoomId && targetRoom) ? targetRoom : null
    if (!room) {
      for (const cached of targetRooms.values()) {
        if (cached?.id === rid) { room = cached; break }
      }
    }
    if (!room) {
      try { room = bot.Room.load?.(rid) || null } catch {}
    }
    if (!room && rid === targetRoomId) room = await resolveTargetRooms()
    if (!room) return { ok: false, reason: `room not found: ${rid}` }
    const mentionId = String(opts.mentionId || '').trim()
    const mentionName = String(opts.mentionName || '').trim()
    const body = String(content || '')
    const mentionContact = mentionId ? await resolveWechatyMentionContact(room, mentionId) : null
    if (mentionId) {
      console.log(`[Wechaty] 准备发送群回复 room="${rid}" mention_id="${mentionId}" mention_name="${mentionName || ''}" resolved=${mentionContact ? 'yes' : 'no'}`)
    }
    if (LOCAL_FILE_REFERENCE_RE.test(body)) {
      const refusal = '为了保护机主隐私，微信群里不能发送或描述本机文件、桌面图片、截图、相册或 file:// 路径。可以发送公开网络图片链接。'
      if (mentionContact) {
        await room.say(refusal, mentionContact)
      } else {
        await room.say(refusal)
      }
      return { ok: false, blocked: true, reason: 'local_file_reference_in_wechat_outbound' }
    }
    const imageUrls = extractPublicImageUrlsFromWechatText(body)
    const textBody = imageUrls.length ? stripImageMarkdown(body, imageUrls) : body
    // 表情包/斗图场景不要把图片 URL 当文字发到群里；微信里应只看到图片/GIF。
    // 若模型额外写了自然语言说明，则先 @ 提问人发一句短文字；纯图片回复则完全不发链接文本。
    if (textBody.trim()) {
      if (mentionContact) {
        await room.say(textBody, mentionContact)
      } else {
        await room.say(textBody)
      }
    }
    const imageResults = await Promise.allSettled(imageUrls.map(async url => {
      await room.say(FileBox.fromUrl(url))
      return url
    }))
    for (let i = 0; i < imageResults.length; i++) {
      const result = imageResults[i]
      if (result.status === 'rejected') {
        console.warn(`[Wechaty] 公开网络图片发送失败：${imageUrls[i]} ${result.reason?.message || result.reason}`)
      }
    }
    const sentImages = imageResults.filter(item => item.status === 'fulfilled').length
    if (!textBody.trim() && !sentImages) return { ok: false, platform: 'wechaty-duty-group', roomId: rid, reason: 'no text or image sent' }
    return { ok: true, platform: 'wechaty-duty-group', roomId: rid, images: sentImages }
  } catch (err) {
    console.error(`[Wechaty] 群消息发送失败：${err?.message || err}`)
    return { ok: false, error: err?.message || String(err) }
  }
}

export async function listWechatyDutyGroupRooms() {
  if (!bot || !isLoginActive()) {
    const reason = status === 'qr_ready'
      ? 'waiting for qr scan'
      : status === 'starting'
        ? 'wechaty-duty-group starting'
        : 'wechaty-duty-group not logged in'
    return { ok: false, status, enabled: wechatyGroupReplyEnabled, group_names: [...targetGroupNames], rooms: roomSnapshot, rooms_stale: roomSnapshot.length > 0, online: false, login_user: '', last_login_user: previousLoginUser(), last_room_refresh_at: lastRoomRefreshAt, error: reason, hint: getConnectionHint({ online: false, rooms: roomSnapshot }) }
  }
  try {
    const rooms = await bot.Room.findAll()
    const items = []
    for (const room of rooms) {
      const topic = await safeTopic(room)
      if (!topic) continue
      items.push({ id: room.id, topic, selected: isAllowedGroupTopic(topic) })
    }
    if (items.length) {
      roomSnapshot = markSelectedRooms(items)
      lastRoomRefreshAt = new Date().toISOString()
      roomSnapshot.sort((a, b) => Number(b.selected) - Number(a.selected) || a.topic.localeCompare(b.topic, 'zh-Hans-CN'))
      persistRuntime(status)
      return { ok: true, status, enabled: wechatyGroupReplyEnabled, group_names: [...targetGroupNames], rooms: roomSnapshot, rooms_stale: false, online: isTrulyOnline(), login_user: previousLoginUser(), last_login_user: previousLoginUser(), last_room_refresh_at: lastRoomRefreshAt, fresh: true, hint: getConnectionHint({ online: isTrulyOnline(), rooms: roomSnapshot }) }
    }

    // 关键：这里不能再 ok:true。旧 roomSnapshot 只能当“历史缓存”展示，不能叫“刷新成功”。
    if (roomSnapshot.length) {
      console.warn('[Wechaty] 本次未获取到群列表，仅返回上次缓存；当前连接不可确认。')
    }
    lastError = '未获取到真实群列表；当前只显示上次缓存，可能需要重新扫码。'
    persistRuntime('rooms_stale')
    return { ok: false, status: 'rooms_stale', enabled: wechatyGroupReplyEnabled, group_names: [...targetGroupNames], rooms: roomSnapshot, rooms_stale: true, online: false, login_user: isLoginActive() ? previousLoginUser() : '', last_login_user: previousLoginUser(), last_room_refresh_at: lastRoomRefreshAt, fresh: false, error: lastError, hint: getConnectionHint({ online: false, rooms: roomSnapshot }) }
  } catch (err) {
    lastError = err?.message || String(err)
    return { ok: false, status, enabled: wechatyGroupReplyEnabled, group_names: [...targetGroupNames], rooms: roomSnapshot, rooms_stale: roomSnapshot.length > 0, online: false, login_user: isLoginActive() ? previousLoginUser() : '', last_login_user: previousLoginUser(), error: lastError, hint: getConnectionHint({ online: false, rooms: roomSnapshot }) }
  }
}

export async function restartWechatyDutyGroupConnector(opts = {}) {
  await stopWechatyDutyGroupConnector()
  return startWechatyDutyGroupConnector(opts)
}

export async function forceReloginWechatyDutyGroupConnector(opts = {}) {
  clearReconnectTimer()
  await stopWechatyDutyGroupConnector({ preserveRuntime: true })
  try { fs.rmSync(WECHATY_MEMORY_FILE, { force: true }) } catch {}
  try { fs.writeFileSync(WECHATY_MEMORY_FILE, '{}') } catch {}
  lastQr = ''
  lastQrAscii = ''
  lastError = '已清空微信登录态，请重新扫码。'
  lastMessageAt = ''
  targetRoomId = ''
  targetRoom = null
  targetRooms.clear()
  status = 'idle'
  persistRuntime('relogin_required')
  return startWechatyDutyGroupConnector(opts)
}

export async function stopWechatyDutyGroupConnector(options = {}) {
  suppressReconnect(8000)
  clearReconnectTimer()
  if (!options.preserveRuntime) stopOfflineDetector()
  status = 'idle'
  lastQr = ''
  lastQrAscii = ''
  lastMessageAt = ''
  targetRoomId = ''
  targetRoom = null
  targetRooms.clear()
  try { await bot?.stop?.() } catch {}
  bot = null
  if (!options.preserveRuntime) persistRuntime(status)
  emitEventRef?.('social_status', { platform: 'wechaty-duty-group', status: 'idle' })
}

export async function startWechatyDutyGroupConnector({ pushMessage, emitEvent, groupName, groupNames, enabled } = {}) {
  pushMessageRef = pushMessage || pushMessageRef
  emitEventRef = emitEvent || emitEventRef
  if (groupNames || groupName || enabled !== undefined) configureWechatyDutyGroup({ groupNames, groupName, enabled })
  if (bot && status !== 'idle' && status !== 'error') return { platform: 'wechaty-duty-group', stop: stopWechatyDutyGroupConnector }
  if (bot) {
    await stopWechatyGroupOnly()
    bot = null
  }

  clearReconnectTimer()
  status = 'starting'
  connectionAttemptStartedAt = Date.now()
  lastOfflineAlertKey = ''
  lastError = ''
  persistRuntime(status)
  lastQr = ''
  lastQrAscii = ''
  targetRoomId = ''
  targetRoom = null
  targetRooms.clear()

  const puppet = createWechatyPuppet()
  bot = WechatyBuilder.build({
    name: WECHATY_MEMORY_NAME,
    puppet,
  })

  bot.on('scan', (qrcode, scanStatus) => {
    clearStartWatchdog()
    status = 'qr_ready'
    lastQr = qrcode
    lastQrAscii = qrToAscii(qrcode)
    const label = ScanStatus?.[scanStatus] || scanStatus
    console.log(`[Wechaty] 请扫码登录微信，目标群：${targetGroupNames.join('、')}，状态：${label}`)
    try { qrcodeTerminal.generate(qrcode, { small: true }) } catch {}
    persistRuntime(status)
    emitEventRef?.('social_status', { platform: 'wechaty-duty-group', status, group_names: [...targetGroupNames], qr: qrcode, qr_ascii: lastQrAscii })
  })

  bot.on('login', async (user) => {
    clearStartWatchdog()
    status = 'logged_in'
    lastLoginUser = user?.name?.() || ''
    lastQr = ''
    lastQrAscii = ''
    console.log(`[Wechaty] 登录成功：${lastLoginUser}，正在查找群：${targetGroupNames.join('、')}`)
    reconnectAttempts = 0
    persistRuntime(status)
    emitEventRef?.('social_status', { platform: 'wechaty-duty-group', status, group_names: [...targetGroupNames], user: lastLoginUser })
    await resolveTargetRooms()
  })

  bot.on('ready', async () => {
    clearStartWatchdog()
    await resolveTargetRooms()
  })

  bot.on('logout', (user) => {
    status = 'disconnected'
    targetRoomId = ''
    console.log(`[Wechaty] 已断开/退出：${user?.name?.() || lastLoginUser || ''}`)
    persistRuntime(status)
    emitWechatyStatusEvent({ login_user: lastLoginUser })
    notifyWechatyOffline('logout', { force: true })
    if (!isReconnectSuppressed()) scheduleReconnect('logout')
  })

  bot.on('error', (err) => {
    clearStartWatchdog()
    lastError = err?.message || String(err)
    // wechat4u 登录后常见 `-1 == 0` / `400 != 400` 这类底层同步抖动。
    // 如果已经登录并解析到目标群，不能因为这个暂态错误主动 stop/restart；
    // 否则会把刚扫码成功的会话踢回二维码状态，群里 @ 自然收不到。
    if (isWechat4uTransientError(lastError)) {
      if (hasResolvedRooms() && (isFreshRoomRefresh() || isMessageHealthy())) {
        status = targetRoomId ? 'connected' : 'logged_in'
        console.warn(`[Wechaty] 忽略 wechat4u 暂态错误，保持当前连接：${lastError}`)
        persistRuntime(status)
        emitWechatyStatusEvent({ room_id: targetRoomId, warning: lastError })
        return
      }
      if (hasResolvedRooms()) {
        status = 'group_lookup_error'
        console.warn(`[Wechaty] wechat4u 暂态错误但连接健康过期，标记为需确认/重登：${lastError}`)
        persistRuntime(status)
        emitWechatyStatusEvent({ warning: lastError })
        return
      }
      if (status === 'qr_ready' || status === 'starting') {
        console.warn(`[Wechaty] 等待登录期间忽略 wechat4u 暂态错误：${lastError}`)
        persistRuntime(status)
        emitWechatyStatusEvent({ warning: lastError })
        return
      }
    }
    if (!targetRoomId) status = 'error'
    console.error(`[Wechaty] 错误：${lastError}`)
    persistRuntime(status)
    emitWechatyStatusEvent({ room_id: targetRoomId, error: lastError })
    notifyWechatyOffline('error')
    scheduleReconnect('error')
  })

  bot.on('message', handleMessage)

  startOfflineDetector()
  armStartWatchdog(bot)
  bot.start().catch(err => {
    clearStartWatchdog()
    status = 'error'
    lastError = err?.message || String(err)
    persistRuntime(status)
    console.error(`[Wechaty] 启动失败：${lastError}`)
    emitWechatyStatusEvent({ status: 'error', error: lastError })
    notifyWechatyOffline('start_failed')
  })

  return { platform: 'wechaty-duty-group', stop: stopWechatyDutyGroupConnector }
}

export async function syncWechatyDutyGroupRooms() {
  return resolveTargetRooms()
}

export async function refreshWechatyDutyGroupMemberNames({ force = true } = {}) {
  if (!targetRooms.size && bot && isLoginActive()) {
    await resolveTargetRooms().catch(() => null)
  }
  const results = []
  for (const [topic, room] of targetRooms.entries()) {
    if (!room?.id) continue
    if (force) memberNameRefreshAt.delete(`wechaty:${room.id}`)
    results.push(await refreshRoomMemberDisplayNames(room, topic, { force }))
  }
  const totals = results.reduce((acc, row) => ({
    rooms: acc.rooms + 1,
    members: acc.members + Number(row?.members || 0),
    named: acc.named + Number(row?.named || 0),
    updated: acc.updated + Number(row?.updated || 0),
  }), { rooms: 0, members: 0, named: 0, updated: 0 })
  return { ok: true, ...totals, results }
}

async function resolveTargetRooms() {
  if (!bot) return null
  if (!isLoginActive()) {
    console.log(`[Wechaty] 当前状态 ${status} 尚未登录，不刷新群列表，保留现有设置。`)
    persistRuntime(status)
    return null
  }
  let firstRoom = null
  try {
    const rooms = await bot.Room.findAll()
    const snapshot = []
    for (const candidate of rooms) {
      const topic = await safeTopic(candidate)
      if (topic) snapshot.push({ id: candidate.id, topic, selected: isAllowedGroupTopic(topic) })
    }
    if (snapshot.length) {
      roomSnapshot = markSelectedRooms(snapshot).sort((a, b) => Number(b.selected) - Number(a.selected) || a.topic.localeCompare(b.topic, 'zh-Hans-CN'))
      lastRoomRefreshAt = new Date().toISOString()
      persistRuntime(status)
    } else if (roomSnapshot.length) {
      console.warn('[Wechaty] 群列表暂时为空，仅保留上次缓存；当前连接不可确认。')
    }
    for (const name of targetGroupNames) {
      let room = null
      try { room = await bot.Room.find({ topic: name }) } catch {}
      if (!room) {
        for (const candidate of rooms) {
          const topic = await safeTopic(candidate)
          if (topic === name) { room = candidate; break }
        }
      }
      if (!room) {
        for (const candidate of rooms) {
          const topic = await safeTopic(candidate)
          if (topic.includes(name) || name.includes(topic)) { room = candidate; break }
        }
      }
      if (room) {
        targetRooms.set(name, room)
        if (!firstRoom) firstRoom = room
        const topic = await safeTopic(room)
        console.log(`[Wechaty] 已接入群：${topic} (${room.id})`)
        scheduleRoomMemberNameRefresh(room, topic)
      } else {
        console.warn(`[Wechaty] 已登录，但未找到群：${name}。请确认当前微信在该群里，或等群里发一条消息。`)
      }
    }
    if (!firstRoom && snapshot.length === 0) {
      status = 'logged_in'
      persistRuntime('rooms_pending')
      emitEventRef?.('social_status', { platform: 'wechaty-duty-group', status: 'rooms_pending', group_names: [...targetGroupNames], rooms: roomSnapshot })
      return null
    }
    if (!firstRoom) {
      status = 'logged_in'
      persistRuntime('group_not_found')
      emitEventRef?.('social_status', { platform: 'wechaty-duty-group', status: 'group_not_found', group_names: [...targetGroupNames], rooms: roomSnapshot })
      return null
    }
    targetRoom = firstRoom
    targetRoomId = firstRoom.id
    lastQr = ''
    lastQrAscii = ''
    status = 'connected'
    persistRuntime(status)
    emitEventRef?.('social_status', {
      platform: 'wechaty-duty-group',
      status,
      group_names: [...targetGroupNames],
      room_id: targetRoomId,
      room_ids: Object.fromEntries([...targetRooms.entries()].map(([name, room]) => [name, room?.id || ''])),
      room_count: roomSnapshot.length,
      rooms: roomSnapshot,
      last_room_refresh_at: lastRoomRefreshAt,
    })
    return firstRoom
  } catch (err) {
    lastError = err?.message || String(err)
    console.warn(`[Wechaty] 查找群失败：${lastError}`)
    persistRuntime('group_lookup_error')
    emitEventRef?.('social_status', { platform: 'wechaty-duty-group', status: 'group_lookup_error', group_names: [...targetGroupNames], error: lastError, rooms: roomSnapshot })
    return null
  }
}

async function handleMessage(message) {
  try {
    const isSelf = !!message.self?.()
    const room = message.room?.()
    if (!room) return
    const topic = await safeTopic(room)
    const assistantEnabledForGroup = isAllowedGroupTopic(topic)

    if (assistantEnabledForGroup) targetRooms.set(topic, room)
    scheduleRoomMemberNameRefresh(room, topic)
    if (assistantEnabledForGroup && !targetRoomId) {
      targetRoomId = room.id
      targetRoom = room
      status = 'connected'
      persistRuntime(status)
      emitEventRef?.('social_status', { platform: 'wechaty-duty-group', status, group_names: [...targetGroupNames], room_id: targetRoomId })
    }

    const rawText = String(message.text?.() || '').trim()
    let messageType = ''
    try { messageType = message.type?.() ?? '' } catch {}
    lastMessageAt = new Date().toISOString()
    const talker = message.talker?.()
    const rawWechatPayload = await getWechatRawMessagePayload(message)
    const rawSenderName = extractRawWechatSenderName(rawWechatPayload)
    const senderId = getWechatyContactId(talker)
    const senderParts = isSelf ? { displayName: '我', roomAlias: '', contactAlias: '', contactName: '我' } : await resolveWechatyMemberNameParts(room, talker, senderId)
    if (rawSenderName && !isWeChatInternalIdLike(rawSenderName) && senderParts.displayName === '未知成员') senderParts.displayName = rawSenderName
    const senderName = senderParts.displayName
    const groupId = `wechaty:${room.id}`
    const groupExternalId = makeWeChatGroupExternalId(groupId)
    if (senderId && senderName && senderName !== '未知成员') {
      try {
        upsertWeChatGroupMemberName({
          groupId,
          groupName: topic,
          senderId,
          displayName: senderName,
          roomAlias: senderParts.roomAlias || rawSenderName,
          contactAlias: senderParts.contactAlias,
          contactName: senderParts.contactName,
          source: 'wechaty-message',
        })
      } catch (err) {
        console.warn(`[WechatyStats] 更新成员昵称失败：${err?.message || err}`)
      }
    }
    let mediaInfo = null
    try { mediaInfo = await persistWechatMessageMedia(message, { groupId, groupName: topic, senderId }) } catch (err) { console.warn(`[WechatyStats] 保存群媒体失败：${err?.message || err}`) }
    const statsRawText = mediaInfo?.stored ? `${rawText || normalizeWeChatGroupDisplayText(rawText, messageType)}
[媒体文件] ${mediaInfo.relativePath}`.trim() : rawText
    let mentionedSelf = false
    try { mentionedSelf = !!(await message.mentionSelf?.()) } catch {}
    if (!mentionedSelf) mentionedSelf = textMentionsLoginUser(rawText)
    let activity = null
    try {
      activity = recordWeChatGroupActivity({
        groupId,
        groupName: topic,
        senderId: senderId || senderName,
        senderName,
        text: statsRawText,
        messageType,
        mentionedSelf,
        source: 'wechaty',
        // 聊天记录库是原始流水账：只要程序运行并收到微信群消息就必须入库。
        // 统计/日报的 selectedGroups 只控制“是否展示统计/是否定时发送总结”，
        // 不能反过来拦截原始聊天记录，否则用户一取消统计勾选就会误以为聊天记录丢失。
        force: true,
      })
    } catch (err) {
      console.warn(`[WechatyStats] 写入群统计失败：${err?.message || err}`)
    }
    const text = activity?.displayText || normalizeWeChatGroupDisplayText(rawText, messageType)
    if (!text) return

    if (!mentionedSelf) mentionedSelf = textMentionsLoginUser(rawText || text)
    console.log(`[Wechaty] 收到群消息 topic="${topic}" sender="${senderName}" self=${isSelf} mention=${mentionedSelf} text=${text.slice(0, 100)}`)

    // 本地聊天记录库已经完成无条件入库；非“微信群助手接入群”只记录，不进入 Honcho/LLM/自动回复链路。
    if (!assistantEnabledForGroup) return

    // 群消息先归档并写入当前群专属记忆库；默认不打扰、不回复。
    archiveWeChatGroupMessage({ groupId, senderId: senderName, text })
    recordWeChatGroupMessage({ groupId, groupName: topic, senderId: senderId || senderName, senderName, text, mentionedSelf, source: 'wechaty' }).catch(err => console.warn(`[Honcho] 写入群记忆失败：${err?.message || err}`))
    // 只要 @ 了当前扫码登录的微信号，就必须进入大模型。
    // 注意：这里不再做任何关键词/意图/内容二次过滤，也不做硬编码回复。
    if (!wechatyGroupReplyEnabled || !mentionedSelf) return

    console.log(`[Wechaty] 值班群消息${isSelf ? '（self）' : ''}${mentionedSelf ? '（@我）' : ''} ${senderName}: ${text.slice(0, 100)}`)

    const adminVerified = isWechatyGroupAdminSender(senderId)
    const adminProtectionReply = adminVerified ? '' : buildAdminProtectionReply({ groupId, groupName: topic, senderId, text })
    if (adminProtectionReply) {
      await sendWechatyDutyGroupMessage(room.id, adminProtectionReply, { mentionId: senderId, mentionName: senderName })
      recordWeChatGroupAssistantReply({ groupId, groupName: topic, reply: adminProtectionReply, targetMemberName: senderName, source: 'wechaty' }).catch(() => {})
      return
    }
    const safety = adminVerified ? { allowed: true, adminBypass: true } : checkWeChatGroupCommandSafety(text)
    if (!safety.allowed) {
      const refusal = safety.reason
      await sendWechatyDutyGroupMessage(room.id, refusal, { mentionId: senderId })
      recordWeChatGroupAssistantReply({ groupId, groupName: topic, reply: refusal, targetMemberName: senderName, source: 'wechaty' }).catch(() => {})
      return
    }
    if (adminVerified) {
      console.warn(`[WechatyAdmin] 管理员指令已通过精确 sender_id 验证，跳过微信群黑名单 topic="${topic}" sender="${senderName}" sender_id="${senderId}"`)
      emitEventRef?.('wechat_admin_command', { group_name: topic, room_id: room.id, sender_name: senderName, sender_id: senderId || '', text: text.slice(0, 300), timestamp: new Date().toISOString() })
    }

    recordWeChatGroupExplicitMemories({ groupId, groupName: topic, senderId: senderId || senderName, senderName, text, source: 'wechaty' })
      .then(result => {
        if (result?.count) console.log(`[Honcho] 已沉淀群显式记忆 topic="${topic}" sender="${senderName}" count=${result.count}`)
      })
      .catch(err => console.warn(`[Honcho] 显式群记忆写入失败：${err?.message || err}`))

    emitEventRef?.('message_in', {
      from_id: groupExternalId,
      content: formatGroupLine(senderName, text),
      channel: WECHAT_GROUP_CHANNEL,
      external_party_id: groupExternalId,
      social: { platform: 'wechaty-duty-group', group_name: topic, room_id: room.id, sender_name: senderName, sender_id: senderId || '', mentioned_self: mentionedSelf, reply_mention_id: senderId || '', reply_mention_name: senderName || '', user_text: text, raw_user_text: rawText || text, wechat_admin: adminVerified },
      timestamp: new Date().toISOString(),
    })

    const replyTargetId = makeWechatyGroupReplyTargetId(room.id, senderId || senderName, senderName)
    const replySocial = {
      platform: 'wechaty-duty-group',
      group_name: topic,
      room_id: room.id,
      sender_name: senderName,
      sender_id: senderId || '',
      mentioned_self: mentionedSelf,
      reply_mention_id: senderId || '',
      reply_mention_name: senderName || '',
      user_text: text,
      raw_user_text: rawText || text,
      wechat_admin: adminVerified,
    }
    const prompt = await buildWeChatGroupCommandPrompt({ groupId, groupName: topic, senderId: senderId || senderName, senderName, text, mentionedSelf: true, adminVerified, replyTargetId })
    pushMessageRef?.(replyTargetId, prompt, WECHAT_GROUP_CHANNEL, {
      noPersist: true,
      noPrune: true,
      noPreempt: true,
      externalPartyIdOverride: `wechaty:room:${room.id}`,
      groupArchiveId: groupExternalId,
      social: replySocial,
    })
  } catch (err) {
    console.warn(`[Wechaty] 处理群消息失败：${err?.message || err}`)
  }
}




async function getWechatRawMessagePayload(message) {
  try {
    if (bot?.puppet?.messageRawPayload && message?.id) return await bot.puppet.messageRawPayload(message.id)
  } catch {}
  try { return message?.payload || null } catch { return null }
}

function extractRawWechatSenderName(rawPayload) {
  try {
    const content = String(rawPayload?.Content || rawPayload?.MMActualContent || '')
    const original = String(rawPayload?.OriginalContent || '')
    const display = String(rawPayload?.ActualNickName || rawPayload?.RecommendInfo?.NickName || rawPayload?.User?.NickName || '')
    const fromContent = content.includes(':\n') ? content.split(':\n')[0] : ''
    const fromOriginal = original.includes(':<br/>') ? original.split(':<br/>')[0] : ''
    return [display, fromContent, fromOriginal].map(v => String(v || '').trim()).find(v => v && !isWeChatInternalIdLike(v)) || ''
  } catch {
    return ''
  }
}

function getWechatyContactId(contact) {
  const payload = contact?.payload && typeof contact.payload === 'object' ? contact.payload : {}
  return String(contact?.id || payload?.id || payload?.contactId || payload?.UserName || '').trim()
}

function pushWechatyCandidate(candidates, value) {
  const text = String(value || '').trim()
  if (text) candidates.push(text)
}

function cleanWechatyDisplayCandidate(value = '') {
  return String(value || '')
    .replace(/<br\s*\/?>/giu, ' ')
    .replace(/<[^>]+>/gu, '')
    .replace(/&nbsp;/giu, ' ')
    .replace(/&amp;/giu, '&')
    .replace(/&lt;/giu, '<')
    .replace(/&gt;/giu, '>')
    .trim()
}

function partsFromWechatyRoomMemberRaw(raw = {}) {
  return {
    roomAlias: cleanWechatyDisplayCandidate(raw.DisplayName || raw.RemarkName || raw.RemarkPYInitial || ''),
    contactAlias: cleanWechatyDisplayCandidate(raw.Alias || raw.RemarkName || raw.RemarkPYQuanPin || ''),
    contactName: cleanWechatyDisplayCandidate(raw.NickName || raw.DisplayName || ''),
  }
}

function hasUsableWechatyMemberName(raw = {}) {
  const parts = partsFromWechatyRoomMemberRaw(raw)
  return [parts.roomAlias, parts.contactAlias, parts.contactName]
    .map(cleanWechatyDisplayCandidate)
    .some(value => value && !isWeChatInternalIdLike(value))
}

async function hydrateWechatyRoomMembers(roomId = '') {
  const rid = String(roomId || '').trim()
  if (!rid || !bot?.puppet?.wechat4u?.batchGetContact) return null
  try {
    const contacts = await bot.puppet.wechat4u.batchGetContact([{ UserName: rid, EncryChatRoomId: '' }])
    if (Array.isArray(contacts) && contacts.length) {
      const roomRaw = contacts.find(item => item?.UserName === rid) || contacts[0]
      const members = Array.isArray(roomRaw?.MemberList)
        ? roomRaw.MemberList.map(item => ({ ...item, EncryChatRoomId: rid }))
        : []
      try { if (members.length) bot.puppet.wechat4u.updateContacts(members) } catch {}
      try { bot.puppet.wechat4u.updateContacts(contacts) } catch {}
      return roomRaw || null
    }
  } catch (err) {
    console.warn(`[WechatyStats] 批量刷新群成员资料失败 room="${rid}"：${err?.message || err}`)
  }
  return null
}

async function getWechatyRoomMemberRaw(room, senderId = '', { hydrate = false } = {}) {
  const roomId = String(room?.id || '').trim()
  const sid = String(senderId || '').trim()
  if (!roomId || !sid || !bot?.puppet?.roomMemberRawPayload) return null
  try {
    const raw = await bot.puppet.roomMemberRawPayload(roomId, sid)
    if (!hydrate || hasUsableWechatyMemberName(raw)) return raw
  } catch {}
  if (hydrate) {
    const roomRaw = await hydrateWechatyRoomMembers(roomId)
    const found = Array.isArray(roomRaw?.MemberList)
      ? roomRaw.MemberList.find(item => item?.UserName === sid)
      : null
    if (found) return found
    try { return await bot.puppet.roomMemberRawPayload(roomId, sid) } catch {}
  }
  return null
}

async function resolveWechatyMemberNamePartsFromId(room, senderId = '', { hydrate = false } = {}) {
  const parts = { roomAlias: '', contactAlias: '', contactName: '' }
  const raw = await getWechatyRoomMemberRaw(room, senderId, { hydrate })
  if (raw) Object.assign(parts, partsFromWechatyRoomMemberRaw(raw))
  const candidates = []
  pushWechatyCandidate(candidates, parts.roomAlias)
  pushWechatyCandidate(candidates, parts.contactAlias)
  pushWechatyCandidate(candidates, parts.contactName)
  try {
    const payload = await bot?.puppet?.contactPayload?.(senderId)
    pushWechatyCandidate(candidates, payload?.alias)
    pushWechatyCandidate(candidates, payload?.name)
    pushWechatyCandidate(candidates, payload?.friend)
  } catch {}
  pushWechatyCandidate(candidates, senderId)
  const displayName = candidates.map(cleanWechatyDisplayCandidate).find(value => value && !isWeChatInternalIdLike(value)) || '未知成员'
  return { ...parts, displayName }
}

async function resolveWechatyMemberNameParts(room, contact, fallback = '') {
  const parts = { roomAlias: '', contactAlias: '', contactName: '' }
  const candidates = []
  const senderId = getWechatyContactId(contact) || String(fallback || '').trim()
  const direct = senderId ? await resolveWechatyMemberNamePartsFromId(room, senderId, { hydrate: true }) : null
  if (direct) {
    parts.roomAlias = direct.roomAlias || parts.roomAlias
    parts.contactAlias = direct.contactAlias || parts.contactAlias
    parts.contactName = direct.contactName || parts.contactName
    pushWechatyCandidate(candidates, direct.roomAlias)
    pushWechatyCandidate(candidates, direct.contactAlias)
    pushWechatyCandidate(candidates, direct.contactName)
    pushWechatyCandidate(candidates, direct.displayName)
  }
  try { parts.roomAlias = String(await room?.alias?.(contact) || '').trim(); pushWechatyCandidate(candidates, parts.roomAlias) } catch {}
  try { parts.contactAlias = String(await contact?.alias?.() || '').trim(); pushWechatyCandidate(candidates, parts.contactAlias) } catch {}
  try { parts.contactName = String(contact?.name?.() || '').trim(); pushWechatyCandidate(candidates, parts.contactName) } catch {}
  try {
    const payload = contact?.payload && typeof contact.payload === 'object' ? contact.payload : {}
    pushWechatyCandidate(candidates, payload?.alias)
    pushWechatyCandidate(candidates, payload?.remark)
    pushWechatyCandidate(candidates, payload?.remarkName)
    pushWechatyCandidate(candidates, payload?.displayName)
    pushWechatyCandidate(candidates, payload?.name)
    pushWechatyCandidate(candidates, payload?.NickName)
    pushWechatyCandidate(candidates, payload?.RemarkName)
  } catch {}
  pushWechatyCandidate(candidates, fallback)
  const displayName = candidates.map(cleanWechatyDisplayCandidate).find(value => value && !isWeChatInternalIdLike(value)) || '未知成员'
  return { ...parts, displayName }
}

async function resolveWechatyMemberDisplayName(room, contact, fallback = '') {
  return (await resolveWechatyMemberNameParts(room, contact, fallback)).displayName
}

function scheduleRoomMemberNameRefresh(room, topic = '') {
  const roomId = String(room?.id || '').trim()
  if (!roomId) return
  const key = `wechaty:${roomId}`
  const last = memberNameRefreshAt.get(key) || 0
  if (Date.now() - last < MEMBER_NAME_REFRESH_STALE_MS) return
  memberNameRefreshAt.set(key, Date.now())
  refreshRoomMemberDisplayNames(room, topic).catch(err => {
    console.warn(`[WechatyStats] 刷新群成员昵称失败 topic="${topic}"：${err?.message || err}`)
  })
}

async function refreshRoomMemberDisplayNames(room, topic = '', { force = false } = {}) {
  const groupId = `wechaty:${room.id}`
  const groupName = topic || await safeTopic(room)
  const memberIds = []
  const hydratedRoomRaw = room?.id ? await hydrateWechatyRoomMembers(room.id) : null
  if (Array.isArray(hydratedRoomRaw?.MemberList) && hydratedRoomRaw.MemberList.length) {
    for (const member of hydratedRoomRaw.MemberList) {
      const sid = String(member?.UserName || '').trim()
      if (sid) memberIds.push(sid)
    }
  }
  if (!memberIds.length && bot?.puppet?.roomMemberList && room?.id) {
    try {
      const ids = await bot.puppet.roomMemberList(room.id)
      for (const id of ids || []) {
        const sid = String(id || '').trim()
        if (sid) memberIds.push(sid)
      }
    } catch (err) {
      console.warn(`[WechatyStats] 读取群成员 ID 失败 topic="${groupName}"：${err?.message || err}`)
    }
  }
  let members = []
  if (!memberIds.length && room?.memberAll) {
    try { members = await room.memberAll() } catch {}
  }
  let updated = 0
  let named = 0
  const entries = memberIds.length
    ? memberIds.map(senderId => ({ senderId, member: null }))
    : (members || []).map(member => ({ senderId: getWechatyContactId(member), member }))
  for (const entry of entries) {
    const senderId = String(entry.senderId || '').trim()
    if (!senderId) continue
    const parts = entry.member
      ? await resolveWechatyMemberNameParts(room, entry.member, senderId)
      : await resolveWechatyMemberNamePartsFromId(room, senderId, { hydrate: false })
    if (!parts.displayName || parts.displayName === '未知成员') continue
    named += 1
    try {
      const result = upsertWeChatGroupMemberName({
        groupId,
        groupName,
        senderId,
        displayName: parts.displayName,
        roomAlias: parts.roomAlias,
        contactAlias: parts.contactAlias,
        contactName: parts.contactName,
        source: 'wechaty-room-member',
      })
      updated += Number(result?.updated || 0)
    } catch (err) {
      console.warn(`[WechatyStats] 回填成员昵称失败 sender="${senderId}"：${err?.message || err}`)
    }
  }
  console.log(`[WechatyStats] 群成员昵称刷新 topic="${groupName}" members=${entries.length} named=${named} updated=${updated}${force ? ' force=true' : ''}`)
  return { ok: true, group_id: groupId, group_name: groupName, members: entries.length, named, updated }
}


async function persistWechatMessageMedia(message, { groupId = '', groupName = '', senderId = '' } = {}) {
  let type = ''
  try { type = String(message.type?.() ?? '') } catch {}
  const normalizedType = normalizeWechatMessageType(type)
  if (!/(attachment|audio|emoji|emoticon|sticker|image|video|file)/iu.test(normalizedType)) return { stored: false }
  if (!message?.toFileBox) return { stored: false, reason: 'toFileBox_unavailable' }
  const groupPart = String(groupId || groupName || 'unknown-group').replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 80)
  const day = new Date().toISOString().slice(0, 10)
  const dir = path.join(WECHAT_MEDIA_DIR, groupPart, day)
  fs.mkdirSync(dir, { recursive: true })
  const fileBox = await message.toFileBox()
  const rawName = String(fileBox?.name || `message-${message.id || Date.now()}`)
  const safeName = rawName.replace(/[\\/:*?"<>|]+/g, '_').slice(-160)
  const fileName = `${Date.now()}-${String(message.id || '').replace(/[^a-zA-Z0-9_-]+/g, '').slice(0, 32)}-${safeName}`
  const filePath = path.join(dir, fileName)
  await fileBox.toFile(filePath, true)
  return {
    stored: true,
    filePath,
    relativePath: path.relative(paths.userDir, filePath),
    fileName,
    type: normalizedType || type,
    senderId,
  }
}

async function safeTopic(room) {
  try { return String(await room?.topic?.() || '').trim() } catch { return '' }
}

function getConfiguredGroupNames() {
  try {
    const cfg = getWechatyDutyGroupConfig()
    const names = Array.isArray(cfg.groupNames) ? cfg.groupNames : []
    return names.length ? [...new Set(names.map(v => String(v || '').trim()).filter(Boolean))] : [...FALLBACK_GROUP_NAMES]
  } catch {
    return [...FALLBACK_GROUP_NAMES]
  }
}

function isWechatyGroupAdminSender(senderId = '') {
  const sid = String(senderId || '').trim()
  if (!sid) return false
  try {
    const cfg = getWechatyDutyGroupConfig()
    if (cfg.adminModeEnabled !== true) return false
    const ids = Array.isArray(cfg.adminWechatIds) ? cfg.adminWechatIds : []
    return ids.some(id => String(id || '').trim() === sid)
  } catch {
    return false
  }
}

function buildAdminProtectionReply({ groupId = '', groupName = '', senderId = '', text = '' } = {}) {
  const cfg = getWechatyDutyGroupConfig()
  if (cfg.adminModeEnabled !== true) return ''
  const adminIds = Array.isArray(cfg.adminWechatIds) ? cfg.adminWechatIds.map(id => String(id || '').trim()).filter(Boolean) : []
  if (!adminIds.length || adminIds.includes(String(senderId || '').trim())) return ''
  let members = []
  try { members = listWeChatGroupMembers({ groupId, groupName, limit: 1000 }).members || [] } catch {}
  const admins = adminIds.map(id => members.find(member => String(member.sender_id || '') === id) || { sender_id: id, display_name: id })
  const value = String(text || '')
  const targetAdmin = admins.find(admin => {
    const names = [admin.display_name, admin.room_alias, admin.contact_alias, admin.contact_name, admin.sender_id].map(v => String(v || '').trim()).filter(Boolean)
    return names.some(name => name && value.includes(name))
  })
  if (!targetAdmin) return ''
  const hostile = /(删除|物理|干掉|搞死|弄死|禁言|踢|封|骂|喷|怼|诽谤|冒充|套|骗|提权|越狱|绕过|攻击|伤害|羞辱|嘲讽|整他|搞他|开盒|人肉)/u.test(value)
  if (!hostile) return ''
  const name = targetAdmin.display_name || targetAdmin.sender_id || '管理员'
  return `别拿我当刀使。${name} 是已验证管理员，不是你一句话就能被“物理删除”的 NPC[吃瓜] 想坑管理员，先把你这点小心思藏好。`
}

function normalizeGroupNames(input) {
  const raw = Array.isArray(input)
    ? input
    : String(input || '').split(/[，,;；\n]+/)
  const names = raw.map(v => String(v || '').trim()).filter(Boolean)
  const merged = names.length ? names : getConfiguredGroupNames()
  return [...new Set(merged)]
}

function isAllowedGroupTopic(topic) {
  const current = String(topic || '').trim()
  if (!current) return false
  return targetGroupNames.some(name => current === name || current.includes(name) || name.includes(current))
}

function markSelectedRooms(rooms = []) {
  const map = new Map()
  const canonicalTopic = value => String(value || '').trim().replace(/\s+/gu, ' ').toLowerCase()
  for (const raw of Array.isArray(rooms) ? rooms : []) {
    const topic = String(raw?.topic || '').trim()
    const id = String(raw?.id || '').trim()
    if (!topic && !id) continue
    // Wechaty/wechat4u 可能因为重新登录给同一个群留下多个历史 room_id；
    // UI 和运行态都必须按群名只保留一条，避免设置、记忆、统计页面重复。
    const key = topic ? `name:${canonicalTopic(topic)}` : `id:${id}`
    const selected = isAllowedGroupTopic(topic) || raw?.selected === true
    const prev = map.get(key)
    if (!prev) {
      map.set(key, { ...raw, id, topic: topic || id, selected, historical_ids: id ? [id] : [] })
      continue
    }
    const historical = new Set([...(prev.historical_ids || []), ...(raw?.historical_ids || []), id].filter(Boolean))
    map.set(key, {
      ...prev,
      // 已开启 @ 回复的真实群优先；否则保留先出现的 id，旧 id 只进入 historical_ids。
      id: selected && id ? id : prev.id,
      topic: topic || prev.topic,
      selected: prev.selected || selected,
      historical_ids: [...historical],
    })
  }
  return [...map.values()]
}

function createWechatyPuppet() {
  // 重要：这里必须固定使用 wechat4u puppet。
  // 之前临时切到 `wechaty-puppet-wechat` 会启动 Puppeteer/Chrome 版网页微信，
  // 在 macOS arm64 上出现 `WechatyBro` 注入失败、Chrome 断开、5s 超时等问题；
  // 用户看到的“网页版登录微信”就是那个 puppet 造成的。
  activePuppetName = 'wechaty-puppet-wechat4u'
  ensureWechatyMemoryFile()
  return new BailongmaPuppetWechat4u()
}

function ensureWechatyMemoryFile() {
  try {
    fs.mkdirSync(path.dirname(WECHATY_MEMORY_FILE), { recursive: true })
    if (!fs.existsSync(WECHATY_MEMORY_FILE)) {
      fs.writeFileSync(WECHATY_MEMORY_FILE, '{}')
      return
    }
    const raw = fs.readFileSync(WECHATY_MEMORY_FILE, 'utf-8').trim()
    if (!raw) fs.writeFileSync(WECHATY_MEMORY_FILE, '{}')
    else JSON.parse(raw)
  } catch (err) {
    console.warn(`[Wechaty] 登录态文件异常，已重置为空：${WECHATY_MEMORY_FILE} (${err?.message || err})`)
    try { fs.writeFileSync(WECHATY_MEMORY_FILE, '{}') } catch {}
  }
}

function getWechatyMemoryState() {
  try {
    const raw = fs.readFileSync(WECHATY_MEMORY_FILE, 'utf-8')
    const payload = JSON.parse(raw || '{}')
    const keys = Object.keys(payload || {})
    const hasLoginData = keys.some(key => key.includes('PUPPET-WECHAT4U'))
    return { file: WECHATY_MEMORY_FILE, exists: true, bytes: Buffer.byteLength(raw), keys: keys.length, has_login_data: hasLoginData }
  } catch {
    return { file: WECHATY_MEMORY_FILE, exists: false, bytes: 0, keys: 0, has_login_data: false }
  }
}

function persistRuntime(runtimeStatus = status) {
  try {
    setWechatyDutyGroupRuntime({
      status: runtimeStatus,
      loginUser: lastLoginUser,
      rooms: roomSnapshot,
      roomIds: Object.fromEntries([...targetRooms.entries()].map(([name, room]) => [name, room?.id || ''])),
      lastRoomRefreshAt,
      lastMessageAt,
      lastError: lastError ? `${lastError}${activePuppetName ? ` [${activePuppetName}]` : ''}` : '',
      puppet: activePuppetName,
    })
  } catch (err) {
    console.warn(`[Wechaty] 持久化运行态失败：${err?.message || err}`)
  }
}

function restoreRuntimeSnapshot() {
  try {
    const runtime = getWechatyDutyGroupConfig().runtime || {}
    lastLoginUser = String(runtime.loginUser || '')
    roomSnapshot = Array.isArray(runtime.rooms) ? markSelectedRooms(runtime.rooms) : []
    lastRoomRefreshAt = String(runtime.lastRoomRefreshAt || '')
    lastMessageAt = String(runtime.lastMessageAt || '')
    lastError = String(runtime.lastError || '')
    activePuppetName = String(runtime.puppet || activePuppetName || '')
  } catch {}
}

function clearReconnectTimer() {
  if (reconnectTimer) clearTimeout(reconnectTimer)
  reconnectTimer = null
}

function suppressReconnect(ms = 5000) {
  suppressReconnectUntil = Date.now() + ms
}

function isReconnectSuppressed() {
  return Date.now() < suppressReconnectUntil
}

function scheduleReconnect(reason = '') {
  if (!wechatyGroupReplyEnabled || isReconnectSuppressed()) return
  if (reconnectTimer) return
  if (needsWechatyRelogin()) notifyWechatyOffline(reason || 'reconnect')
  reconnectAttempts += 1
  const delay = Math.min(120000, 15000 * reconnectAttempts)
  console.warn(`[Wechaty] ${reason} 后 ${Math.round(delay / 1000)} 秒尝试自动恢复连接`)
  reconnectTimer = setTimeout(async () => {
    reconnectTimer = null
    try {
      await stopWechatyGroupOnly()
      await startWechatyDutyGroupConnector({ pushMessage: pushMessageRef, emitEvent: emitEventRef, groupNames: targetGroupNames, enabled: true })
    } catch (err) {
      lastError = err?.message || String(err)
      persistRuntime('error')
      scheduleReconnect('reconnect_failed')
    }
  }, delay)
}

async function stopWechatyGroupOnly() {
  clearStartWatchdog()
  try { await bot?.stop?.() } catch {}
  bot = null
  targetRoomId = ''
  targetRoom = null
  targetRooms.clear()
}

function qrToAscii(qrcode) {
  let output = ''
  try {
    qrcodeTerminal.generate(qrcode, { small: true }, text => { output = text })
  } catch {}
  return output
}

class BailongmaPuppetWechat4u extends PuppetWechat4u {
  clearBailongmaContactPolling() {
    try {
      if (this.getContactInterval) clearInterval(this.getContactInterval)
    } catch {}
    this.getContactInterval = undefined
    this.unknownContactId = []
  }

  getContactsInfo() {
    // wechat4u 在 logout/stop 后可能仍有联系人补全定时器继续跑，
    // 原版会直接访问 `this.wechat4u.batchGetContact`，导致反复 uncaughtException。
    if (!this.wechat4u || typeof this.wechat4u.batchGetContact !== 'function') {
      this.clearBailongmaContactPolling()
      return
    }
    try {
      return super.getContactsInfo()
    } catch (err) {
      this.clearBailongmaContactPolling()
      this.emit('error', { data: err?.message || String(err) })
    }
  }

  initHookEvents(wechat4u) {
    super.initHookEvents(wechat4u)
    // 原版 logout handler 末尾会 `this.wechat4u.start()`，当外层正在 stop/restart
    // 或微信服务端主动踢下线时，容易形成“退出 → 自动重新扫码 → 定时器读空对象”的循环。
    // 这里改为：只上报 logout，由 BaiLongma 外层统一决定是否重连。
    try {
      wechat4u.removeAllListeners('logout')
      wechat4u.on('logout', async () => {
        this.clearBailongmaContactPolling()
        try {
          if (this.isLoggedIn) await this.logout()
        } catch {}
        // 不主动删除 PUPPET-WECHAT4U 登录态。
        // 正常重启/stop 期间删除这里会导致每次打开软件都重新扫码。
        // 真正被微信服务端踢下线时，wechat4u 下一次启动会自行发现登录态不可用并给出二维码。
      })
    } catch {}
  }

  async onStop() {
    this.clearBailongmaContactPolling()
    try { this.wechat4u?.removeAllListeners?.('logout') } catch {}
    try {
      await super.onStop()
    } catch (err) {
      // stop 期间 wechat4u 可能已被 logout handler 清掉，不能让异常冒泡杀掉主程序。
      this.wechat4u = undefined
    }
  }
}
