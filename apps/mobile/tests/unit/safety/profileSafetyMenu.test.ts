import { profileSafetyMenuEntries, type ProfileSafetyMenuRelationship } from '@/features/safety/profileSafetyMenu'

const connected: ProfileSafetyMenuRelationship = {
  blocked: false,
  muted: false,
  blockedByOther: false,
}

describe('profile safety menu', () => {
  it('keeps report, mute, and block in one overflow menu', () => {
    const entries = profileSafetyMenuEntries({ relationship: connected })

    expect(entries.map((entry) => entry.label)).toEqual(['Report this profile', 'Mute', 'Block member'])
    expect(entries.map((entry) => entry.kind)).toEqual(['report', 'mute', 'block'])
    expect(entries[0].tone).toBe('danger')
    expect(entries[2].tone).toBe('danger')
  })

  it('mirrors a muted and blocked connection with reversing labels', () => {
    const entries = profileSafetyMenuEntries({
      relationship: { blocked: true, muted: true, blockedByOther: false },
    })

    expect(entries[1].label).toBe('Unmute')
    expect(entries[1].icon).toBe('notifications-outline')
    expect(entries[2].label).toBe('Unblock member')
    expect(entries[2].tone).toBe('neutral')
  })

  it('waits for the relationship before enabling mute and block', () => {
    const loading = profileSafetyMenuEntries({})

    expect(loading.find((entry) => entry.kind === 'report')?.disabled).toBe(false)
    expect(loading.find((entry) => entry.kind === 'mute')?.disabled).toBe(true)
    expect(loading.find((entry) => entry.kind === 'block')?.disabled).toBe(true)
  })

  it('locks every entry while a safety change is in flight', () => {
    const busy = profileSafetyMenuEntries({ relationship: connected, busy: 'block' })

    expect(busy.every((entry) => entry.disabled)).toBe(true)
  })
})
