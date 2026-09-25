#!/usr/bin/env node
// Idempotent viewport-globals migration and enforcement for Storybook stories.
//
// Storybook 10 ignores `parameters.viewport.defaultViewport`, and the UI and the
// addon-vitest runner disagree when a viewport global is a bare string. Both
// consumers agree on an object global:
//
//   initialGlobals: { viewport: { value: 'mobileDefault', isRotated: false } }
//   globals: { viewport: { value: 'mobileSmall', isRotated: false }, theme: 'dark' }
//
// The script is deliberately narrow and code-aware (it skips strings, template
// literals, JSX text, and comments), so it never rewrites documentation:
//   * bare string globals become object globals;
//   * object globals missing `isRotated` are completed in place;
//   * `parameters.viewport.defaultViewport` moves to a sibling `globals.viewport`
//     and existing `globals` objects are merged instead of duplicated;
//   * known aliases are normalized (`reset` -> desktop, `mobileTiny` -> mobileSmall).
//
// Usage:
//   node scripts/storybook/migrate-viewport-globals.mjs            # dry run
//   node scripts/storybook/migrate-viewport-globals.mjs --write    # apply
//   node scripts/storybook/migrate-viewport-globals.mjs --check    # enforce, exit 1
//   node scripts/storybook/migrate-viewport-globals.mjs --self-test
//
// Preview configuration files are owned infrastructure and are only validated.

import { readFileSync, writeFileSync } from 'node:fs'
import { readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = fileURLToPath(new URL('../../', import.meta.url))
const STORY_ROOTS = [
  join(repoRoot, 'apps/web/src'),
  join(repoRoot, 'apps/admin/src'),
  join(repoRoot, 'apps/mobile/src'),
]
const PREVIEW_FILES = [
  join(repoRoot, '.storybook/preview.tsx'),
  join(repoRoot, 'apps/mobile/.storybook/preview.tsx'),
]
const KNOWN_VIEWPORTS = new Set(['desktop', 'mobileSmall', 'mobileDefault', 'mobileLarge', 'tablet'])
const ALIASES = { reset: 'desktop', mobileTiny: 'mobileSmall' }

function resolveAlias(value) {
  return ALIASES[value] ?? value
}

function walk(dir) {
  const found = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) found.push(...walk(full))
    else if (entry.endsWith('.stories.tsx') || entry.endsWith('.stories.ts')) found.push(full)
  }
  return found
}

function storyFiles() {
  return STORY_ROOTS.flatMap((root) => {
    try {
      return walk(root)
    } catch {
      return []
    }
  }).sort()
}

// -- code-aware scanning helpers ------------------------------------------

function skipQuoted(text, i) {
  const quote = text[i]
  i += 1
  while (i < text.length) {
    const c = text[i]
    if (c === '\\') {
      i += 2
      continue
    }
    if (c === quote) return i
    i += 1
  }
  return text.length
}

function skipComment(text, i) {
  if (text[i] !== '/') return i
  if (text[i + 1] === '/') {
    const end = text.indexOf('\n', i)
    return end === -1 ? text.length : end
  }
  if (text[i + 1] === '*') {
    const end = text.indexOf('*/', i + 2)
    return end === -1 ? text.length : end + 1
  }
  return i
}

// Yields code positions only, skipping strings, template literals, and comments.
function codePositions(text, visit) {
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (c === '"' || c === "'" || c === '`') {
      i = skipQuoted(text, i)
      continue
    }
    if (c === '/' && (text[i + 1] === '/' || text[i + 1] === '*')) {
      i = skipComment(text, i)
      continue
    }
    if (visit(i, c) === false) return
  }
}

function findFirstCodeMatch(text, anchoredRegex) {
  let found = null
  codePositions(text, (i) => {
    if (i > 0 && /[\w$]/.test(text[i - 1])) return true
    const match = anchoredRegex.exec(text.slice(i))
    if (match) {
      found = { index: i, match }
      return false
    }
    return true
  })
  return found
}

