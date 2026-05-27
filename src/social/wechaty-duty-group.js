import qrcodeTerminal from 'qrcode-terminal'
import { WechatyBuilder, ScanStatus } from 'wechaty'
import { PuppetWechat4u } from 'wechaty-puppet-wechat4u'
import { MemoryCard } from 'memory-card'
import { archiveWeChatGroupMessage, buildWeChatGroupCommandPrompt, formatGroupLine, makeWeChatGroupExternalId, WECHAT_GROUP_CHANNEL } from './wechat-groups.js'
import { getWechatyDutyGroupConfig, setWechatyDutyGroupRuntime } from '../config.js'
import { recordWeChatGroupMessage, recordWeChatGroupAssistantReply } from './wechat-group-memory.js'
import { checkWeChatGroupCommandSafety } from './wechat-command-guard.js'
import { paths } from '../paths.js'
import path from 'path'
import fs from 'fs'

const FALLBACK_GROUP_NAMES = ['值班群', 'PT站看片狂魔小群']
const WECHATY_MEMORY_NAME = path.join(paths.userDir, 'wechaty-duty-group')
const WECHATY_MEMORY_FILE = `${WECHATY_MEMORY_NAME}.memory-card.json`

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
let activePuppetName = ''
let reconnectTimer = null
let reconnectAttempts = 0
restoreRuntimeSnapshot()

function isLoginActive() {
  return status === 'logged_in' || status === 'connected'
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

export function getWechatyDutyGroupStatus() {
  const runtime = getWechatyDutyGroupConfig().runtime || {}
  const rooms = roomSnapshot.length
    ? roomSnapshot
    : (Array.isArray(runtime.rooms) ? markSelectedRooms(runtime.rooms) : [])
  const runtimeRoomIds = runtime.roomIds && typeof runtime.roomIds === 'object' ? runtime.roomIds : {}
  const roomIds = Object.keys(runtimeRoomIds).length
    ? runtimeRoomIds
    : Object.fromEntries([...targetRooms.entries()].map(([name, room]) => [name, room?.id || '']))
  return {
    status,
    enabled: wechatyGroupReplyEnabled,
    group_name: targetGroupNames[0] || '',
    group_names: [...targetGroupNames],
    room_id: targetRoomId,
    room_ids: roomIds,
    qr: lastQr,
    qr_ascii: lastQrAscii,
    error: lastError,
    online: isLoginActive(),
    login_user: isLoginActive() ? previousLoginUser() : '',
    last_login_user: previousLoginUser(),
    room_count: rooms.length,
    rooms,
    last_room_refresh_at: lastRoomRefreshAt || String(runtime.lastRoomRefreshAt || ''),
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
    if (mentionId) {
      try {
        const contact = bot.Contact.load?.(mentionId) || await bot.Contact.find?.({ id: mentionId })
        if (contact) await room.say(body, contact)
        else await room.say(body)
      } catch {
        await room.say(body)
      }
    } else {
      await room.say(body)
    }
    return { ok: true, platform: 'wechaty-duty-group', roomId: rid }
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
    return { ok: false, status, enabled: wechatyGroupReplyEnabled, group_names: [...targetGroupNames], rooms: roomSnapshot, login_user: '', last_login_user: previousLoginUser(), last_room_refresh_at: lastRoomRefreshAt, error: reason }
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
    } else if (roomSnapshot.length) {
      console.warn('[Wechaty] 本次未获取到群列表，保留上次真实群列表，避免设置页误清空。')
    }
    return { ok: true, status, enabled: wechatyGroupReplyEnabled, group_names: [...targetGroupNames], rooms: roomSnapshot, login_user: previousLoginUser(), last_login_user: previousLoginUser(), last_room_refresh_at: lastRoomRefreshAt, fresh: items.length > 0 }
  } catch (err) {
    return { ok: false, status, enabled: wechatyGroupReplyEnabled, group_names: [...targetGroupNames], rooms: roomSnapshot, login_user: isLoginActive() ? previousLoginUser() : '', last_login_user: previousLoginUser(), error: err?.message || String(err) }
  }
}

export async function restartWechatyDutyGroupConnector(opts = {}) {
  await stopWechatyDutyGroupConnector()
  return startWechatyDutyGroupConnector(opts)
}

