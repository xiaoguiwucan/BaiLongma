// Focus Frame 启发式分类的纯算法测试。
// 不动数据库、不动 LLM、不动网络。
//
// focus.js 直接从 keywords.js 拿 extractKeywords（绕开 injector.js 与 SQLite），
// 所以这里可以裸 import，不需要 ESM resolve hook 来桥 focus 本身。
//
// buildContextBlock 来自 prompt.js，prompt.js 依赖 agents/registry.js（间接接 DB），
// 因此在测试 prompt 集成时仍需上 test-prompt-split-loader 同款 stub hook。
//
// Run: node src/test-focus-frame.js
import { register } from 'node:module'
register('./test-prompt-split-loader.mjs', import.meta.url)

import {
  updateFocusFrame,
  FOCUS_FRAME_STALE_TICKS,
  describeFocusFrameAge,
} from './memory/focus.js'
import { extractKeywords } from './memory/keywords.js'

let failed = 0
function assert(cond, label) {
  if (!cond) {
    console.error(`FAIL: ${label}`)
    failed++
    process.exitCode = 1
  } else {
    console.log(`PASS: ${label}`)
  }
}

function makeState() {
  return { focusFrame: null, tickCounter: 0 }
}

// ========== Round 1-5 主线场景 ==========
// 设计原则：用「真实场景」消息驱动 updateFocusFrame，但只断言「事件类型」
// 这种宏观行为；至于具体哪几个 ngram 进 topic、是哪个词命中保持，
// 都交给 v0 启发式自己定 —— 任务说「准确度是次要的」。
{
  const state = makeState()

  // round 1: 「我想学一下 prompt caching」→ created
  state.tickCounter = 1
  const r1 = updateFocusFrame(state, '我想学一下 prompt caching 的原理', {
    isTick: false,
    tickCounter: state.tickCounter,
  })
  assert(r1.event === 'created', `round1 event=${r1.event} (expect created)`)
  assert(!!state.focusFrame, 'round1 focusFrame created (not null)')
  assert(state.focusFrame.hitCount === 1, `round1 hitCount=${state.focusFrame.hitCount} (expect 1)`)
  assert(state.focusFrame.startedAtTick === 1, `round1 startedAtTick=${state.focusFrame.startedAtTick}`)
  assert(state.focusFrame.lastSeenTick === 1, `round1 lastSeenTick=${state.focusFrame.lastSeenTick}`)
  assert(state.focusFrame.topic.length >= 2, `round1 topic has at least 2 kws (got ${state.focusFrame.topic.length})`)

  // round 2: 「再说说 prompt 的 prefix cache 怎么命中」
  // v0 启发式下 topic 可能命中 / 也可能错过 prompt——两种都是合法的 MVP 行为。
  // 我们只断言：要么 kept、要么 switched，反正不会是 created 或 cleared。
  state.tickCounter = 2
  const r2 = updateFocusFrame(state, '再说说 prompt 的 prefix cache 怎么命中', {
    isTick: false,
    tickCounter: state.tickCounter,
  })
  assert(r2.event === 'kept' || r2.event === 'switched', `round2 event=${r2.event} (kept or switched)`)
  assert(state.focusFrame.lastSeenTick === 2, `round2 lastSeenTick=${state.focusFrame.lastSeenTick}`)

  // round 3: 「今天天气怎么样」→ 完全无交集 → switched
  state.tickCounter = 3
  const r3 = updateFocusFrame(state, '今天广州的天气怎么样啊', {
    isTick: false,
    tickCounter: state.tickCounter,
  })
  assert(r3.event === 'switched', `round3 event=${r3.event} (expect switched)`)
  assert(state.focusFrame.hitCount === 1, `round3 hitCount reset to 1 (got ${state.focusFrame.hitCount})`)
  assert(state.focusFrame.startedAtTick === 3, 'round3 startedAtTick reset to 3')
  const topic3 = [...state.focusFrame.topic]

  // round 4: TICK → 不动
  state.tickCounter = 4
  const r4 = updateFocusFrame(state, 'TICK 2026-05-19-10:30:00', {
    isTick: true,
    tickCounter: state.tickCounter,
  })
  assert(r4.event === 'noop' || r4.event === 'cleared', `round4 TICK event=${r4.event}`)
  // 帧仍在（因为只过了 1 tick）
  assert(!!state.focusFrame, 'round4 TICK does not clear frame')
  assert(state.focusFrame.topic.join(',') === topic3.join(','), 'round4 TICK does not change topic')
  assert(state.focusFrame.hitCount === 1, 'round4 TICK does not bump hitCount')
  assert(state.focusFrame.lastSeenTick === 3, 'round4 TICK does not bump lastSeenTick')

  // round 5: 「天气预报告诉我明天」
  // 同样：v0 启发式 ngram 切分可能命中也可能错过「天气」；两种都合法。
  state.tickCounter = 5
  const r5 = updateFocusFrame(state, '天气预报告诉我明天怎么样', {
    isTick: false,
    tickCounter: state.tickCounter,
  })
  assert(r5.event === 'kept' || r5.event === 'switched', `round5 event=${r5.event} (kept or switched)`)
  assert(state.focusFrame.lastSeenTick === 5, `round5 lastSeenTick=${state.focusFrame.lastSeenTick}`)
}

