import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const profileSource = readFileSync(join(process.cwd(), 'src/app/companion-profile/[id].tsx'), 'utf8')

describe('Companion profile layout', () => {
  it('names the header Profile and keeps safety actions in the header overflow menu', () => {
    expect(profileSource).toContain('<AppHeader title="Profile"')
    expect(profileSource).toContain('<ProfileSafetyMenu')
    expect(profileSource).toContain('onNotice={setMessage}')
    expect(profileSource).not.toContain('<MemberSafetyActions')
    expect(profileSource).not.toContain('targetType="profile"')
  })

  it('gives the weekly availability card its own gap below the hourly rate card', () => {
    expect(profileSource).toContain('<RateHighlight value={companion.rateLabel} />')
    expect(profileSource).toContain('<View style={styles.availability}>')
    expect(profileSource).toContain('availability: { marginTop: 12 }')
  })
})
