export function splitTextForTTS(text, { maxLen = 90, minLen = 4 } = {}) {
  const raw = String(text || '').replace(/\s+/g, ' ').trim()
  if (!raw) return []
  const parts = []
  let buf = ''
  for (const ch of raw) {
    buf += ch
    if (/[。！？!?；;\n]/.test(ch) || (/[，,：:]/.test(ch) && buf.length >= 24) || buf.length >= maxLen) {
      const s = buf.trim()
      if (s) parts.push(s)
      buf = ''
    }
  }
  if (buf.trim()) parts.push(buf.trim())
  const merged = []
  for (const part of parts) {
    if (merged.length && part.length < minLen) merged[merged.length - 1] += part
    else merged.push(part)
  }
  return merged.slice(0, 24)
}
