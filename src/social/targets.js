export function parseSocialTarget(targetId = '') {
  const raw = String(targetId || '').trim()
  if (raw.startsWith('discord:')) {
    const [, channelId, userId = ''] = raw.split(':')
    return channelId ? { platform: 'discord', channelId, userId, raw } : null
  }
  if (raw.startsWith('feishu:')) {
    const [, receiveIdType, ...rest] = raw.split(':')
    const receiveId = rest.join(':')
    return receiveIdType && receiveId ? { platform: 'feishu', receiveIdType, receiveId, raw } : null
  }
  if (raw.startsWith('wechat:official:')) {
    return { platform: 'wechat-official', openId: raw.slice('wechat:official:'.length), raw }
  }
  if (raw.startsWith('wecom:webhook:')) {
    return { platform: 'wecom-webhook', key: raw.slice('wecom:webhook:'.length), raw }
  }
  if (raw.startsWith('wechaty:room:')) {
    return { platform: 'wechaty-duty-group', roomId: raw.slice('wechaty:room:'.length), raw }
  }
  if (raw.startsWith('wechat:clawbot:group:')) {
    const rest = raw.slice('wechat:clawbot:group:'.length)
    const [groupId, encodedContextToken = ''] = rest.split(':ctx:')
    const contextToken = encodedContextToken ? decodeURIComponent(encodedContextToken) : ''
    return { platform: 'wechat-clawbot', userId: `group:${groupId}${contextToken ? `:ctx:${contextToken}` : ''}`, groupId, contextToken, raw }
  }
  if (raw.startsWith('wechat:clawbot:')) {
    return { platform: 'wechat-clawbot', userId: raw.slice('wechat:clawbot:'.length), raw }
  }
  return null
}

