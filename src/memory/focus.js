// Focus Frame —— 动态上下文记忆池架构第 3a 步（MVP）
//
// 设计原则（来自 DynamicMemoryPool.md 3.1 / 3.2 / 3.5）：
//   - 「专注」是连续判断的副产品，不是事件触发的开关。
//   - 焦点稳定一段时间 = 形成一帧；焦点漂移 = 上一帧自然不再被选中 = 等于自动 pop。
//   - 用户和 Agent 都不主动声明「进入专注」。
//
// MVP 范围：
//   - 单帧、纯启发式分类、注入感知信号（<focus> 段）。
//   - 内存维护，不持久化。
//   - 不动 memory visibility，不做栈，不做压缩回填，不引入 LLM 调用。
//
// 升级路径：v1 引入 LLM 分类、v2 加入栈与压缩回填、v3 持久化。
// 注意：直接从 keywords.js 拿 extractKeywords，绕开 injector.js（避免拉起 SQLite）
// 这样 focus.js 可以在纯 Node 环境下被单元测试，不需要 better-sqlite3 native binding。
import { extractKeywords } from './keywords.js'

// 焦点失活阈值：lastSeenTick 超过这么多 tick 没被命中就 clear。
// 第 3a 步的常量，方便后续调；调大 = 焦点更黏，调小 = 更容易切。
export const FOCUS_FRAME_STALE_TICKS = 20

// 关键词最低门槛：少于这个数说明消息太空泛，不参与焦点判断。
const MIN_KEYWORDS_FOR_FRAME = 3   // 严格大于 2 → 至少 3 个

// 单帧 topic 关键词数量上限。
const TOPIC_KEYWORDS_LIMIT = 3

// 抽取关键词时给到 extractKeywords 的预算（适度宽一点便于做交集）。
const KEYWORD_EXTRACT_BUDGET = 8

// 太短的消息直接跳过焦点判断（裸字符长度，含格式头）。
const MIN_MESSAGE_LENGTH = 4

// 判断当前输入是不是 TICK。复用 injector 的同源识别。
function isTickMessage(message) {
  return typeof message === 'string' && /^TICK\s/i.test(message.trim())
}

// 从消息里拨开 [ID:xxx] 时间戳 [渠道] 这层壳，拿到消息正文。
// 仅供 focus 用——若解析失败，回退到整条消息。
function stripMessageEnvelope(message) {
  if (!message) return ''
  if (isTickMessage(message)) return ''
  const m = message.match(/^\[[^\]]+\]\s*[\d\-T:+]+\s*\[[^\]]*\]\s*(.*)$/s)
  return m ? m[1].trim() : message.trim()
}

/**
 * 更新 focusFrame。直接 mutate state.focusFrame。
 *
 * @param {object} state          — 进程级 state 对象（必须可写）
 * @param {string} message        — 当前 process 拿到的裸消息字符串
 * @param {object} ctx
 * @param {boolean} ctx.isTick    — 当前是不是 TICK 心跳
 * @param {number}  ctx.tickCounter — 当前 tickCounter（用作帧的时间轴）
 * @returns {{event:'created'|'kept'|'switched'|'cleared'|'noop'}}
 */
export function updateFocusFrame(state, message, { isTick = false, tickCounter = 0 } = {}) {
  if (!state) return { event: 'noop' }

  // TICK：叶子心跳不该影响焦点。但可以触发 stale 清理。
  if (isTick) {
    return maybeClearStale(state, tickCounter)
  }

  // 太短 / 空消息：不动
  const body = stripMessageEnvelope(message)
  if (!body || body.length < MIN_MESSAGE_LENGTH) {
    return maybeClearStale(state, tickCounter)
  }

  // 抽关键词
  const kws = extractKeywords(body, KEYWORD_EXTRACT_BUDGET)
  // 关键词太少（≤2）= 太空泛，不动
  if (kws.length < MIN_KEYWORDS_FOR_FRAME) {
    return maybeClearStale(state, tickCounter)
  }

  // 没有当前帧 → 创建
  if (!state.focusFrame) {
    state.focusFrame = {
      topic: kws.slice(0, TOPIC_KEYWORDS_LIMIT),
      startedAtTick: tickCounter,
      lastSeenTick: tickCounter,
      hitCount: 1,
    }
    return { event: 'created' }
  }

  // 已有帧：算交集
  const topicSet = new Set(state.focusFrame.topic)
  let overlap = 0
  for (const k of kws) {
    if (topicSet.has(k)) overlap++
  }

  if (overlap >= 1) {
    // 命中 → 保持
    state.focusFrame.lastSeenTick = tickCounter
    state.focusFrame.hitCount += 1
    return { event: 'kept' }
  }

  // 完全无交集 → 切换
  state.focusFrame = {
    topic: kws.slice(0, TOPIC_KEYWORDS_LIMIT),
    startedAtTick: tickCounter,
    lastSeenTick: tickCounter,
    hitCount: 1,
  }
  return { event: 'switched' }
}

// 帧失活：太久没被命中就 clear
function maybeClearStale(state, tickCounter) {
  if (!state.focusFrame) return { event: 'noop' }
  const idle = tickCounter - state.focusFrame.lastSeenTick
  if (idle > FOCUS_FRAME_STALE_TICKS) {
    state.focusFrame = null
    return { event: 'cleared' }
  }
  return { event: 'noop' }
}

// 把 focusFrame 翻译成「人话」age 描述，供 <focus> 段用
export function describeFocusFrameAge(focusFrame, tickCounter = 0) {
  if (!focusFrame) return ''
  const since = Math.max(0, tickCounter - focusFrame.startedAtTick)
  const idle = Math.max(0, tickCounter - focusFrame.lastSeenTick)
  if (focusFrame.hitCount <= 1) {
    return 'just started focusing on this'
  }
  if (idle === 0) {
    return `${since} rounds since first seen, last seen this round`
  }
  return `${since} rounds since first seen, last seen ${idle} rounds ago`
}
