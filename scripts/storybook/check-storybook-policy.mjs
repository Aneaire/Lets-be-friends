#!/usr/bin/env node
// Practical Storybook story policy check.
//
// Enforces only objective, low-noise rules, using the TypeScript parser so it
// reads the real CSF meta instead of the first `title:` in the file:
//   * every story file has a default export;
//   * the default export resolves to a CSF meta object with a string `title`;
//   * titles are unique across the workspace;
//   * (warning) the story imports at least one relative component module, so it
//     is reusing production code instead of reimplementing it.
//
// Connected containers and native provider modules may be covered through their
// presentation boundary, so a missing direct story is never an error.

import { readFileSync } from 'node:fs'
import { readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const repoRoot = fileURLToPath(new URL('../../', import.meta.url))
const STORY_ROOTS = [
  join(repoRoot, 'apps/web/src'),
  join(repoRoot, 'apps/admin/src'),
  join(repoRoot, 'apps/mobile/src'),
]
const requireFromWeb = createRequire(join(repoRoot, 'apps/web/package.json'))

let ts
try {
  ts = requireFromWeb('typescript')
} catch {
  console.error('Storybook policy check requires the workspace TypeScript parser (apps/web/node_modules/typescript).')
  process.exit(2)
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

function unwrapExpression(node) {
  let current = node
  while (
    current &&
    (ts.isAsExpression(current) ||
      ts.isParenthesizedExpression(current) ||
      current.kind === ts.SyntaxKind.SatisfiesExpression)
  ) {
    current = current.expression
  }
  return current
}

function titleFromObject(object) {
  if (!ts.isObjectLiteralExpression(object)) return null
  for (const property of object.properties) {
    if (!ts.isPropertyAssignment(property)) continue
    const name = property.name
    const isTitle = (ts.isIdentifier(name) && name.text === 'title') ||
      (ts.isStringLiteral(name) && name.text === 'title')
    if (!isTitle) continue
    const initializer = unwrapExpression(property.initializer)
    if (ts.isStringLiteral(initializer) || ts.isNoSubstitutionTemplateLiteral(initializer)) return initializer.text
  }
  return null
}

function extractMetaTitle(source) {
  let defaultExpression = null
  for (const statement of source.statements) {
    if (ts.isExportAssignment(statement) && !statement.isExportEquals) {
      defaultExpression = statement.expression
      break
    }
  }
  if (!defaultExpression) return null
  const resolved = unwrapExpression(defaultExpression)
  if (ts.isObjectLiteralExpression(resolved)) return titleFromObject(resolved)
  if (!ts.isIdentifier(resolved)) return null
  const wanted = resolved.text
  for (const statement of source.statements) {
    if (!ts.isVariableStatement(statement)) continue
    for (const declaration of statement.declarationList.declarations) {
      if (!ts.isIdentifier(declaration.name) || declaration.name.text !== wanted) continue
      const initializer = declaration.initializer ? unwrapExpression(declaration.initializer) : null
      const title = initializer ? titleFromObject(initializer) : null
      if (title) return title
    }
  }
  return null
}

function hasRelativeComponentImport(source) {
  for (const statement of source.statements) {
    if (!ts.isImportDeclaration(statement)) continue
    if (!ts.isStringLiteral(statement.moduleSpecifier)) continue
    const specifier = statement.moduleSpecifier.text
    if (!specifier.startsWith('.')) continue
    if (specifier.includes('.stories') || specifier.includes('/fixtures')) continue
    return true
  }
  return false
}

function main() {
  const errors = []
  const warnings = []
  const titles = new Map()
  const files = storyFiles()

  for (const file of files) {
    const rel = relative(repoRoot, file)
    const text = readFileSync(file, 'utf8')
    const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true,
      file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)

    const hasDefault = source.statements.some(
      (statement) => ts.isExportAssignment(statement) && !statement.isExportEquals,
    )
    if (!hasDefault) {
      errors.push(`${rel}: missing default export (CSF meta)`)
      continue
    }

    const title = extractMetaTitle(source)
    if (!title) {
      errors.push(`${rel}: default export does not resolve to a CSF meta with a string title`)
    } else if (titles.has(title)) {
      errors.push(`${rel}: duplicate title '${title}' (also in ${titles.get(title)})`)
    } else {
      titles.set(title, rel)
    }

    if (!hasRelativeComponentImport(source)) {
      warnings.push(`${rel}: no relative component import detected; confirm this story reuses a shared component`)
    }
  }

  console.log(`Storybook policy checked ${files.length} story file(s).`)
  for (const warning of warnings) console.warn(`  warning: ${warning}`)
  if (errors.length) {
    console.error(`\nStorybook policy check failed with ${errors.length} error(s):`)
    for (const error of errors) console.error(`  - ${error}`)
    process.exit(1)
  }
  console.log('Storybook policy check passed.')
}

main()
