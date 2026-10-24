import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const nativeMap = readFileSync(join(process.cwd(), 'src/design-system/organisms/ProductMap.native.tsx'), 'utf8')
const nearbyScreen = readFileSync(join(process.cwd(), 'src/app/nearby.tsx'), 'utf8')

describe('native map zoom and gesture access', () => {
  it('offers an explicit zoom in and zoom out control so zoom never depends on a pinch', () => {
    expect(nativeMap).toContain('label="Zoom in"')
    expect(nativeMap).toContain('label="Zoom out"')
    expect(nativeMap).toContain('cameraRef.current?.zoomTo')
  })

  it('keeps pan and pinch gestures enabled on the native map', () => {
    expect(nativeMap).toContain('dragPan')
    expect(nativeMap).toContain('touchZoom')
    expect(nativeMap).toContain('doubleTapZoom')
  })

  it('reports finger down and finger up so the enclosing list can stop scrolling', () => {
    expect(nativeMap).toContain('onTouchStart')
    expect(nativeMap).toContain('onTouchEnd')
    expect(nativeMap).toContain('onTouchCancel')
    expect(nativeMap).toContain('onInteractionChange')
  })
})

describe('nearby discovery scroll containers', () => {
  it('stops the result list from scrolling while a finger is on the map', () => {
    expect(nearbyScreen).toContain('const [mapInteracting, setMapInteracting] = useState(false)')
    expect(nearbyScreen.match(/onInteractionChange=\{setMapInteracting\}/g)?.length).toBe(3)
    expect(nearbyScreen).toContain('scrollEnabled={!mapInteracting}')
  })

  it('covers both the flat list and the scroll view that host the map', () => {
    expect(nearbyScreen).toMatch(/<FlatList[\s\S]*?scrollEnabled=\{!mapInteracting\}/)
    expect(nearbyScreen).toMatch(/<ScrollView[\s\S]*?scrollEnabled=\{!mapInteracting\}/)
  })
})
