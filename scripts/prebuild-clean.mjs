import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const distPath = path.resolve(root, process.argv[2] || 'dist')

if (!fs.existsSync(distPath)) {
  console.log('[prebuild] dist does not exist; skipping clean')
  process.exit(0)
}

try {
  fs.rmSync(distPath, { recursive: true, force: true })
  console.log('[prebuild] dist removed; starting build')
} catch (error) {
  console.error(`[prebuild] clean failed: ${error.message}`)
  process.exit(1)
}
