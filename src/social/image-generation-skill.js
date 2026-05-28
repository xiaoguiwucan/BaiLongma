import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { getSkillImageCredentials } from '../config.js'
import { paths } from '../paths.js'

const LIMIT_FILE = path.join(paths.dataDir, 'skill-image-generation-limits.json')
const OUTPUT_DIR = path.join(paths.dataDir, 'generated-images')
const IMAGE_REQUEST_RE = /(?:生成|画|绘制|做|制作|出|来|给|设计|创作).{0,40}(?:图片|图像|插画|海报|头像|壁纸|封面|logo|图标|照片|图)|(?:生图|画图|生成图|生成图片|AI图|ai图|出图)/iu
const HIGH_QUALITY_RE = /(?:高清|高质量|精细|2k|4k|8k|超清|大图|高分辨率|高分辨)/iu

function readLimits() {
  try { return JSON.parse(fs.readFileSync(LIMIT_FILE, 'utf-8')) || {} } catch { return {} }
}

function writeLimits(payload = {}) {
  fs.mkdirSync(path.dirname(LIMIT_FILE), { recursive: true })
  fs.writeFileSync(LIMIT_FILE, JSON.stringify(payload, null, 2))
}

function hourKey(date = new Date()) {
  return date.toISOString().slice(0, 13)
}

export function isWechatImageGenerationRequest(text = '') {
  return IMAGE_REQUEST_RE.test(String(text || ''))
}

function extractPrompt(text = '') {
  return String(text || '')
    .replace(/^[@＠][^\s\u2005\u2006\u2007\u2008\u2009\u200a，,：:、]{1,40}/u, '')
    .replace(/^(帮我|给我|请|麻烦|小白龙|前夜|贾维斯)/iu, '')
    .replace(/(?:生成|画|绘制|做|制作|出|来|给我|帮我|请).{0,4}(?:一张|一个|1张)?(?:图片|图像|插画|海报|头像|壁纸|图|照片)/iu, '')
    .replace(/(?:生图|画图|生成图|生成图片|AI图|ai图|出图)/giu, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function checkRateLimit({ groupId = '', senderId = '', max = 10 } = {}) {
  const key = `${hourKey()}:${groupId || 'group'}:${senderId || 'unknown'}`
  const limits = readLimits()
  const nowHour = hourKey()
  for (const oldKey of Object.keys(limits)) {
    if (!oldKey.startsWith(`${nowHour}:`)) delete limits[oldKey]
  }
  const current = Number(limits[key] || 0)
  if (current >= max) {
    writeLimits(limits)
    return { allowed: false, used: current, remaining: 0, max }
  }
  limits[key] = current + 1
  writeLimits(limits)
  return { allowed: true, used: current + 1, remaining: Math.max(max - current - 1, 0), max }
}

async function callImageApi({ prompt, quality, size, config }) {
  const url = `${config.baseUrl.replace(/\/$/, '')}/images/generations`
  const body = {
    model: config.model,
    prompt,
    n: 1,
    size,
    quality,
  }
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 90000)
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
    const text = await res.text()
    let json = null
    try { json = JSON.parse(text) } catch {}
    if (!res.ok) {
      const message = json?.error?.message || json?.message || text.slice(0, 300) || `HTTP ${res.status}`
      return { ok: false, status: res.status, error: message, request: { size, quality } }
    }
    const item = Array.isArray(json?.data) ? json.data[0] : null
    const imageUrl = item?.url || ''
    const b64 = item?.b64_json || item?.b64 || ''
    if (!imageUrl && !b64) return { ok: false, error: 'API 没有返回图片 URL 或 b64_json', request: { size, quality }, preview: text.slice(0, 300) }
    return { ok: true, imageUrl, b64, revisedPrompt: item?.revised_prompt || '', request: { size, quality } }
  } catch (err) {
    return { ok: false, error: err?.name === 'AbortError' ? '图片生成请求超时' : (err?.message || String(err)), request: { size, quality } }
  } finally {
    clearTimeout(timer)
  }
}

async function saveGeneratedImage(result, { senderId = '', groupId = '' } = {}) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true })
  const id = crypto.createHash('sha1').update(`${Date.now()}:${groupId}:${senderId}:${Math.random()}`).digest('hex').slice(0, 16)
  if (result.b64) {
    const filePath = path.join(OUTPUT_DIR, `${id}.png`)
    fs.writeFileSync(filePath, Buffer.from(result.b64, 'base64'))
    return { filePath, source: 'b64' }
  }
  const res = await fetch(result.imageUrl)
  if (!res.ok) throw new Error(`下载生成图片失败：HTTP ${res.status}`)
  const array = await res.arrayBuffer()
  const contentType = res.headers.get('content-type') || ''
  const ext = /jpeg|jpg/iu.test(contentType) ? 'jpg' : /webp/iu.test(contentType) ? 'webp' : 'png'
  const filePath = path.join(OUTPUT_DIR, `${id}.${ext}`)
  fs.writeFileSync(filePath, Buffer.from(array))
  return { filePath, source: 'url', imageUrl: result.imageUrl }
}

export async function generateImageForWechat({ text = '', groupId = '', groupName = '', senderId = '', senderName = '' } = {}) {
  const config = getSkillImageCredentials()
  if (config.enabled === false) return { ok: false, skipped: true, error: '生图 Skill 未启用' }
  if (!config.apiKey) return { ok: false, error: '生图 API Key 未配置，请到设置 > Skill 技能 > 生图 中配置。' }
  const prompt = extractPrompt(text) || String(text || '').replace(/^[@＠][^\s]+/u, '').trim()
  if (!prompt) return { ok: false, error: '请告诉我要生成什么图片。' }
  const limit = checkRateLimit({ groupId, senderId, max: config.maxPerUserPerHour })
  if (!limit.allowed) return { ok: false, limited: true, error: `生图次数已达上限：每人每小时最多 ${limit.max} 张，请下个小时再试。` }
  const high = HIGH_QUALITY_RE.test(text)
  const quality = high ? config.highQuality : config.defaultQuality
  const size = high ? config.highSize : config.defaultSize
  let result = await callImageApi({ prompt, quality, size, config })
  if (!result.ok && (size !== config.defaultSize || quality !== config.defaultQuality)) {
    const retry = await callImageApi({ prompt, quality: config.defaultQuality, size: config.defaultSize, config })
    if (retry.ok) result = { ...retry, fallbackFrom: result.request, fallbackError: result.error }
  }
  if (!result.ok) return { ok: false, error: `生图失败：${result.error || '未知错误'}` }
  const saved = await saveGeneratedImage(result, { senderId, groupId })
  return {
    ok: true,
    tool: 'image_generation',
    prompt,
    groupId,
    groupName,
    senderId,
    senderName,
    filePath: saved.filePath,
    imageUrl: saved.imageUrl || result.imageUrl || '',
    quality: result.request?.quality || quality,
    size: result.request?.size || size,
    remaining: limit.remaining,
  }
}