// ========== 直接构造 state 验证「kept」路径（白盒，绕开 token 切分的偶然性）==========
{
  const state = makeState()
  state.focusFrame = {
    topic: ['caching', 'prompt', 'prefix'],
    startedAtTick: 1,
    lastSeenTick: 1,
    hitCount: 1,
  }
  state.tickCounter = 2
  // 这条消息抽出来 K 里一定含有 'prompt'（英文词整体保留 + 长度 >=3）
  const r = updateFocusFrame(state, '再说一下 prompt 的工作机制吧', {
    isTick: false,
    tickCounter: state.tickCounter,
  })
  // 验证 K 里确实有 'prompt'
  const kws = extractKeywords('再说一下 prompt 的工作机制吧', 8)
  assert(kws.includes('prompt'), `K contains 'prompt' (got ${JSON.stringify(kws)})`)
  assert(r.event === 'kept', `kept-path event=${r.event} (expect kept)`)
  assert(state.focusFrame.hitCount === 2, `kept-path hitCount=${state.focusFrame.hitCount} (expect 2)`)
  assert(state.focusFrame.lastSeenTick === 2, `kept-path lastSeenTick=${state.focusFrame.lastSeenTick}`)
  assert(state.focusFrame.startedAtTick === 1, 'kept-path startedAtTick unchanged')
  assert(state.focusFrame.topic.join(',') === 'caching,prompt,prefix', 'kept-path topic unchanged')
}

// ========== Stale 清理：lastSeenTick 远在 FOCUS_FRAME_STALE_TICKS 之前，TICK 即清 ==========
{
  const state = makeState()
  state.focusFrame = {
    topic: ['老', '帧', '残留'],
    startedAtTick: 1,
    lastSeenTick: 5,
    hitCount: 3,
  }
  state.tickCounter = 5 + FOCUS_FRAME_STALE_TICKS + 1   // 26
  const r = updateFocusFrame(state, 'TICK 2026-05-19-11:00:00', {
    isTick: true,
    tickCounter: state.tickCounter,
  })
  assert(r.event === 'cleared', `stale clear event=${r.event} (expect cleared)`)
  assert(state.focusFrame === null, 'stale clear sets focusFrame to null')
}

// ========== 太短消息不动 ==========
{
  const state = makeState()
  state.tickCounter = 1
  const r = updateFocusFrame(state, '好', { isTick: false, tickCounter: 1 })
  assert(r.event === 'noop', `very short msg event=${r.event}`)
  assert(state.focusFrame === null, 'very short msg does not create frame')
}

// ========== 关键词太少（< 3）不动 ==========
{
  const state = makeState()
  state.tickCounter = 1
  // 全是停用词 + 单字组合，提取出的 ngram 大概率 < 3
  const r = updateFocusFrame(state, '好的好的', { isTick: false, tickCounter: 1 })
  // 若 K < 3，应该 noop；若 K >= 3，则 created — 两种 outcome 都自洽
  assert(
    (r.event === 'noop' && state.focusFrame === null) ||
      (r.event === 'created' && !!state.focusFrame),
    `sparse msg outcome consistent (event=${r.event}, frame=${!!state.focusFrame})`,
  )
}

// ========== describeFocusFrameAge 人话描述 ==========
{
  const just = { topic: ['a'], startedAtTick: 5, lastSeenTick: 5, hitCount: 1 }
  assert(
    describeFocusFrameAge(just, 5) === 'just started focusing on this',
    'age desc: just started',
  )
  const ongoing = { topic: ['a'], startedAtTick: 1, lastSeenTick: 5, hitCount: 4 }
  assert(
    describeFocusFrameAge(ongoing, 5).includes('last seen this round'),
    'age desc: last seen this round',
  )
  const cooling = { topic: ['a'], startedAtTick: 1, lastSeenTick: 5, hitCount: 4 }
  const ad = describeFocusFrameAge(cooling, 8)
  assert(ad.includes('3 rounds ago'), `age desc cooling: ${ad}`)
}

// ========== buildContextBlock 集成：focusFrame 有 topic 时输出 <focus> 段 ==========
{
  const { buildContextBlock } = await import('./prompt.js')
  const ctx = buildContextBlock({
    focusFrame: { topic: ['prompt', 'cache'], startedAtTick: 1, lastSeenTick: 3, hitCount: 3 },
    focusTickCounter: 3,
  })
  assert(ctx.includes('<focus'), 'context emits <focus> when focusFrame present')
  assert(ctx.includes('topic="prompt, cache"'), 'focus tag has joined topic attr')

  const ctxEmpty = buildContextBlock({ focusFrame: null })
  assert(!ctxEmpty.includes('<focus'), 'context omits <focus> when focusFrame null')

  // 边界：topic 为空数组也不应该输出
  const ctxNoTopic = buildContextBlock({
    focusFrame: { topic: [], startedAtTick: 1, lastSeenTick: 1, hitCount: 1 },
    focusTickCounter: 1,
  })
  assert(!ctxNoTopic.includes('<focus'), 'context omits <focus> when topic is empty')

  // 集成位置：<focus> 应在 <task> 之后、<task-knowledge> 之前
  const ctxOrder = buildContextBlock({
    hasActiveTask: true,
    task: 'do thing',
    taskKnowledge: 'some artifact',
    focusFrame: { topic: ['x'], startedAtTick: 1, lastSeenTick: 1, hitCount: 1 },
    focusTickCounter: 1,
  })
  const idxTask = ctxOrder.indexOf('<task active="true">')
  const idxFocus = ctxOrder.indexOf('<focus')
  const idxKnowledge = ctxOrder.indexOf('<task-knowledge>')
  assert(idxTask >= 0 && idxFocus > idxTask && idxKnowledge > idxFocus,
    `section order: task(${idxTask}) < focus(${idxFocus}) < task-knowledge(${idxKnowledge})`)
}

if (failed === 0) {
  console.log('\nAll focus-frame sanity checks complete.')
} else {
  console.log(`\n${failed} check(s) failed.`)
}