// Returns [{ open, close, parent }] for every `{}` pair, in close order.
function braceRanges(text) {
  const ranges = []
  const stack = []
  codePositions(text, (i, c) => {
    if (c === '{') stack.push(i)
    else if (c === '}') {
      const open = stack.pop()
      if (open !== undefined) ranges.push({ open, close: i, parent: stack[stack.length - 1] ?? -1 })
    }
  })
  return ranges
}

function matchingClose(text, open) {
  const range = braceRanges(text).find((r) => r.open === open)
  return range ? range.close : -1
}

function topLevelKeys(text, open, close) {
  const keys = new Set()
  let depth = 0
  for (let i = open + 1; i < close; i++) {
    const c = text[i]
    if (c === '"' || c === "'" || c === '`') {
      i = skipQuoted(text, i)
      continue
    }
    if (c === '/' && (text[i + 1] === '/' || text[i + 1] === '*')) {
      i = skipComment(text, i)
      continue
    }
    if (c === '{' || c === '[' || c === '(') {
      depth += 1
      continue
    }
    if (c === '}' || c === ']' || c === ')') {
      depth -= 1
      continue
    }
    if (depth === 0 && /[A-Za-z_$]/.test(c) && !(i > 0 && /[\w$]/.test(text[i - 1]))) {
      const match = /^([A-Za-z_$][\w$]*)\s*:/.exec(text.slice(i))
      if (match) {
        keys.add(match[1])
        i += match[0].length - 1
      }
    }
  }
  return keys
}

function findTopLevelObject(text, open, close, key) {
  let depth = 0
  for (let i = open + 1; i < close; i++) {
    const c = text[i]
    if (c === '"' || c === "'" || c === '`') {
      i = skipQuoted(text, i)
      continue
    }
    if (c === '/' && (text[i + 1] === '/' || text[i + 1] === '*')) {
      i = skipComment(text, i)
      continue
    }
    if (c === '{' || c === '[' || c === '(') {
      depth += 1
      continue
    }
    if (c === '}' || c === ']' || c === ')') {
      depth -= 1
      continue
    }
    if (depth === 0 && /[A-Za-z_$]/.test(c) && !(i > 0 && /[\w$]/.test(text[i - 1]))) {
      const match = /^([A-Za-z_$][\w$]*)\s*:/.exec(text.slice(i))
      if (match) {
        if (match[1] === key) {
          let j = i + match[0].length
          while (j < close && /\s/.test(text[j])) j += 1
          if (text[j] === '{') return { open: j, close: matchingClose(text, j) }
        }
        i += match[0].length - 1
      }
    }
  }
  return null
}

function lastMatchBefore(text, regex, before) {
  regex.lastIndex = 0
  let found = null
  let match
  while ((match = regex.exec(text)) !== null) {
    if (match.index >= before) break
    found = { index: match.index, text: match[0] }
  }
  return found
}

function lineIndent(text, index) {
  const lineStart = text.lastIndexOf('\n', index - 1) + 1
  const match = /^[ \t]*/.exec(text.slice(lineStart, index))
  return match ? match[0] : ''
}

function applyEdits(text, edits) {
  const ordered = [...edits].sort((a, b) => b.start - a.start)
  let result = text
  for (const edit of ordered) {
    result = result.slice(0, edit.start) + edit.text + result.slice(edit.end)
  }
  return result
}

function removalSpan(text, keyStart, valueClose) {
  const lineStart = text.lastIndexOf('\n', keyStart - 1) + 1
  const before = text.slice(lineStart, keyStart)
  if (/^[ \t]*$/.test(before)) {
    let end = valueClose + 1
    const rest = /^[ \t]*,?[ \t]*(\r?\n)?/.exec(text.slice(end))
    if (rest) end += rest[0].length
    return { start: lineStart, end }
  }
  let start = keyStart
  let end = valueClose + 1
  const trailing = /^\s*,/.exec(text.slice(end))
  if (trailing) end += trailing[0].length
  else {
    const leading = /,\s*$/.exec(text.slice(0, start))
    if (leading) start -= leading[0].length
  }
  return { start, end }
}

