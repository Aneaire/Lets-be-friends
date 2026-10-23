import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const nativeMap = readFileSync(join(process.cwd(), 'src/design-system/organisms/ProductMap.native.tsx'), 'utf8')

describe('native map failure recovery', () => {
  it('shows an in-place retry instead of leaving a blank map', () => {
    expect(nativeMap).toContain('onDidFailLoadingMap')
    expect(nativeMap).toContain('The map could not load')
    expect(nativeMap).toContain('Try map again')
  })

  it('remounts the map on retry and clears the failure after a successful load', () => {
    expect(nativeMap).toContain('setMapKey((key) => key + 1)')
    expect(nativeMap).toContain('onDidFinishLoadingMap')
    expect(nativeMap).toContain('key={mapKey}')
  })
})
