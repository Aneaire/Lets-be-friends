import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const profileSource = readFileSync(join(process.cwd(), 'src/app/companion-profile/[id].tsx'), 'utf8')
const listSource = readFileSync(join(process.cwd(), 'src/features/companion/CompanionProfilePostList.tsx'), 'utf8')

describe('Companion profile post surface', () => {
  it('keeps profile posts on the shared social post card instead of a bespoke renderer', () => {
    expect(profileSource).toContain('<CompanionProfilePostList')
    expect(profileSource).not.toContain('function ProfilePost(')
    expect(profileSource).not.toContain('<PostCard')
    expect(profileSource).not.toContain('<PostContent')
  })

  it('passes signed-in state, follow wiring, and the profile photo viewer to the shared card', () => {
    expect(profileSource).toContain('signedIn={signedIn}')
    expect(profileSource).toContain('following={following}')
    expect(profileSource).toContain("followBusy={busy === 'follow'}")
    expect(profileSource).toContain('onToggleFollow={signedIn && !ownProfile && companion.userId ? updateFollowing : undefined}')
    expect(profileSource).toContain('onOpenImage={setViewerImage}')
  })

  it('renders every enriched post through SocialPostCard without an adapter', () => {
    expect(listSource).toContain('SocialPostCard')
    expect(listSource).toContain('post={post}')
    expect(listSource).not.toContain('asSocialPostView')
  })
})
