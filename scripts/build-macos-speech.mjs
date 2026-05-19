import fs from 'fs'
import path from 'path'
import { spawnSync } from 'child_process'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const source = path.join(root, 'src', 'voice', 'macos-speech.swift')
const output = path.join(root, 'build', 'native-speech-recognizer')

if (process.platform !== 'darwin') {
  console.log('[macos-speech] skipping native speech build on non-macOS')
  process.exit(0)
}

if (!fs.existsSync(source)) {
  console.warn(`[macos-speech] source not found: ${source}`)
  process.exit(0)
}

fs.mkdirSync(path.dirname(output), { recursive: true })

const result = spawnSync('swiftc', [
  source,
  '-framework', 'Speech',
  '-framework', 'AVFoundation',
  '-o', output,
], { stdio: 'inherit' })

if (result.status !== 0) {
  console.warn('[macos-speech] swiftc failed; app will fall back to running the Swift source when available')
  process.exit(0)
}

fs.chmodSync(output, 0o755)
console.log(`[macos-speech] built ${output}`)