export async function stopWechatyDutyGroupConnector() {
  clearReconnectTimer()
  status = 'idle'
  lastQr = ''
  lastQrAscii = ''
  targetRoomId = ''
  targetRoom = null
  targetRooms.clear()
  try { await bot?.stop?.() } catch {}
  bot = null
  persistRuntime(status)
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
    name: 'bailongma-duty-group',
    memory: createWechatyMemoryCard(),
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
    scheduleReconnect('logout')
  })

  bot.on('error', (err) => {
    lastError = err?.message || String(err)
    // wechat4u 登录后常见 `-1 == 0` / `400 != 400` 这类底层同步抖动。
    // 如果已经登录并解析到目标群，不能因为这个暂态错误主动 stop/restart；
    // 否则会把刚扫码成功的会话踢回二维码状态，群里 @ 自然收不到。
    if (isWechat4uTransientError(lastError)) {
      if (hasResolvedRooms()) {
        status = targetRoomId ? 'connected' : 'logged_in'
        console.warn(`[Wechaty] 忽略 wechat4u 暂态错误，保持在线：${lastError}`)
        persistRuntime(status)
        emitEventRef?.('social_status', { platform: 'wechaty-duty-group', status, group_names: [...targetGroupNames], room_id: targetRoomId, warning: lastError, rooms: roomSnapshot })
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
      console.warn('[Wechaty] 群列表暂时为空，保留上次真实列表，避免把设置页清空。')
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
        console.log(`[Wechaty] 已接入群：${await safeTopic(room)} (${room.id})`)
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
    if (!targetRoomId) {
      targetRoomId = room.id
      targetRoom = room
      status = 'connected'
      emitEventRef?.('social_status', { platform: 'wechaty-duty-group', status, group_names: [...targetGroupNames], room_id: targetRoomId })
    }

    const text = String(message.text?.() || '').trim()
    if (!text) return
    const talker = message.talker?.()
    const senderName = isSelf ? '我' : (talker?.name?.() || talker?.id || '未知成员')
    const groupId = `wechaty:${room.id}`
    const groupExternalId = makeWeChatGroupExternalId(groupId)

    let mentionedSelf = false
    try { mentionedSelf = !!(await message.mentionSelf?.()) } catch {}
    if (!mentionedSelf) mentionedSelf = textMentionsLoginUser(text)
    console.log(`[Wechaty] 收到群消息 topic="${topic}" sender="${senderName}" self=${isSelf} mention=${mentionedSelf} text=${text.slice(0, 100)}`)

    // 群消息先归档并写入当前群专属记忆库；默认不打扰、不回复。
    archiveWeChatGroupMessage({ groupId, senderId: senderName, text })
    recordWeChatGroupMessage({ groupId, groupName: topic, senderId: talker?.id || senderName, senderName, text, mentionedSelf, source: 'wechaty' }).catch(err => console.warn(`[Honcho] 写入群记忆失败：${err?.message || err}`))
    // 只要 @ 了当前扫码登录的微信号，就必须进入大模型。
    // 注意：这里不再做任何关键词/意图/内容二次过滤，也不做硬编码回复。
    if (!wechatyGroupReplyEnabled || !mentionedSelf) return

    console.log(`[Wechaty] 值班群消息${isSelf ? '（self）' : ''}${mentionedSelf ? '（@我）' : ''} ${senderName}: ${text.slice(0, 100)}`)

    const safety = checkWeChatGroupCommandSafety(text)
    if (!safety.allowed) {
      const refusal = safety.reason
      await sendWechatyDutyGroupMessage(room.id, refusal, { mentionId: talker?.id })
      recordWeChatGroupAssistantReply({ groupId, groupName: topic, reply: refusal, targetMemberName: senderName, source: 'wechaty' }).catch(() => {})
      return
    }

    emitEventRef?.('message_in', {
      from_id: groupExternalId,
      content: formatGroupLine(senderName, text),
      channel: WECHAT_GROUP_CHANNEL,
      external_party_id: groupExternalId,
      social: { platform: 'wechaty-duty-group', group_name: topic, room_id: room.id, sender_name: senderName, sender_id: talker?.id || '', mentioned_self: mentionedSelf, reply_mention_id: talker?.id || '' },
      timestamp: new Date().toISOString(),
    })

    const prompt = await buildWeChatGroupCommandPrompt({ groupId, groupName: topic, senderId: talker?.id || senderName, senderName, text, mentionedSelf: true })
    pushMessageRef?.(`wechaty:room:${room.id}`, prompt, WECHAT_GROUP_CHANNEL, {
      noPersist: true,
      externalPartyIdOverride: `wechaty:room:${room.id}`,
      groupArchiveId: groupExternalId,
      social: { platform: 'wechaty-duty-group', group_name: topic, room_id: room.id, sender_name: senderName, sender_id: talker?.id || '', mentioned_self: mentionedSelf, reply_mention_id: talker?.id || '' },
    })
  } catch (err) {
    console.warn(`[Wechaty] 处理群消息失败：${err?.message || err}`)
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
  return new BailongmaPuppetWechat4u({
    memory: { name: WECHATY_MEMORY_NAME },
  })
}

function createWechatyMemoryCard() {
  ensureWechatyMemoryFile()
  // Wechaty 会把自己的 root memory multiplex 给 puppet。
  // 只在 PuppetWechat4u options 里传 memory 不够，因为 Wechaty 初始化时会覆盖 puppet memory。
  // 因此 root memory 必须显式传给 WechatyBuilder，才能稳定写到 userData，而不是项目 cwd。
  return new MemoryCard(WECHATY_MEMORY_NAME)
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
    lastError = String(runtime.lastError || '')
    activePuppetName = String(runtime.puppet || activePuppetName || '')
  } catch {}
}

function clearReconnectTimer() {
  if (reconnectTimer) clearTimeout(reconnectTimer)
  reconnectTimer = null
}

function scheduleReconnect(reason = '') {
  if (!wechatyGroupReplyEnabled) return
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
