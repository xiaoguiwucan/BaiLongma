import os from 'os'
import { spawn } from 'child_process'

const mode = process.argv[2] === 'backend' ? 'backend' : 'app'

process.env.BAILONGMA_HOST = '0.0.0.0'
process.env.BAILONGMA_ALLOW_LAN = '1'

function isPrivateLanAddress(address) {
  const parts = address.split('.').map(Number)
  return parts[0] === 10 ||
    (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
    (parts[0] === 192 && parts[1] === 168)
}

const addresses = Object.values(os.networkInterfaces())
  .flat()
  .filter(Boolean)
  .filter(iface => iface.family === 'IPv4' && !iface.internal && isPrivateLanAddress(iface.address))
  .map(iface => iface.address)

console.log('')
console.log('Bailongma LAN mode is enabled.')
console.log('Open one of these URLs on another device connected to the same network:')
for (const address of [...new Set(addresses)]) {
  console.log(`  http://${address}:3721/`)
}
console.log('')

const command = process.platform === 'win32'
  ? (mode === 'backend' ? 'node.exe' : 'npx.cmd')
  : (mode === 'backend' ? 'node' : 'npx')
const args = mode === 'backend'
  ? ['--env-file=.env', 'src/index.js']
  : ['electron', '.']

const child = spawn(command, args, {
  stdio: 'inherit',
  env: process.env,
  shell: false,
})

child.on('exit', code => process.exit(code ?? 0))
child.on('error', error => {
  console.error(`[start-lan] failed to start ${mode}: ${error.message}`)
  process.exit(1)
})
