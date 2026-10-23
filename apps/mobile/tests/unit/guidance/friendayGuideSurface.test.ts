import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const source = (path: string) => readFileSync(join(process.cwd(), 'src', path), 'utf8')

describe('native Frienday guide surface', () => {
  it('registers the full guide route', () => {
    expect(source('app/_layout.tsx')).toContain('<Stack.Screen name="frienday-guide" />')
  })

  it('renders every shared guide section from the catalog', () => {
    const guide = source('app/frienday-guide.tsx')
    for (const section of ['friendaySteps', 'friendayCheckins', 'friendaySafetyGroups', 'friendayNotAllowed', 'friendayPromise']) {
      expect(guide).toContain(section)
    }
  })

  it('links the Home guidance card to the full guide and carries activity imagery', () => {
    const card = source('features/guidance/FriendayGuideCard.tsx')
    expect(card).toContain("router.push('/frienday-guide')")
    expect(card).toContain("require('../../../assets/images/frienday/frienday-cafe-conversation.jpg')")
    expect(card).toContain('Read the full Frienday guide')
  })
})
