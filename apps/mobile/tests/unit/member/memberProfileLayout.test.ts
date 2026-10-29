import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const profileSource = readFileSync(join(process.cwd(), 'src/app/member-profile/[id].tsx'), 'utf8')

describe('Member profile layout', () => {
  it('keeps safety actions in the header overflow menu instead of a trailing disclosure', () => {
    expect(profileSource).toContain('<ProfileSafetyMenu')
    expect(profileSource).toContain('reportTarget="member"')
    expect(profileSource).toContain('onNotice={setMessage}')
    expect(profileSource).not.toContain('<MemberSafetyActions')
    expect(profileSource).not.toContain('<ReportAction')
    expect(profileSource).not.toContain('Safety and privacy')
  })
})
