import {
  searchMemories,
  getActiveConstraints,
  getTaskKnowledge,
  getPersonMemory,
  getMemoriesByEntity,
  getRecentConversation,
  getRecentConversationTimeline,
  getRecentActionLogs,
  getValidPrefetchCache,
  getUnconsumedUISignals,
  markUISignalsConsumed,
} from '../db.js'
import { getActiveUICards } from '../events.js'
import { getInstalledToolNames } from '../capabilities/marketplace/index.js'

const L2_CONTEXT_HOURS = 24 * 7
const PRIMARY_USER_ID = 'ID:000001'

function summarizeUISignals(signals = []) {
  if (!signals.length) return ''
  const now = Date.now()
  const lines = signals.map(s => {
    const age = Math.max(0, Math.round((now - s.ts) / 1000))
    let payload = {}
    try { payload = JSON.parse(s.payload || '{}') } catch {}
    const target = s.target ? ` (${s.target})` : ''
    let desc = s.type
    if (s.type === 'card.mounted')        desc = `Card finished mounting${target}`
    else if (s.type === 'card.dismissed') desc = `User dismissed the card${target} (${payload.by || 'unknown'}, dwell ${Math.round((payload.dwell_ms||0)/1000)}s)`
    else if (s.type === 'card.dwell')     desc = `Card dwell ${Math.round((payload.dwell_ms||0)/1000)}s${target}`
    else if (s.type === 'card.action')    desc = `User acted on card: ${payload.action || ''}${target}`
    else if (s.type === 'card.error')     desc = `Card error: ${payload.message || ''}${target}`
    return `- ${age}s ago: ${desc}`
  })
  return `UI behavior from the past minute. This is context only; do not speak proactively just because of it:\n${lines.join('\n')}`
}

// 消息格式解析
// 格式：[ID:xxxxxx] 2026-04-13 10:00:00 [渠道] 内容
// 或：  TICK 2026-04-13-10:00:00
function parseMessageInput(message) {
  if (/^TICK\s/i.test(message.trim())) {
    return { isTick: true, senderId: null, messageBody: '' }
  }
  const match = message.match(/^\[([^\]]+)\]\s*[\d\-T:+]+\s*\[[^\]]*\]\s*(.*)$/s)
  return {
    isTick: false,
    senderId: match ? match[1] : null,
    messageBody: match ? match[2].trim() : message,
  }
}

// 从文本中提取关键词（用于记忆相关性检索）
// 过滤停用词，保留有意义的词，每个词单独搜索
const STOP_WORDS = new Set([
  '的', '了', '是', '在', '我', '你', '他', '她', '它', '我们', '你们', '他们', '这', '那', '有', '没有',
  '和', '与', '把', '被', '因为', '所以', '如果', '一个', '一些', '什么', '怎么', '为什么',
  '帮我', '请', '好的', '明白', '告诉', '让', '做', '去', '来', '把', '说', '给',
])

// n-gram 内含这些字符时跨越了词边界，不是完整词，过滤掉
const STOP_CHARS = new Set(['的', '了'])

