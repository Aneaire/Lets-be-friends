#!/usr/bin/env node
// Aggregate UI validation for Storybook changes.
//
// `pnpm validate:ui` always runs the static infrastructure checks (including
// the story viewport enforcement check), builds both Storybooks, and runs both
// Storybook browser test suites. It fails on any unchecked legacy viewport
// declaration, so a green result means the configuration is fully migrated.
//
// `--checks-only` runs just the static checks (no browser, no build).
// `--skip-build` or `--skip-tests` keep the static checks but drop that phase.
//
// Storybook tests run in a real browser context but against an isolated runner,
// not installed devices. Builds prove the static sites compile; they do not prove
// interaction or accessibility. Both are required for UI changes.

import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const repoRoot = fileURLToPath(new URL('../', import.meta.url))
const args = new Set(process.argv.slice(2))
const checksOnly = args.has('--checks-only')
const skipBuild = args.has('--skip-build')
const skipTests = args.has('--skip-tests')
const pnpm = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm'
const node = process.execPath

const steps = [
  { name: 'web control contrast', command: node, args: ['scripts/check-web-tokens.mjs'] },
  { name: 'storybook policy', command: node, args: ['scripts/storybook/check-storybook-policy.mjs'] },
  { name: 'storybook viewport config', command: node, args: ['scripts/storybook/migrate-viewport-globals.mjs', '--check'] },
]

if (!checksOnly) {
  if (!skipBuild) {
    steps.push({ name: 'web/admin storybook build', command: pnpm, args: ['run', 'build-storybook'] })
    steps.push({ name: 'mobile storybook build', command: pnpm, args: ['run', 'build-storybook:mobile'] })
  }
  if (!skipTests) {
    steps.push({ name: 'web/admin storybook tests', command: pnpm, args: ['run', 'test-storybook'] })
    steps.push({ name: 'mobile storybook tests', command: pnpm, args: ['run', 'test-storybook:mobile'] })
  }
}

const failures = []
for (const step of steps) {
  console.log(`\n=== ${step.name} ===`)
  const result = spawnSync(step.command, step.args, { cwd: repoRoot, stdio: 'inherit' })
  if (result.status !== 0) failures.push(step.name)
}

console.log('\n=== UI validation summary ===')
for (const step of steps) {
  console.log(`${failures.includes(step.name) ? 'FAIL' : 'PASS'}  ${step.name}`)
}
if (failures.length) {
  console.error(`\n${failures.length} UI validation step(s) failed.`)
  if (failures.includes('storybook viewport config')) {
    console.error('Run `pnpm storybook:migrate:viewport` to migrate legacy and string viewport declarations.')
  }
  process.exit(1)
}
console.log('\nAll UI validation steps passed.')
