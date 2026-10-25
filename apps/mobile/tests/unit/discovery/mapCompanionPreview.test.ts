import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const nativeMap = readFileSync(join(process.cwd(), 'src/design-system/organisms/ProductMap.native.tsx'), 'utf8')
const nearbyScreen = readFileSync(join(process.cwd(), 'src/app/nearby.tsx'), 'utf8')
const companionSheet = readFileSync(join(process.cwd(), 'src/features/discovery/NearbyCompanionSheet.tsx'), 'utf8')

describe('map pins show Companion photos', () => {
  it('renders the profile photo inside a pin that falls back to initials', () => {
    expect(nativeMap).toContain('point.imageUrl')
    expect(nativeMap).toMatch(/<Image[^>]*source=\{\{ uri: point\.imageUrl \}\}/)
    expect(nativeMap).toContain('initials(point.name)')
  })

  it('selects the Companion instead of navigating away on pin press', () => {
    expect(nativeMap).toContain('onSelectPoint?.(point.id)')
    expect(nativeMap).toContain("accessibilityLabel={`Show ${point.name}'s details`}")
  })
})

describe('Companion preview sheet', () => {
  it('shows identity, rating and Strengths for the selected pin', () => {
    expect(companionSheet).toContain('<Avatar uri={companion.imageUrl}')
    expect(companionSheet).toContain('nearbyCompanionRating(companion)')
    expect(companionSheet).toContain('nearbyCompanionStrengths(companion)')
  })

  it('offers Message and View profile actions', () => {
    expect(companionSheet).toContain('label="Message"')
    expect(companionSheet).toContain('label="View profile"')
    expect(companionSheet).toContain('onMessage')
    expect(companionSheet).toContain('onViewProfile')
  })

  it('keeps Message unavailable without a signed-in member or Companion account', () => {
    expect(companionSheet).toContain('const canMessage = Boolean(companion?.userId) && signedIn')
    expect(companionSheet).toContain('disabled={!canMessage}')
  })
})

describe('Nearby pin selection flow', () => {
  it('opens the Companion sheet from a pin tap', () => {
    expect(nearbyScreen).toContain('onSelectPoint={openCompanionPreview}')
    expect(nearbyScreen).toContain('setSelectedCompanion(companion)')
    expect(nearbyScreen).toContain('setCompanionSheetOpen(true)')
    expect(nearbyScreen).toContain('<NearbyCompanionSheet')
  })

  it('starts a conversation from the Message action', () => {
    expect(nearbyScreen).toContain('startConversation({ otherUserId: selectedCompanion.userId as UserId })')
    expect(nearbyScreen).toContain("pathname: '/conversation/[id]'")
    expect(nearbyScreen).toContain('onMessage={() => void messageCompanion()}')
  })

  it('opens the Companion profile from View profile', () => {
    expect(nearbyScreen).toContain("router.push({ pathname: '/companion-profile/[id]', params: { id: selectedCompanion.id } })")
    expect(nearbyScreen).toContain('onViewProfile={openCompanion}')
  })
})
