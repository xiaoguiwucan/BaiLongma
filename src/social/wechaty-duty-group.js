import qrcodeTerminal from 'qrcode-terminal'
import { WechatyBuilder, ScanStatus } from 'wechaty'
import { PuppetWechat4u } from 'wechaty-puppet-wechat4u'
import { FileBox } from 'file-box'
import { archiveWeChatGroupMessage, buildWeChatGroupCommandPrompt, formatGroupLine, makeWeChatGroupExternalId, WECHAT_GROUP_CHANNEL } from './wechat-groups.js'
import { getWechatyDutyGroupConfig, setWechatyDutyGroupRuntime } from '../config.js'
import { recordWeChatGroupMessage, recordWeChatGroupAssistantReply, recordWeChatGroupExplicitMemories } from './wechat-group-memory.js'
import { isWeChatInternalIdLike, normalizeWeChatGroupDisplayText, recordWeChatGroupActivity, updateWeChatGroupActivitySenderName } from './wechat-group-stats.js'
import { checkWeChatGroupCommandSafety } from './wechat-command-guard.js'
import { paths } from '../paths.js'
import path from 'path'
import fs from 'fs'

const FALLBACK_GROUP_NAMES = ['值班群', 'PT站看片狂魔小群']
const WECHATY_MEMORY_NAME = path.join(paths.userDir, 'wechaty-duty-group')
const WECHATY_MEMORY_FILE = `${WECHATY_MEMORY_NAME}.memory-card.json`
const ROOM_REFRESH_STALE_MS = 2 * 60 * 1000
const MESSAGE_HEALTH_STALE_MS = 10 * 60 * 1000
const MEMBER_NAME_REFRESH_STALE_MS = 10 * 60 * 1000
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
    needs_relogin: !online && ['logged_in', 'connected', 'group_lookup_error', 'rooms_pending', 'group_not_found', 'error', 'disconnected'].includes(status),
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
    const body = String(content || '')
    if (LOCAL_FILE_REFERENCE_RE.test(body)) {
      const refusal = '为了保护机主隐私，微信群里不能发送或描述本机文件、桌面图片、截图、相册或 file:// 路径。可以发送公开网络图片链接。'
      if (mentionId) {
        try {
          const contact = bot.Contact.load?.(mentionId) || await bot.Contact.find?.({ id: mentionId })
          if (contact) await room.say(refusal, contact)
          else await room.say(refusal)
        } catch {
          await room.say(refusal)
        }
      } else {
        await room.say(refusal)
      }
      return { ok: false, blocked: true, reason: 'local_file_reference_in_wechat_outbound' }
    }
    const imageUrls = extractPublicImageUrlsFromWechatText(body)
    const textBody = imageUrls.length ? (stripImageMarkdown(body, imageUrls) || '公开网络图片：') : body
    if (mentionId) {
      try {
        const contact = bot.Contact.load?.(mentionId) || await bot.Contact.find?.({ id: mentionId })
        if (contact) await room.say(textBody, contact)
        else await room.say(textBody)
      } catch {
        await room.say(textBody)
      }
    } else {
      await room.say(textBody)
    }
    for (const url of imageUrls) {
      try {
        await room.say(FileBox.fromUrl(url))
      } catch (err) {
        console.warn(`[Wechaty] 公开网络图片发送失败：${url} ${err?.message || err}`)
      }
    }
    return { ok: true, platform: 'wechaty-duty-group', roomId: rid, images: imageUrls.length }
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
    await resolveTargetRooms()
  })

  bot.on('logout', (user) => {
    status = 'disconnected'
    targetRoomId = ''
    console.log(`[Wechaty] 已断开/退出：${user?.name?.() || lastLoginUser || ''}`)
    persistRuntime(status)
    emitEventRef?.('social_status', { platform: 'wechaty-duty-group', status, group_names: [...targetGroupNames], login_user: lastLoginUser, rooms: roomSnapshot })
    if (!isReconnectSuppressed()) scheduleReconnect('logout')
  })

  bot.on('error', (err) => {
    lastError = err?.message || String(err)
    // wechat4u 登录后常见 `-1 == 0` / `400 != 400` 这类底层同步抖动。
    // 如果已经登录并解析到目标群，不能因为这个暂态错误主动 stop/restart；
    // 否则会把刚扫码成功的会话踢回二维码状态，群里 @ 自然收不到。
    if (isWechat4uTransientError(lastError)) {
      if (hasResolvedRooms() && (isFreshRoomRefresh() || isMessageHealthy())) {
        status = targetRoomId ? 'connected' : 'logged_in'
        console.warn(`[Wechaty] 忽略 wechat4u 暂态错误，保持当前连接：${lastError}`)
        persistRuntime(status)
        emitEventRef?.('social_status', { platform: 'wechaty-duty-group', status, group_names: [...targetGroupNames], room_id: targetRoomId, warning: lastError, rooms: roomSnapshot })
        return
      }
      if (hasResolvedRooms()) {
        status = 'group_lookup_error'
        console.warn(`[Wechaty] wechat4u 暂态错误但连接健康过期，标记为需确认/重登：${lastError}`)
        persistRuntime(status)
        emitEventRef?.('social_status', { platform: 'wechaty-duty-group', status, group_names: [...targetGroupNames], warning: lastError, rooms: roomSnapshot })
        return
      }
      if (status === 'qr_ready' || status === 'starting') {
        console.warn(`[Wechaty] 等待登录期间忽略 wechat4u 暂态错误：${lastError}`)
        persistRuntime(status)
        emitEventRef?.('social_status', { platform: 'wechaty-duty-group', status, group_names: [...targetGroupNames], warning: lastError, rooms: roomSnapshot })
        return
      }
    }
    if (!targetRoomId) status = 'error'
    console.error(`[Wechaty] 错误：${lastError}`)
    persistRuntime(status)
    emitEventRef?.('social_status', { platform: 'wechaty-duty-group', status, group_names: [...targetGroupNames], room_id: targetRoomId, error: lastError, rooms: roomSnapshot })
    scheduleReconnect('error')
  })

  bot.on('message', handleMessage)

  bot.start().catch(err => {
    status = 'error'
    lastError = err?.message || String(err)
    persistRuntime(status)
    console.error(`[Wechaty] 启动失败：${lastError}`)
    emitEventRef?.('social_status', { platform: 'wechaty-duty-group', status: 'error', group_names: [...targetGroupNames], error: lastError })
  })

  return { platform: 'wechaty-duty-group', stop: stopWechatyDutyGroupConnector }
}

