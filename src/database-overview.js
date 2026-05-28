import fs from 'fs'
import path from 'path'
import { getDB } from './db.js'
import { paths } from './paths.js'

function fileSize(filePath = '') {
  try { return fs.statSync(filePath).size || 0 } catch { return 0 }
}

function dirSize(dir = '') {
  let total = 0
  try {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) total += dirSize(full)
      else total += fileSize(full)
    }
  } catch {}
  return total
}

function countTable(db, table) {
  try { return Number(db.prepare(`SELECT COUNT(*) AS n FROM "${table.replace(/"/g, '""')}"`).get()?.n || 0) } catch { return 0 }
}

function getDbstatSizes(db) {
  try {
    const rows = db.prepare(`SELECT name, SUM(pgsize) AS bytes FROM dbstat GROUP BY name`).all()
    return new Map(rows.map(row => [String(row.name || ''), Number(row.bytes || 0)]))
  } catch {
    return new Map()
  }
}

function getTables(db) {
  const statSizes = getDbstatSizes(db)
  const tables = db.prepare(`
    SELECT name FROM sqlite_master
    WHERE type='table' AND name NOT LIKE 'sqlite_%'
    ORDER BY name COLLATE NOCASE ASC
  `).all().map(row => String(row.name || '')).filter(Boolean)
  return tables.map(name => ({ name, rows: countTable(db, name), bytes: statSizes.get(name) || 0 }))
}

function getScalar(db, sql, fallback = 0) {
  try { return Number(Object.values(db.prepare(sql).get() || {})[0] || fallback) } catch { return fallback }
}

export function getDatabaseOverview() {
  const db = getDB()
  const dbFile = paths.dbFile
  const walFile = `${dbFile}-wal`
  const shmFile = `${dbFile}-shm`
  const archiveDb = path.join(paths.sandboxDir, 'wechat-group-archive.db')
  const generatedImagesDir = path.join(paths.dataDir, 'generated-images')
  const wechatMediaDir = path.join(paths.dataDir, 'wechat-media')
  const tables = getTables(db)
  const totals = {
    jarvisDbBytes: fileSize(dbFile),
    walBytes: fileSize(walFile),
    shmBytes: fileSize(shmFile),
    archiveDbBytes: fileSize(archiveDb),
    generatedImagesBytes: dirSize(generatedImagesDir),
    wechatMediaBytes: dirSize(wechatMediaDir),
  }
  totals.totalBytes = Object.values(totals).reduce((sum, value) => sum + Number(value || 0), 0)
  const categories = [
    { key: 'chat_records', name: '微信群聊天记录', rows: getScalar(db, 'SELECT COUNT(*) FROM wechat_group_activity'), tables: ['wechat_group_activity'], bytes: tables.filter(t => t.name === 'wechat_group_activity').reduce((s, t) => s + t.bytes, 0) },
    { key: 'group_memory', name: '微信群知识库/记忆', rows: getScalar(db, 'SELECT COUNT(*) FROM wechat_group_memory_items') + getScalar(db, 'SELECT COUNT(*) FROM wechat_group_messages'), tables: ['wechat_group_memory_items', 'wechat_group_messages'], bytes: tables.filter(t => ['wechat_group_memory_items', 'wechat_group_messages'].includes(t.name)).reduce((s, t) => s + t.bytes, 0) },
    { key: 'core_memory', name: '核心长期记忆', rows: getScalar(db, 'SELECT COUNT(*) FROM memories WHERE visibility=1'), tables: ['memories', 'memories_fts'], bytes: tables.filter(t => t.name.startsWith('memories')).reduce((s, t) => s + t.bytes, 0) },
    { key: 'members', name: '微信群成员/昵称', rows: getScalar(db, 'SELECT COUNT(*) FROM wechat_group_member_names'), tables: ['wechat_group_member_names'], bytes: tables.filter(t => t.name === 'wechat_group_member_names').reduce((s, t) => s + t.bytes, 0) },
    { key: 'media', name: '图片/媒体文件', rows: 0, tables: [], bytes: totals.generatedImagesBytes + totals.wechatMediaBytes },
  ]
  return {
    ok: true,
    generatedAt: new Date().toISOString(),
    paths: { userDir: paths.userDir, dbFile, archiveDb, generatedImagesDir, wechatMediaDir },
    totals,
    categories,
    tables: tables.sort((a, b) => (b.bytes || 0) - (a.bytes || 0)),
  }
}
