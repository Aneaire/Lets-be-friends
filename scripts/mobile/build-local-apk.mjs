#!/usr/bin/env node
/**
 * Local Android release build for the mobile app.
 *
 * Rules enforced by this script:
 * - The only local artifact is the release-variant APK, app-release.apk.
 *   No debug builds, no app bundles, and no other variants.
 * - The build always embeds the production EXPO_PUBLIC_* values declared in
 *   apps/mobile/eas.json under build.production.env. Values from .env.local are
 *   moved aside for the build and restored afterwards.
 * - The finished APK is copied to artifacts/lets-be-friends-<version>-production.apk
 *   only after the bundle is verified to contain the production values and none
 *   of the local ones.
 *
 * Run from the repo root with: pnpm build:apk
 */
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  copyFileSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
} from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = resolve(fileURLToPath(new URL('../..', import.meta.url)))
const mobileDir = join(repoRoot, 'apps/mobile')
const androidDir = join(mobileDir, 'android')
const APK_RELATIVE = 'app/build/outputs/apk/release/app-release.apk'
const METADATA_RELATIVE = 'app/build/outputs/apk/release/output-metadata.json'
const REQUIRED_KEYS = [
  'EXPO_PUBLIC_CONVEX_URL',
  'EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY',
  'EXPO_PUBLIC_WEB_APP_URL',
]

function fail(message) {
  console.error(`\n✗ ${message}`)
  process.exit(1)
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { stdio: 'inherit', ...options })
  if (result.error) fail(`${command} could not start: ${result.error.message}`)
  if (result.status !== 0) fail(`${command} ${args.join(' ')} exited with ${result.status}`)
}

function runCapture(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: 'utf8', ...options })
  if (result.error) fail(`${command} could not start: ${result.error.message}`)
  if (result.status !== 0) fail(`${command} ${args.join(' ')} exited with ${result.status}`)
  return result.stdout
}

function sha256(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex')
}

function recentApks(directory, since) {
  const found = []
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const fullPath = join(directory, entry.name)
    if (entry.isDirectory()) found.push(...recentApks(fullPath, since))
    else if (entry.name.endsWith('.apk') && statSync(fullPath).mtimeMs >= since) found.push(fullPath)
  }
  return found
}

function formatMegabytes(bytes) {
  return `${(bytes / (1024 * 1024)).toFixed(0)} MB`
}

const appConfig = readJson(join(mobileDir, 'app.json'))
const easConfig = readJson(join(mobileDir, 'eas.json'))
const productionEnv = easConfig?.build?.production?.env ?? {}
const versionName = appConfig?.expo?.version
const versionCode = appConfig?.expo?.android?.versionCode

for (const key of REQUIRED_KEYS) {
  const value = productionEnv[key]
  if (typeof value !== 'string' || value.trim() === '') {
    fail(`eas.json build.production.env is missing ${key}. Local release builds must use production values.`)
  }
}
if (!/^pk_live_/.test(productionEnv.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY)) {
  fail('eas.json build.production.env EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY is not a live Clerk key.')
}
if (!versionName || !Number.isInteger(versionCode)) {
  fail('app.json must define expo.version and expo.android.versionCode for a local release build.')
}
if (!existsSync(join(androidDir, 'gradlew'))) {
  fail('apps/mobile/android is missing. Run the Expo prebuild step before a local release build.')
}

// Read local values before hiding the file, so the finished bundle can be
// checked for accidental leakage of development configuration.
const localEnvPath = join(mobileDir, '.env.local')
const localEnv = {}
if (existsSync(localEnvPath)) {
  for (const line of readFileSync(localEnvPath, 'utf8').split('\n')) {
    const separator = line.indexOf('=')
    if (separator <= 0) continue
    const key = line.slice(0, separator).trim()
    const value = line.slice(separator + 1).trim()
    if (key && value) localEnv[key] = value
  }
}

const backupDir = mkdtempSync(join(tmpdir(), 'lbf-local-apk-'))
const localEnvBackup = join(backupDir, 'env.local')
const startedAt = Date.now()

process.on('exit', () => {
  try {
    if (existsSync(localEnvBackup)) copyFileSync(localEnvBackup, localEnvPath)
    rmSync(backupDir, { recursive: true, force: true })
  } catch {
    // The finally block below owns normal restoration; this is a last resort.
  }
})

// Convert termination signals into a normal exit so the handler above can
// restore .env.local even when the build is interrupted.
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => process.exit(1))
}

