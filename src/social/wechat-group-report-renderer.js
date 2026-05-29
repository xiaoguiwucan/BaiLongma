import fs from 'fs/promises'
import path from 'path'
import { chromium } from 'playwright'
import { paths } from '../paths.js'
import { normalizeWeChatGroupReportTemplate, renderWeChatGroupStatsPosterHtml } from './wechat-group-report-template.js'

function safeFilePart(value = '') {
  return String(value || '')
    .replace(/[\\/:*?"<>|\s]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80) || 'group'
}

export async function renderWeChatGroupStatsPosterPng(stats = {}, { templateId = 'guochao-red-gold', outDir = '' } = {}) {
  if (!stats?.ok) return { ok: false, error: 'stats unavailable' }
  const template = normalizeWeChatGroupReportTemplate(templateId)
  const dir = outDir || path.join(paths.dataDir, 'wechat-report-posters')
  await fs.mkdir(dir, { recursive: true })
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 23)
  const base = `${safeFilePart(stats.group_name || stats.group_id)}-${template}-${stamp}`
  const htmlPath = path.join(dir, `${base}.html`)
  const pngPath = path.join(dir, `${base}.png`)
  const html = renderWeChatGroupStatsPosterHtml(stats, { templateId: template })
  await fs.writeFile(htmlPath, html)
  const browser = await chromium.launch({ headless: true })
  try {
    const page = await browser.newPage({ viewport: { width: 1080, height: 1350 }, deviceScaleFactor: 1 })
    await page.goto('file://' + htmlPath, { waitUntil: 'load' })
    await page.screenshot({ path: pngPath, fullPage: false, type: 'png' })
    await page.close()
  } finally {
    await browser.close().catch(() => {})
  }
  return { ok: true, template, htmlPath, filePath: pngPath, contentType: 'image/png' }
}
