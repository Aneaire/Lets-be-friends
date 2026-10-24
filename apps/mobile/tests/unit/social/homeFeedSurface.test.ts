import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const homeSource = readFileSync(join(process.cwd(), 'src/app/(tabs)/index.tsx'), 'utf8')

describe('native Home feed surface', () => {
  it('keeps the feed to the composer, filters, and posts', () => {
    expect(homeSource).toContain('<PostComposer')
    expect(homeSource).toContain('<SegmentedControl')
    expect(homeSource).toContain('<SocialFeedCard')
  })

  it('does not stack side guidance or circle cards above the feed', () => {
    expect(homeSource).not.toContain('FriendayGuideCard')
    expect(homeSource).not.toContain('CurrentCircleContextCard')
  })
})