try {
  if (existsSync(localEnvPath)) copyFileSync(localEnvPath, localEnvBackup)
  rmSync(localEnvPath, { force: true })

  const buildEnv = {
    ...process.env,
    ...productionEnv,
    NODE_ENV: 'production',
    ANDROID_HOME: process.env.ANDROID_HOME || join(homedir(), 'Android/Sdk'),
  }

  console.log('Building the local Android release APK with production values.')
  console.log(`  version: ${versionName} (${versionCode})`)
  console.log(`  app:     ${APK_RELATIVE}`)

  // A codegen pass must precede the app build. A full Gradle clean deletes
  // MapLibre's generated JNI sources and breaks the app's CMake configure.
  run(join(androidDir, 'gradlew'), ['generateCodegenArtifactsFromSchema'], {
    cwd: androidDir,
    env: buildEnv,
  })

  // Force the JavaScript bundle to regenerate so a cached bundle from a
  // different env can never be packaged. These are the bundle task outputs.
  for (const relative of [
    'app/build/generated/assets/react/release',
    'app/build/generated/sourcemaps/react/release',
  ]) {
    rmSync(join(androidDir, relative), { recursive: true, force: true })
  }

  run(join(androidDir, 'gradlew'), ['assembleRelease'], {
    cwd: androidDir,
    env: buildEnv,
  })
} finally {
  rmSync(localEnvPath, { force: true })
  if (existsSync(localEnvBackup)) copyFileSync(localEnvBackup, localEnvPath)
  rmSync(backupDir, { recursive: true, force: true })
}

const apkPath = join(androidDir, APK_RELATIVE)
const metadataPath = join(androidDir, METADATA_RELATIVE)
if (!existsSync(apkPath)) fail(`The release build did not produce ${APK_RELATIVE}.`)
if (!existsSync(join(androidDir, 'app/build/generated/assets/react/release/index.android.bundle'))) {
  fail('The release build did not regenerate the JavaScript bundle. Refusing to publish a cached bundle.')
}

const metadata = readJson(metadataPath)
const artifact = metadata?.elements?.[0]
if (metadata?.artifactType?.type !== 'APK' || metadata?.artifactType?.kind !== 'Directory') {
  fail('The build did not produce an APK artifact.')
}
if (metadata?.variantName !== 'release') fail(`Expected the release variant, found ${metadata?.variantName}.`)
if (artifact?.outputFile !== 'app-release.apk') fail(`Unexpected APK name: ${artifact?.outputFile}.`)
if (artifact?.versionName !== versionName || artifact?.versionCode !== versionCode) {
  fail(`APK version ${artifact?.versionName} (${artifact?.versionCode}) does not match app.json ${versionName} (${versionCode}).`)
}
const producedApks = recentApks(join(androidDir, 'app/build/outputs/apk'), startedAt)
const unexpectedApks = producedApks.filter((path) => path !== apkPath)
if (unexpectedApks.length > 0) {
  fail(`This build produced APKs other than app-release.apk: ${unexpectedApks.join(', ')}. Only app-release.apk may be produced locally.`)
}

const bundle = spawnSync('unzip', ['-p', apkPath, 'assets/index.android.bundle'], {
  maxBuffer: 128 * 1024 * 1024,
})
if (bundle.error || bundle.status !== 0) fail('The JavaScript bundle could not be read from the APK.')
for (const key of REQUIRED_KEYS) {
  const productionValue = Buffer.from(productionEnv[key])
  if (!bundle.stdout.includes(productionValue)) {
    fail(`The APK bundle does not contain the production value for ${key}.`)
  }
  const localValue = localEnv[key]
  if (localValue && localValue !== productionEnv[key] && bundle.stdout.includes(Buffer.from(localValue))) {
    fail(`The APK bundle contains the local .env.local value for ${key}. Production values are required.`)
  }
}

const artifactsDir = join(repoRoot, 'artifacts')
const publishedPath = join(artifactsDir, `lets-be-friends-${versionName}-production.apk`)
copyFileSync(apkPath, publishedPath)
const size = statSync(publishedPath).size
const sha = sha256(publishedPath)

console.log('\n✓ Local release APK ready')
console.log(`  path:    ${publishedPath}`)
console.log(`  version: ${versionName} (${versionCode})`)
console.log(`  size:    ${formatMegabytes(size)}`)
console.log(`  sha256:  ${sha}`)
console.log(`  env:     production (${REQUIRED_KEYS.length} EXPO_PUBLIC values verified in the bundle)`)