export async function syncWechatyDutyGroupRooms() {
  return resolveTargetRooms()
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
    if (!isAllowedGroupTopic(topic)) return

    targetRooms.set(topic, room)
    scheduleRoomMemberNameRefresh(room, topic)
    if (!targetRoomId) {
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
    const senderId = getWechatyContactId(talker)
    const senderName = isSelf ? '我' : await resolveWechatyMemberDisplayName(room, talker, senderId)
    const groupId = `wechaty:${room.id}`
    const groupExternalId = makeWeChatGroupExternalId(groupId)
    if (senderId && senderName && senderName !== '未知成员') {
      try {
        updateWeChatGroupActivitySenderName({ groupId, groupName: topic, senderId, senderName })
      } catch (err) {
        console.warn(`[WechatyStats] 更新成员昵称失败：${err?.message || err}`)
      }
    }
    let activity = null
    try {
      activity = recordWeChatGroupActivity({
        groupId,
        groupName: topic,
        senderId: senderId || senderName,
        senderName,
        text: rawText,
        messageType,
        mentionedSelf: false,
        source: 'wechaty',
      })
    } catch (err) {
      console.warn(`[WechatyStats] 写入群统计失败：${err?.message || err}`)
    }
    const text = activity?.displayText || normalizeWeChatGroupDisplayText(rawText, messageType)
    if (!text) return

    let mentionedSelf = false
    try { mentionedSelf = !!(await message.mentionSelf?.()) } catch {}
    if (!mentionedSelf) mentionedSelf = textMentionsLoginUser(rawText || text)
    console.log(`[Wechaty] 收到群消息 topic="${topic}" sender="${senderName}" self=${isSelf} mention=${mentionedSelf} text=${text.slice(0, 100)}`)

    // 群消息先归档并写入当前群专属记忆库；默认不打扰、不回复。
    archiveWeChatGroupMessage({ groupId, senderId: senderName, text })
    recordWeChatGroupMessage({ groupId, groupName: topic, senderId: senderId || senderName, senderName, text, mentionedSelf, source: 'wechaty' }).catch(err => console.warn(`[Honcho] 写入群记忆失败：${err?.message || err}`))
    // 只要 @ 了当前扫码登录的微信号，就必须进入大模型。
    // 注意：这里不再做任何关键词/意图/内容二次过滤，也不做硬编码回复。
    if (!wechatyGroupReplyEnabled || !mentionedSelf) return

    console.log(`[Wechaty] 值班群消息${isSelf ? '（self）' : ''}${mentionedSelf ? '（@我）' : ''} ${senderName}: ${text.slice(0, 100)}`)

    const safety = checkWeChatGroupCommandSafety(text)
    if (!safety.allowed) {
      const refusal = safety.reason
      await sendWechatyDutyGroupMessage(room.id, refusal, { mentionId: senderId })
      recordWeChatGroupAssistantReply({ groupId, groupName: topic, reply: refusal, targetMemberName: senderName, source: 'wechaty' }).catch(() => {})
      return
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
      social: { platform: 'wechaty-duty-group', group_name: topic, room_id: room.id, sender_name: senderName, sender_id: senderId || '', mentioned_self: mentionedSelf, reply_mention_id: senderId || '', user_text: text, raw_user_text: rawText || text },
      timestamp: new Date().toISOString(),
    })

    const prompt = await buildWeChatGroupCommandPrompt({ groupId, groupName: topic, senderId: senderId || senderName, senderName, text, mentionedSelf: true })
    pushMessageRef?.(`wechaty:room:${room.id}`, prompt, WECHAT_GROUP_CHANNEL, {
      noPersist: true,
      externalPartyIdOverride: `wechaty:room:${room.id}`,
      groupArchiveId: groupExternalId,
      social: { platform: 'wechaty-duty-group', group_name: topic, room_id: room.id, sender_name: senderName, sender_id: senderId || '', mentioned_self: mentionedSelf, reply_mention_id: senderId || '', user_text: text, raw_user_text: rawText || text },
    })
  } catch (err) {
    console.warn(`[Wechaty] 处理群消息失败：${err?.message || err}`)
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

async function resolveWechatyMemberDisplayName(room, contact, fallback = '') {
  const candidates = []
  try { pushWechatyCandidate(candidates, await room?.alias?.(contact)) } catch {}
  try { pushWechatyCandidate(candidates, await contact?.alias?.()) } catch {}
  try { pushWechatyCandidate(candidates, contact?.name?.()) } catch {}
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
  return candidates.find(value => !isWeChatInternalIdLike(value)) || '未知成员'
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

async function refreshRoomMemberDisplayNames(room, topic = '') {
  if (!room?.memberAll) return { ok: false, skipped: true, reason: 'room_member_all_unavailable' }
  const groupId = `wechaty:${room.id}`
  const groupName = topic || await safeTopic(room)
  const members = await room.memberAll()
  let updated = 0
  for (const member of members || []) {
    const senderId = getWechatyContactId(member)
    if (!senderId) continue
    const senderName = await resolveWechatyMemberDisplayName(room, member, senderId)
    if (!senderName || senderName === '未知成员') continue
    try {
      const result = updateWeChatGroupActivitySenderName({ groupId, groupName, senderId, senderName })
      updated += Number(result?.updated || 0)
    } catch (err) {
      console.warn(`[WechatyStats] 回填成员昵称失败 sender="${senderId}"：${err?.message || err}`)
    }
  }
  if (updated > 0) console.log(`[WechatyStats] 已回填群成员微信昵称 topic="${groupName}" rows=${updated}`)
  return { ok: true, group_id: groupId, members: members?.length || 0, updated }
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
  return rooms.map(room => ({ ...room, selected: isAllowedGroupTopic(room.topic) }))
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
