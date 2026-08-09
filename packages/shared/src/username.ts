export const USERNAME_MIN_LENGTH = 3
export const USERNAME_MAX_LENGTH = 24

const reservedUsernames = new Set([
  'admin',
  'help',
  'letsbefriends',
  'moderator',
  'safety',
  'support',
  'system',
])

export function normalizeUsername(value: string) {
  return value.trim().replace(/^@+/, '').toLowerCase()
}

export function usernameValidationError(value: string) {
  const username = normalizeUsername(value)
  if (username.length < USERNAME_MIN_LENGTH) return `Use at least ${USERNAME_MIN_LENGTH} characters.`
  if (username.length > USERNAME_MAX_LENGTH) return `Use no more than ${USERNAME_MAX_LENGTH} characters.`
  if (!/^[a-z0-9_]+$/.test(username)) return 'Use only letters, numbers, and underscores.'
  if (!/^[a-z0-9].*[a-z0-9]$/.test(username)) return 'Start and end with a letter or number.'
  if (reservedUsernames.has(username)) return 'This username is reserved.'
  return null
}

export function usernameBaseFromDisplayName(displayName: string) {
  const base = displayName
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, USERNAME_MAX_LENGTH)
    .replace(/_+$/g, '')

  if (base.length >= USERNAME_MIN_LENGTH && !reservedUsernames.has(base)) return base
  const fallback = `friend_${base || 'member'}`.slice(0, USERNAME_MAX_LENGTH).replace(/_+$/g, '')
  return reservedUsernames.has(fallback) ? `${fallback}_1`.slice(0, USERNAME_MAX_LENGTH) : fallback
}