function extractKeywords(text, maxKeywords = 8) {
  if (!text) return []

  const cleaned = text
    .replace(/[，。！？、；：”””’’’【】[\]()（）\d]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  const freq = new Map()
  const bump = (word) => {
    if (!word || word.length < 2 || STOP_WORDS.has(word)) return
    for (const ch of word) {
      if (STOP_CHARS.has(ch)) return
    }
    freq.set(word, (freq.get(word) || 0) + 1)
  }

  const chinese = cleaned.replace(/[a-zA-Z]+/g, ' ')
  for (let i = 0; i < chinese.length - 1; i++) {
    for (let len = 2; len <= 4 && i + len <= chinese.length; len++) {
      bump(chinese.slice(i, i + len).trim())
    }
  }

  const english = text.match(/[a-zA-Z]{3,}/g) || []
  for (const word of english) {
    const normalized = word.toLowerCase()
    if (!STOP_WORDS.has(normalized)) bump(word)
  }

  // 按长度降序、频次降序排列；较短词若已被更长词覆盖则跳过
  const sorted = [...freq.entries()]
    .sort((a, b) => (b[0].length - a[0].length) || (b[1] - a[1]))
    .map(([word]) => word)

  const result = []
  for (const word of sorted) {
    if (!result.some(selected => selected.includes(word))) {
      result.push(word)
    }
    if (result.length >= maxKeywords) break
  }
  return result
}

// 桶内重排：salience >= 4 的提到前面（按 salience 高到低），
// 同 boost 组内 timestamp 距今超过 365 天的下沉到该组末尾，
// 其余维持调用方传入的原顺序（JS Array.prototype.sort 在 ES2019+ 是 stable 的）
function rerankByImportance(memories) {
  if (!Array.isArray(memories) || memories.length === 0) return memories
  const now = Date.now()
  const isStale = (m) => {
    const t = m.timestamp ? new Date(m.timestamp).getTime() : NaN
    if (!Number.isFinite(t)) return false
    return (now - t) / 86400000 > 365
  }
  const boostOf = (m) => {
    const s = Number(m.salience) || 0
    return s >= 4 ? s : 0
  }
  return [...memories].sort((a, b) => {
    const ba = boostOf(a), bb = boostOf(b)
    if (ba !== bb) return bb - ba          // 高 boost 在前
    const sa = isStale(a) ? 1 : 0, sb = isStale(b) ? 1 : 0
    if (sa !== sb) return sa - sb           // 同 boost 内陈旧（>365天）下沉
    return 0                                // 其余维持原顺序（stable sort）
  })
}

// 相关记忆搜索：双输入函数（focus + context） + 向量召回兜底
// focusText 是当前消息+任务+hint，享受优先权；contextText 是对话历史，作为补充
// 两路独立抽关键词、独立检索，focus 命中的记忆在前；contextText 的关键词排除已出现在 focus 关键词集合里的词
// focusText 为空时直接返回空数组，不用 contextText 兜底
// 注意：函数 async 是为了等向量召回；未配置 embedding 时整体行为退化为旧的 FTS5-only 同步路径
async function searchRelevantMemories({
  focusText,
  contextText = '',
  focusLimit = 12,
  contextLimit = 8,
  focusKeywords = 8,
  contextKeywords = 10,
  perKeyword = 3,
}) {
  if (!focusText) return []

  const focusKws = extractKeywords(focusText, focusKeywords)
  if (focusKws.length === 0) return []

  const seen = new Set()
  const focusHits = []

  for (const keyword of focusKws) {
    const hits = searchMemories(keyword, perKeyword)
    for (const memory of hits) {
      if (!seen.has(memory.id)) {
        seen.add(memory.id)
        focusHits.push(memory)
      }
    }
    if (focusHits.length >= focusLimit) break
  }

  const focusHitsCapped = focusHits.slice(0, focusLimit)
  // 重置 seen，但先把 focus 命中放进去，避免 context 重复
  const seenAll = new Set(focusHitsCapped.map(m => m.id))
  const contextHits = []

  if (contextText && contextLimit > 0) {
    const focusKwSet = new Set(focusKws)
    const contextKwsRaw = extractKeywords(contextText, contextKeywords)
    const contextKws = contextKwsRaw.filter(kw => !focusKwSet.has(kw))
    const ctxPerKeyword = Math.max(1, perKeyword - 1)

    for (const keyword of contextKws) {
      const hits = searchMemories(keyword, ctxPerKeyword)
      for (const memory of hits) {
        if (!seenAll.has(memory.id)) {
          seenAll.add(memory.id)
          contextHits.push(memory)
        }
      }
      if (contextHits.length >= contextLimit) break
    }
  }

  const contextHitsCapped = contextHits.slice(0, contextLimit)

  // 向量召回兜底：focusText 算 embedding，找 FTS5 没召回到的 top-N 语义相似记忆，
  // 追加到 focus 桶末尾。失败/未配置时静默跳过，行为完全等同 FTS5-only。
  let vecAppended = []
  try {
    const { computeEmbedding, isEmbeddingConfigured } = await import('../embedding.js')
    if (isEmbeddingConfigured() && focusText) {
      const queryEmb = await computeEmbedding(focusText)
      if (queryEmb) {
        const { searchByEmbedding } = await import('../db.js')
        const vecHits = searchByEmbedding(queryEmb, Math.min(focusLimit, 10))
        // 只追加未被 FTS5 命中过的（避免重复），且 _vecScore > 0.5 过滤掉明显无关的
        const existingIds = new Set([...focusHitsCapped, ...contextHitsCapped].map(m => m.id))
        vecAppended = vecHits.filter(m => !existingIds.has(m.id) && m._vecScore > 0.5)
      }
    }
  } catch {
    // 静默：embedding 模块导入失败、API 异常等都不影响 FTS5 兜底结果
  }

  const focusHitsRanked   = rerankByImportance(focusHitsCapped)
  const contextHitsRanked = rerankByImportance(contextHitsCapped)
  const vecRanked         = rerankByImportance(vecAppended)
  // 顺序：focus FTS5 → 向量补充 → context FTS5
  return [...focusHitsRanked, ...vecRanked, ...contextHitsRanked].slice(0, focusLimit + contextLimit)
}

function deduplicateMemories(arrays) {
  const seen = new Set()
  const result = []
  for (const memory of arrays.flat()) {
    if (!memory || seen.has(memory.id)) continue
    seen.add(memory.id)
    result.push(memory)
  }
  return result
}

// hint：一层思考器的输出文本，用于扩展 L2 的记忆检索范围
export async function runInjector({ message, state, hint = '' }) {
  const lastToolResult = state?.lastToolResult || null
  if (lastToolResult) state.lastToolResult = null

  const confidenceHint = state?.pendingConfidenceHint || null
  if (state && 'pendingConfidenceHint' in state) state.pendingConfidenceHint = null  // 消费即焚

  const { senderId, messageBody } = parseMessageInput(message)
  const hasTask = !!state?.task

  const constraints = getActiveConstraints()

  let personMemory = null
  let conversationWindow = []
  let senderMemories = []

  if (senderId) {
    personMemory = getPersonMemory(senderId)
    conversationWindow = getRecentConversation(senderId, 20, 24)
    senderMemories = getMemoriesByEntity(senderId, 10)
  } else if (message && /^TICK\s/i.test(message.trim())) {
    personMemory = getPersonMemory(PRIMARY_USER_ID)
    conversationWindow = getRecentConversationTimeline(40, L2_CONTEXT_HOURS)
    senderMemories = getMemoriesByEntity(PRIMARY_USER_ID, 10)
  }

  const hintText = hint ? hint.replace(/<think>[\s\S]*?<\/think>/gi, '').slice(0, 800) : ''
  const conversationText = conversationWindow
    .map(item => item.content || '')
    .filter(Boolean)
    .join(' ')
    .slice(0, 4000)

  const focusText = [
    messageBody,
    hasTask ? state.task : '',
    hintText,
  ].filter(Boolean).join(' ')

  const hasHistory = !!conversationText
  const CONF_MULT = { low: 1.5, medium: 1.0, high: 0.7 }
  const mult = CONF_MULT[confidenceHint] || 1.0
  const scale = (n) => Math.max(1, Math.round(n * mult))

  const baseFocusLimit     = hasHistory ? 15 : (hint ? 12 : 8)
  const baseContextLimit   = hasHistory ? 10 : 0
  const baseFocusKeywords  = hasHistory ? 10 : (hint ? 10 : 8)
  const baseContextKeywords = hasHistory ? 14 : 0

  const focusLimit      = scale(baseFocusLimit)
  const contextLimit    = baseContextLimit === 0 ? 0 : scale(baseContextLimit)   // 0 不放大（hasHistory=false 时 context 路径整体关掉）
  const focusKeywords   = scale(baseFocusKeywords)
  const contextKeywords = baseContextKeywords === 0 ? 0 : scale(baseContextKeywords)
  const relevantMemories = focusText
    ? await searchRelevantMemories({
        focusText,
        contextText: conversationText,
        focusLimit,
        contextLimit,
        focusKeywords,
        contextKeywords,
        perKeyword: 5,
      })
    : []

  const taskKnowledge = hasTask ? getTaskKnowledge(20) : []
  const recallMemories = []
  const directions = []

  if (state?.prev_recall) {
    const query = state.prev_recall
    console.log(`[注入器] 处理 RECALL: ${query}`)

    let hits = searchMemories(query, 5)

    if (hits.length === 0) {
      const keywords = extractKeywords(query)
      const seen = new Set()
      for (const keyword of keywords) {
        for (const memory of searchMemories(keyword, 3)) {
          if (!seen.has(memory.id)) {
            seen.add(memory.id)
            hits.push(memory)
          }
        }
        if (hits.length >= 5) break
      }
    }

    if (hits.length > 0) {
      recallMemories.push(...hits)
      directions.push(`You proactively requested memory recall for "${query}" in the previous moment. Relevant details have been injected.`)
    } else {
      directions.push(`You proactively requested memory recall for "${query}", but no related memory was found.`)
    }
  }

  const mergeCap = hasHistory ? 30 : 12
  const merged = deduplicateMemories([relevantMemories, senderMemories])
  const memories = rerankByImportance(merged).slice(0, mergeCap)

  const baseTools = [
    'send_message', 'web_search', 'fetch_url', 'browser_read', 'list_dir', 'read_file', 'write_file',
    'delete_file', 'make_dir', 'exec_command', 'kill_process', 'list_processes',
    'set_tick_interval', 'media_mode', 'hotspot_mode', 'person_card_mode', 'manage_reminder', 'manage_prefetch_task',
    'recall_memory', 'set_task', 'music', 'manage_app', 'ui_patch', 'focus_banner', 'set_location', 'set_agent_name',
    'install_tool', 'uninstall_tool', 'list_tools', 'set_security', 'connect_wechat',
  ]
  if (hasTask) {
    baseTools.push('complete_task', 'update_task_step')
  }
  const { listCapabilities } = await import('../providers/registry.js')
  const mmCaps = listCapabilities()
  if (mmCaps.includes('tts'))    baseTools.push('speak')
  if (mmCaps.includes('lyrics')) baseTools.push('generate_lyrics')
  if (mmCaps.includes('music'))  baseTools.push('generate_music')
  if (mmCaps.includes('image'))  baseTools.push('generate_image')
  const isTick = !senderId && /^TICK\s/i.test(message?.trim())
  if (senderId || state?.prev_recall || isTick) baseTools.push('search_memory')
  if (state?.startupSelfCheck?.active) baseTools.push('complete_startup_self_check')
  const tools = [...new Set(baseTools)]

  const actionLog = getRecentActionLogs(10)
  const prefetchedItems = getValidPrefetchCache()

  const uiSignals = getUnconsumedUISignals(60_000)
  const uiSignalSummary = summarizeUISignals(uiSignals)
  if (uiSignals.length) markUISignalsConsumed(uiSignals.map(s => s.id))

  const activeUICards = getActiveUICards()

  // Phase 1：ACUI 工具默认可用（组件少、token 成本低）；后续组件多了再上按需注入
  tools.push('ui_show', 'ui_update', 'ui_hide', 'ui_register')

  // 动态追加已安装工具
  const installedNames = getInstalledToolNames()
  if (installedNames.length > 0) tools.push(...installedNames)

  return {
    memories,
    recallMemories,
    conversationWindow,
    personMemory,
    directions,
    constraints,
    thought: null,
    taskKnowledge,
    tools: [...new Set(tools)],
    lastToolResult,
    actionLog,
    prefetchedItems,
    uiSignalSummary,
    activeUICards,
  }
}

// 从 memory.tags（JSON 字符串）中解出 body_path 标签
function extractBodyPath(memory) {
  try {
    const tags = JSON.parse(memory.tags || '[]')
    if (!Array.isArray(tags)) return null
    const tag = tags.find(t => typeof t === 'string' && t.startsWith('body_path:'))
    return tag ? tag.replace('body_path:', '') : null
  } catch {
    return null
  }
}

// 普通记忆：摘要行，带类型标签和 title（如有）。article 类型附正文路径提示。
// RECALL 记忆：带完整 detail
export function formatMemoriesForPrompt(memories, recallMemories = []) {
  const parts = []

  if (memories?.length > 0) {
    parts.push(memories.map(memory => {
      const typeLabel = memory.event_type ? `[${memory.event_type}] ` : ''
      const titlePart = memory.title ? `《${memory.title}》 ` : ''
      const bodyPath = extractBodyPath(memory)
      const bodyHint = bodyPath ? `\n  ↳ Full text: read_file("${bodyPath}")` : ''
      const salienceMark = memory.salience >= 4 ? ` ★${memory.salience}` : ''
      return `- [${memory.timestamp.slice(0, 10)}${salienceMark}] ${typeLabel}${titlePart}${memory.content}${bodyHint}`
    }).join('\n'))
  }

  if (recallMemories?.length > 0) {
    parts.push('[Recall details]\n' + recallMemories.map(memory => {
      const titlePart = memory.title ? `《${memory.title}》 ` : ''
      const bodyPath = extractBodyPath(memory)
      const bodyHint = bodyPath ? `\n  ↳ Full text: read_file("${bodyPath}")` : ''
      return `- [${memory.timestamp.slice(0, 10)}] ${titlePart}${memory.content}\n  ${memory.detail}${bodyHint}`
    }).join('\n'))
  }

  return parts.join('\n\n')
}

// 预热缓存：格式化注入文本
export function formatPrefetchedItems(prefetchedItems = []) {
  if (!prefetchedItems?.length) return ''
  const body = prefetchedItems.map(item => {
    const fetchedTime = item.fetched_at?.slice(11, 16) || ''
    return `[${item.source}] (${fetchedTime} already fetched)\n${item.content}`
  }).join('\n\n')
  return body + '\n\nThe data above has already been prefetched. Use it directly and phrase the response naturally; do not reuse the same sentence pattern every time.'
}

// 当前屏幕上的存活 ACUI 卡片列表
export function formatActiveUICards(cards = []) {
  if (!cards?.length) return ''
  const lines = cards.map(c => `  - id="${c.id}"  component=${c.component}`)
  return `[Active UI cards on screen]\n${lines.join('\n')}\nUse ui_hide with the id to close a card; use ui_update to update its content.`
}

// 任务知识库：显示完整 content + detail
export function formatTaskKnowledge(taskKnowledge = []) {
  if (!taskKnowledge?.length) return ''
  return taskKnowledge.map(memory => {
    const tags = JSON.parse(memory.tags || '[]')
    const kindTag = tags.find(tag => tag.startsWith('kind:'))
    const kind = kindTag ? kindTag.replace('kind:', '') : ''
    const prefix = kind ? `[${kind}] ` : ''
    return `${prefix}${memory.content}\n  ${memory.detail}`
  }).join('\n')
}

// 根据涌现概念追加搜索记忆，排除已召回的记忆 ID
// concepts: string[]  - 概念列表（来自 concept-extractor.js 的输出）
// excludeIds: Set<number|string>  - 已召回记忆的 id 集合（避免重复）
// limit: number  - 最多返回多少条，默认 10
// returns: Memory[]  - 新增记忆对象数组（与 runInjector 返回的 memories 结构相同）
export function searchAdditionalMemories(concepts, excludeIds, limit = 10) {
  const seen = new Set()
  const results = []

  for (const concept of concepts) {
    const hits = searchMemories(concept, 3)
    for (const memory of hits) {
      if (excludeIds.has(memory.id)) continue
      if (seen.has(memory.id)) continue
      seen.add(memory.id)
      results.push(memory)
      if (results.length >= limit) return results
    }
  }

  return results
}
