import { describe, expect, it } from 'vitest'
import { normalizeUsername, usernameBaseFromDisplayName, usernameValidationError } from '@lets-be-friends/shared'

describe('usernames', () => {
  it('normalizes casing and an optional at sign', () => {
    expect(normalizeUsername('  @Maya_Friend ')).toBe('maya_friend')
  })

  it('accepts searchable usernames and rejects ambiguous or reserved ones', () => {
    expect(usernameValidationError('maya_24')).toBeNull()
    expect(usernameValidationError('ma')).toContain('at least 3')
    expect(usernameValidationError('_maya')).toContain('Start and end')
    expect(usernameValidationError('maya-friend')).toContain('letters, numbers, and underscores')
    expect(usernameValidationError('support')).toContain('reserved')
  })

  it('creates safe deterministic bases from display names', () => {
    expect(usernameBaseFromDisplayName('María Santos')).toBe('maria_santos')
    expect(usernameBaseFromDisplayName('Jo')).toBe('friend_jo')
  })
})
