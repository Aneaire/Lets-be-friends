#!/usr/bin/env node
// Cross-platform Node flag shim for the root test script.
//
// Node 26 enables an experimental `localStorage` global that shadows jsdom's
// storage and makes web/admin theme tests fail with "localStorage is
// undefined". `--no-experimental-webstorage` restores the previous behavior.
// The flag is only added when the running Node actually accepts it, so older
// runtimes are unaffected.

import { spawnSync } from 'node:child_process'

const FLAG = '--no-experimental-webstorage'
const [command, ...commandArgs] = process.argv.slice(2)

if (!command) {
  console.error('usage: node scripts/run-with-node-options.mjs <command> [args...]')
  process.exit(2)
}

function supportsFlag() {
  const probe = spawnSync(process.execPath, [FLAG, '-e', ''], { stdio: 'ignore' })
  return probe.status === 0
}

const env = { ...process.env }
if (supportsFlag() && !(env.NODE_OPTIONS ?? '').includes(FLAG)) {
  env.NODE_OPTIONS = `${env.NODE_OPTIONS ?? ''} ${FLAG}`.trim()
}

const result = spawnSync(command, commandArgs, {
  stdio: 'inherit',
  env,
  shell: process.platform === 'win32',
})
process.exit(result.status ?? 1)
