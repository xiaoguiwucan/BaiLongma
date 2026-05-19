// 关键词抽取：纯函数，零外部依赖（不碰 DB、不碰网络）。
// 同时被 memory/injector.js（用于召回检索）和 memory/focus.js（用于焦点判断）使用。
//
// 第 3a 步从 injector.js 抽出来，让 focus.js 不必拉起 SQLite 原生绑定即可被
// 在纯 Node 环境下单元测试。

// 停用词：高频但无信息量的词。
const STOP_WORDS = new Set([
  '的', '了', '是', '在', '我', '你', '他', '她', '它', '我们', '你们', '他们', '这', '那', '有', '没有',
  '和', '与', '把', '被', '因为', '所以', '如果', '一个', '一些', '什么', '怎么', '为什么',
  '帮我', '请', '好的', '明白', '告诉', '让', '做', '去', '来', '把', '说', '给',
])

// n-gram 内含这些字符时跨越了词边界，不是完整词，过滤掉
const STOP_CHARS = new Set(['的', '了'])

export function extractKeywords(text, maxKeywords = 8) {
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

  // 按频次降序 → 长度降序排列；不做子串去重
  //
  // 历史上这里曾用 "较短词若被更长词覆盖则跳过" 的子串去重逻辑，
  // 但这反了：在 FTS5/LIKE 字面召回里，较短词（"业余"）比较长 ngram（"业余写什"）
  // 更可能命中真实记忆内容。子串去重把最有用的短关键词砍掉了。
  // 改为直接按 (频次, 长度) 排序后截前 maxKeywords，
  // 保留所有 ngram，让短词跟长词一起进入召回池。
  return [...freq.entries()]
    .sort((a, b) => (b[1] - a[1]) || (b[0].length - a[0].length))
    .slice(0, maxKeywords)
    .map(([word]) => word)
}
