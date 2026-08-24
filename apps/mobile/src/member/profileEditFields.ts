export const PROFILE_NAME_MAX = 80
export const PROFILE_BIO_MAX = 500

export function profileEditFieldCopy(displayName: string, bio: string) {
  const nameLength = displayName.trim().length
  const bioLength = bio.trim().length
  const nameError = nameLength === 0
    ? 'Display name is required.'
    : nameLength > PROFILE_NAME_MAX
      ? `Display name must be ${PROFILE_NAME_MAX} characters or fewer.`
      : undefined
  const bioError = bioLength > PROFILE_BIO_MAX
    ? `Bio must be ${PROFILE_BIO_MAX} characters or fewer.`
    : undefined
  return {
    nameLength,
    bioLength,
    nameHint: `${nameLength}/${PROFILE_NAME_MAX} characters. Shown to other members.`,
    nameError,
    bioHint: `${bioLength}/${PROFILE_BIO_MAX} characters. A short introduction for your member profile.`,
    bioError,
  }
}

export function canSaveProfileEdit(nameLength: number, bioLength: number, busy: boolean) {
  return nameLength > 0 && nameLength <= PROFILE_NAME_MAX && bioLength <= PROFILE_BIO_MAX && !busy
}
