import { canSaveProfileEdit, profileEditFieldCopy, PROFILE_BIO_MAX, PROFILE_NAME_MAX } from '@/member/profileEditFields'

describe('profile edit field copy', () => {
  it('shows the live character counter for title and bio', () => {
    const result = profileEditFieldCopy('Alex Rivera', 'Coffee enthusiast')
    expect(result.nameLength).toBe(11)
    expect(result.bioLength).toBe(17)
    expect(result.nameHint).toBe(`11/${PROFILE_NAME_MAX} characters. Shown to other members.`)
    expect(result.bioHint).toBe(`17/${PROFILE_BIO_MAX} characters. A short introduction for your member profile.`)
  })

  it('requires a display name', () => {
    const result = profileEditFieldCopy('   ', 'Bio')
    expect(result.nameError).toBe('Display name is required.')
    expect(result.nameLength).toBe(0)
    expect(canSaveProfileEdit(result.nameLength, result.bioLength, false)).toBe(false)
  })

  it('rejects a display name past the maximum while keeping the counter visible in the error', () => {
    const longName = 'a'.repeat(PROFILE_NAME_MAX + 1)
    const result = profileEditFieldCopy(longName, 'Bio')
    expect(result.nameError).toBe(`Display name must be ${PROFILE_NAME_MAX} characters or fewer.`)
    expect(result.bioError).toBeUndefined()
    expect(canSaveProfileEdit(result.nameLength, result.bioLength, false)).toBe(false)
  })

  it('rejects a bio past the maximum', () => {
    const result = profileEditFieldCopy('Alex', 'b'.repeat(PROFILE_BIO_MAX + 1))
    expect(result.bioError).toBe(`Bio must be ${PROFILE_BIO_MAX} characters or fewer.`)
    expect(canSaveProfileEdit(result.nameLength, result.bioLength, false)).toBe(false)
  })
})

describe('can save profile edit', () => {
  it('allows a valid name and bio when not busy', () => {
    expect(canSaveProfileEdit(1, 0, false)).toBe(true)
    expect(canSaveProfileEdit(80, 500, false)).toBe(true)
  })

  it('blocks saving while busy or under-long name', () => {
    expect(canSaveProfileEdit(11, 0, true)).toBe(false)
    expect(canSaveProfileEdit(0, 0, false)).toBe(false)
    expect(canSaveProfileEdit(81, 0, false)).toBe(false)
  })
})