// -- transforms ------------------------------------------------------------

const STRING_GLOBAL_AT = /^viewport\s*:\s*(['"])([A-Za-z0-9]+)\1/

export function migrateStringGlobals(text) {
  const edits = []
  codePositions(text, (i) => {
    if (i > 0 && /[\w$]/.test(text[i - 1])) return true
    const match = STRING_GLOBAL_AT.exec(text.slice(i))
    if (match) {
      edits.push({
        start: i,
        end: i + match[0].length,
        text: `viewport: { value: '${resolveAlias(match[2])}', isRotated: false }`,
      })
      return true
    }
    return true
  })
  return applyEdits(text, edits)
}

function normalizeViewportBody(body) {
  const valueMatch = /\bvalue\s*:\s*(['"])([A-Za-z0-9]+)\1/.exec(body)
  if (!valueMatch) return { body, changed: false }
  const rawValue = valueMatch[2]
  const resolved = resolveAlias(rawValue)
  let next = body
  let changed = false
  if (!/\bisRotated\b/.test(body)) {
    const valueEnd = valueMatch.index + valueMatch[0].length
    next = next.slice(0, valueEnd) + ', isRotated: false' + next.slice(valueEnd)
    changed = true
  }
  if (resolved !== rawValue) {
    next = next.replace(valueMatch[0], valueMatch[0].replace(rawValue, resolved))
    changed = true
  }
  return { body: next, changed }
}

export function migrateViewportObjects(text) {
  const ranges = braceRanges(text)
  const edits = []
  const re = /\bviewport\s*:\s*\{/g
  let match
  while ((match = re.exec(text)) !== null) {
    const open = match.index + match[0].length - 1
    const range = ranges.find((r) => r.open === open)
    if (!range) continue
    const body = text.slice(open + 1, range.close)
    if (!/\bvalue\s*:/.test(body)) continue
    const normalized = normalizeViewportBody(body)
    if (normalized.changed) edits.push({ start: open + 1, end: range.close, text: normalized.body })
  }
  return applyEdits(text, edits)
}

function globalObjectLiteral(value) {
  return `{ value: '${resolveAlias(value)}', isRotated: false }`
}

const DEFAULT_VIEWPORT_AT = /^defaultViewport\s*:\s*(['"])([A-Za-z0-9]+)\1/

export function migrateLegacyParameters(text) {
  const problems = []
  let result = text
  for (let guard = 0; guard < 500; guard++) {
    const found = findFirstCodeMatch(result, DEFAULT_VIEWPORT_AT)
    if (!found) break
    const { index, match } = found
    const value = match[2]
    const ranges = braceRanges(result)
    const viewportKeyword = lastMatchBefore(result, /\bviewport\s*:\s*\{/g, index)
    const parametersKeyword = viewportKeyword
      ? lastMatchBefore(result, /\bparameters\s*:\s*\{/g, viewportKeyword.index)
      : null
    if (!viewportKeyword || !parametersKeyword) {
      problems.push('found defaultViewport without an enclosing parameters.viewport object')
      break
    }
    const paramOpen = parametersKeyword.index + parametersKeyword.text.length - 1
    const paramRange = ranges.find((r) => r.open === paramOpen)
    const vpOpen = viewportKeyword.index + viewportKeyword.text.length - 1
    const vpClose = matchingClose(result, vpOpen)
    if (!paramRange || vpClose === -1 || paramRange.close < vpClose) {
      problems.push('could not locate the object that owns parameters')
      break
    }
    const parentRange = ranges.find((r) => r.open === paramRange.parent)
    if (!parentRange) {
      problems.push('could not locate the object that owns parameters')
      break
    }

    const paramKeys = topLevelKeys(result, paramOpen, paramRange.close)
    const parentKeys = topLevelKeys(result, parentRange.open, parentRange.close)
    const literal = globalObjectLiteral(value)
    const removal = paramKeys.size === 1 && paramKeys.has('viewport')
      ? removalSpan(result, parametersKeyword.index, paramRange.close)
      : removalSpan(result, viewportKeyword.index, vpClose)
    const edits = []

    if (parentKeys.has('globals')) {
      edits.push({ start: removal.start, end: removal.end, text: '' })
      const globalsRange = findTopLevelObject(result, parentRange.open, parentRange.close, 'globals')
      if (!globalsRange) {
        problems.push('parameters has a globals sibling that is not an object literal; removed the legacy parameter and review the story')
      } else if (topLevelKeys(result, globalsRange.open, globalsRange.close).has('viewport')) {
        problems.push('a sibling globals.viewport already exists; removed the legacy parameter, review the story')
      } else {
        const indent = lineIndent(result, globalsRange.open)
        edits.push({ start: globalsRange.open + 1, end: globalsRange.open + 1, text: `\n${indent}  viewport: ${literal},` })
      }
    } else if (paramKeys.size === 1 && paramKeys.has('viewport')) {
      edits.push({ start: parametersKeyword.index, end: paramRange.close + 1, text: `globals: { viewport: ${literal} }` })
    } else {
      edits.push({ start: removal.start, end: removal.end, text: '' })
      const indent = lineIndent(result, parametersKeyword.index)
      edits.push({
        start: parametersKeyword.index - indent.length,
        end: parametersKeyword.index - indent.length,
        text: `${indent}globals: { viewport: ${literal} },\n`,
      })
    }

    result = applyEdits(result, edits)
  }
  return { text: result, problems }
}

export function migrateStoryText(text) {
  const withStrings = migrateStringGlobals(text)
  const withObjects = migrateViewportObjects(withStrings)
  const migrated = migrateLegacyParameters(withObjects)
  return { text: migrated.text, problems: migrated.problems }
}

// -- checks ----------------------------------------------------------------

function collectViewportObjects(text) {
  const ranges = braceRanges(text)
  const objects = []
  const re = /\bviewport\s*:\s*\{/g
  let match
  while ((match = re.exec(text)) !== null) {
    const open = match.index + match[0].length - 1
    const range = ranges.find((r) => r.open === open)
    if (range) objects.push({ open, close: range.close, body: text.slice(open + 1, range.close) })
  }
  return objects
}

function checkPreview(file) {
  const errors = []
  let text
  try {
    text = readFileSync(file, 'utf8')
  } catch {
    errors.push(`${relative(repoRoot, file)} is missing`)
    return errors
  }
  const rel = relative(repoRoot, file)
  const initial = /initialGlobals\s*:\s*\{([^}]*)\}/.exec(text)
  if (initial) {
    const body = initial[1]
    if (/\bviewport\s*:\s*(['"])/.test(body)) errors.push(`${rel}: initialGlobals.viewport must be an object global`)
    if (/\bviewport\s*:\s*\{/.test(body) && !/isRotated/.test(body)) {
      errors.push(`${rel}: initialGlobals.viewport must include isRotated`)
    }
  }
  if (/\bdefaultViewport\s*:/.test(text)) {
    errors.push(`${rel}: parameters.viewport.defaultViewport is removed in Storybook 10`)
  }
  return errors
}

function checkStory(file) {
  const errors = []
  const text = readFileSync(file, 'utf8')
  const rel = relative(repoRoot, file)
  const stringGlobal = findFirstCodeMatch(text, STRING_GLOBAL_AT)
  if (stringGlobal) {
    errors.push(`${rel}: string viewport global '${stringGlobal.match[2]}' must be an object with isRotated`)
  }
  if (findFirstCodeMatch(text, DEFAULT_VIEWPORT_AT)) {
    errors.push(`${rel}: parameters.viewport.defaultViewport must move to globals.viewport`)
  }
  for (const object of collectViewportObjects(text)) {
    const valueMatch = /\bvalue\s*:\s*(['"])([A-Za-z0-9]+)\1/.exec(object.body)
    if (!valueMatch) continue
    const value = valueMatch[2]
    if (Object.prototype.hasOwnProperty.call(ALIASES, value)) {
      errors.push(`${rel}: viewport alias '${value}' must use '${ALIASES[value]}'`)
    } else if (!KNOWN_VIEWPORTS.has(value)) {
      errors.push(`${rel}: unknown viewport value '${value}'`)
    }
    if (!/\bisRotated\b/.test(object.body)) {
      errors.push(`${rel}: viewport '${value}' is missing isRotated`)
    }
  }
  return errors
}

export function runCheck() {
  const errors = PREVIEW_FILES.flatMap(checkPreview)
  for (const file of storyFiles()) errors.push(...checkStory(file))
  return errors
}

// -- self test -------------------------------------------------------------

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`self-test failed: ${label}\n--- expected ---\n${expected}\n--- actual ---\n${actual}`)
  }
}

export function selfTestCases() {
  return [
    {
      label: 'meta inline single-key parameter',
      input: `const meta = { title: 'X', parameters: { viewport: { defaultViewport: 'mobileSmall' } } } satisfies Meta\n`,
      expected: `const meta = { title: 'X', globals: { viewport: { value: 'mobileSmall', isRotated: false } } } satisfies Meta\n`,
    },
    {
      label: 'multi-line parameters with extra keys',
      input: `const meta = {\n  title: 'X',\n  parameters: {\n    mobileCanvasPadding: 0,\n    viewport: { defaultViewport: 'mobileDefault' },\n  },\n} satisfies Meta\n`,
      expected: `const meta = {\n  title: 'X',\n  globals: { viewport: { value: 'mobileDefault', isRotated: false } },\n  parameters: {\n    mobileCanvasPadding: 0,\n  },\n} satisfies Meta\n`,
    },
    {
      label: 'story parameters merge into existing globals and keep theme',
      input: `export const Dark: Story = {\n  globals: { theme: 'dark' },\n  parameters: { viewport: { defaultViewport: 'mobileDefault' } },\n}\n`,
      expected: `export const Dark: Story = {\n  globals: {\n    viewport: { value: 'mobileDefault', isRotated: false }, theme: 'dark' },\n}\n`,
    },
    {
      label: 'existing globals after parameters merge without shifting',
      input: `export const Light: Story = {\n  parameters: { viewport: { defaultViewport: 'mobileSmall' } },\n  globals: { theme: 'light' },\n}\n`,
      expected: `export const Light: Story = {\n  globals: {\n    viewport: { value: 'mobileSmall', isRotated: false }, theme: 'light' },\n}\n`,
    },
    {
      label: 'meta parameter with sibling story globals and per-story override',
      input: `const meta = {\n  title: 'X',\n  parameters: { viewport: { defaultViewport: 'mobileSmall' } },\n} satisfies Meta\n\nexport const Dark: Story = { globals: { theme: 'dark' } }\n\nexport const Wide: Story = { globals: { viewport: 'desktop' } }\n`,
      expected: `const meta = {\n  title: 'X',\n  globals: { viewport: { value: 'mobileSmall', isRotated: false } },\n} satisfies Meta\n\nexport const Dark: Story = { globals: { theme: 'dark' } }\n\nexport const Wide: Story = { globals: { viewport: { value: 'desktop', isRotated: false } } }\n`,
    },
    {
      label: 'string global becomes object and keeps theme',
      input: `export const Dark: Story = { globals: { theme: 'dark', viewport: 'mobileSmall' } }\n`,
      expected: `export const Dark: Story = { globals: { theme: 'dark', viewport: { value: 'mobileSmall', isRotated: false } } }\n`,
    },
    {
      label: 'reset maps to desktop',
      input: `export const Wide: Story = { globals: { viewport: 'reset' } }\n`,
      expected: `export const Wide: Story = { globals: { viewport: { value: 'desktop', isRotated: false } } }\n`,
    },
    {
      label: 'mobileTiny alias maps to mobileSmall',
      input: `const meta = { title: 'X', parameters: { viewport: { defaultViewport: 'mobileTiny' } } } satisfies Meta\n`,
      expected: `const meta = { title: 'X', globals: { viewport: { value: 'mobileSmall', isRotated: false } } } satisfies Meta\n`,
    },
    {
      label: 'object global gains isRotated without losing theme',
      input: `export const Dark: Story = { globals: { theme: 'dark', viewport: { value: 'mobileSmall' } } }\n`,
      expected: `export const Dark: Story = { globals: { theme: 'dark', viewport: { value: 'mobileSmall', isRotated: false } } }\n`,
    },
    {
      label: 'object global with extra keys gains isRotated',
      input: `export const Dark: Story = { globals: { viewport: { value: 'mobileSmall', foo: 1 } } }\n`,
      expected: `export const Dark: Story = { globals: { viewport: { value: 'mobileSmall', isRotated: false, foo: 1 } } }\n`,
    },
    {
      label: 'comments and JSX quotes are untouched',
      input: `const meta = {\n  title: 'X',\n  // viewport: 'mobileSmall' in a comment\n  render: () => <span data-note="viewport: 'mobileSmall'" />,\n}\n`,
      expected: `const meta = {\n  title: 'X',\n  // viewport: 'mobileSmall' in a comment\n  render: () => <span data-note="viewport: 'mobileSmall'" />,\n}\n`,
    },
  ]
}

function selfTest() {
  for (const testCase of selfTestCases()) {
    const once = migrateStoryText(testCase.input)
    if (once.problems.length) throw new Error(`self-test failed: ${testCase.label}: ${once.problems.join('; ')}`)
    assertEqual(once.text, testCase.expected, testCase.label)
    const twice = migrateStoryText(once.text)
    assertEqual(twice.text, once.text, `${testCase.label} idempotency`)
    if (twice.problems.length) throw new Error(`self-test failed: ${testCase.label} second pass: ${twice.problems.join('; ')}`)
  }
  console.log(`viewport migration self-test passed (${selfTestCases().length} cases)`)
}

// -- cli -------------------------------------------------------------------

function main() {
  const args = new Set(process.argv.slice(2))
  if (args.has('--self-test')) {
    selfTest()
    return
  }
  if (args.has('--check')) {
    const errors = runCheck()
    if (errors.length) {
      console.error(`Storybook viewport configuration check failed with ${errors.length} issue(s):\n`)
      for (const error of errors) console.error(`  - ${error}`)
      console.error('\nRepair story files with: pnpm storybook:migrate:viewport')
      process.exit(1)
    }
    console.log('Storybook viewport configuration check passed.')
    return
  }

  const write = args.has('--write')
  const changed = []
  const problems = []
  for (const file of storyFiles()) {
    const original = readFileSync(file, 'utf8')
    const { text, problems: fileProblems } = migrateStoryText(original)
    problems.push(...fileProblems.map((problem) => `${relative(repoRoot, file)}: ${problem}`))
    if (text !== original) {
      changed.push(relative(repoRoot, file))
      if (write) writeFileSync(file, text)
    }
  }
  if (write) {
    for (const error of runCheck()) problems.push(`post-write: ${error}`)
  }
  console.log(`${write ? 'Migrated' : 'Would migrate'} ${changed.length} story file(s).`)
  for (const file of changed) console.log(`  - ${file}`)
  if (problems.length) {
    console.warn(`\n${problems.length} pattern(s) need manual review:`)
    for (const problem of problems) console.warn(`  - ${problem}`)
  }
  if (!write && changed.length) {
    console.log('\nDry run. Run `pnpm storybook:migrate:viewport` after other story workers finish.')
  }
  if (write && problems.length) process.exit(1)
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main()
