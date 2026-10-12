import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)

function vendoredPath(name: string): string {
  return new URL(`../../public/maplibre/${name}`, import.meta.url).pathname
}

describe('map worker assets', () => {
  it.each(['maplibre-gl-worker.mjs', 'maplibre-gl-shared.mjs'])(
    'vendors %s byte-identical to the installed maplibre-gl package',
    (name) => {
      const installed = readFileSync(require.resolve(`maplibre-gl/dist/${name}`))
      const vendored = readFileSync(vendoredPath(name))
      expect(vendored.equals(installed)).toBe(true)
    },
  )

  it('vendors the worker matching the installed maplibre-gl version', () => {
    const version: string = require('maplibre-gl/package.json').version
    const worker = readFileSync(vendoredPath('maplibre-gl-worker.mjs'), 'utf8')
    expect(worker).toContain(`maplibre-gl-js/blob/v${version}/`)
  })
})
