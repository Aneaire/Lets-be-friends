import ioniconsGlyphMap from '@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/Ionicons.json'

import { resolveIoniconsGlyph } from '../../../.storybook/mocks/Ionicons'

const PRODUCTION_ICONS = [
  'heart',
  'heart-outline',
  'chatbubble-outline',
  'chatbubbles',
  'chatbubbles-outline',
  'bookmark',
  'bookmark-outline',
  'share-social-outline',
  'star',
  'star-outline',
  'home',
  'home-outline',
  'compass',
  'compass-outline',
  'person-circle',
  'person-circle-outline',
  'person',
  'person-outline',
  'person-add-outline',
  'calendar-outline',
  'checkmark',
  'checkmark-circle-outline',
  'checkmark-done-outline',
  'chevron-forward',
  'chevron-back',
  'chevron-up',
  'chevron-down',
  'close',
  'close-outline',
  'search',
  'document-outline',
  'cloud-offline-outline',
  'people-outline',
  'hourglass-outline',
  'settings-outline',
  'lock-closed-outline',
  'trash-outline',
  'flag-outline',
  'ellipsis-horizontal',
  'sparkles-outline',
  'notifications-outline',
  'wallet-outline',
  'shield-checkmark',
  'shield-checkmark-outline',
  'shield-outline',
  'mail-open-outline',
  'stats-chart-outline',
  'log-out-outline',
  'git-branch-outline',
  'time-outline',
  'images-outline',
  'image-outline',
  'play-circle-outline',
  'videocam-outline',
  'refresh-outline',
  'remove-outline',
  'add-outline',
  'send-outline',
  'arrow-back',
  'arrow-forward',
  'call-outline',
  'logo-google',
  'options-outline',
  'map-outline',
  'locate-outline',
  'eye-outline',
  'eye-off-outline',
] as const

describe('storybook Ionicons adapter', () => {
  it('maps every production icon to the installed Ionicons glyph', () => {
    for (const name of PRODUCTION_ICONS) {
      expect(typeof ioniconsGlyphMap[name]).toBe('number')
      expect(resolveIoniconsGlyph(name)).toBe(String.fromCodePoint(ioniconsGlyphMap[name]))
    }
  })

  it('keeps filled and outline social and review glyphs visually distinct', () => {
    const pairs = [
      ['heart', 'heart-outline'],
      ['bookmark', 'bookmark-outline'],
      ['chatbubbles', 'chatbubbles-outline'],
      ['star', 'star-outline'],
    ] as const

    for (const [filled, outline] of pairs) {
      expect(resolveIoniconsGlyph(filled)).not.toBe('')
      expect(resolveIoniconsGlyph(filled)).not.toBe(resolveIoniconsGlyph(outline))
    }
  })

  it('falls back to the @expo/vector-icons placeholder for unknown names', () => {
    expect(resolveIoniconsGlyph('not-a-real-ionicon')).toBe('?')
  })
})
