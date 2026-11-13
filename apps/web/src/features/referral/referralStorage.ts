import { REFERRAL_CODE_STORAGE_KEY } from '@lets-be-friends/shared'

type SavedReferralCode = {
  code: string
  clerkUserId?: string
}

function readStored(): SavedReferralCode | null {
  try {
    const raw = window.localStorage.getItem(REFERRAL_CODE_STORAGE_KEY)
    if (!raw) return null
    try {
      const parsed = JSON.parse(raw) as unknown
      if (typeof parsed === 'string') return { code: parsed }
      if (parsed && typeof parsed === 'object') {
        const candidate = parsed as { code?: unknown; clerkUserId?: unknown }
        if (typeof candidate.code === 'string') {
          return {
            code: candidate.code,
            clerkUserId: typeof candidate.clerkUserId === 'string' ? candidate.clerkUserId : undefined,
          }
        }
      }
      return null
    } catch {
      // Older builds stored the plain code string.
      return { code: raw }
    }
  } catch {
    return null
  }
}

function writeStored(value: SavedReferralCode): void {
  try {
    window.localStorage.setItem(REFERRAL_CODE_STORAGE_KEY, JSON.stringify(value))
  } catch {
    // The link still works when storage is unavailable.
  }
}

/**
 * Reads the saved invitation for one account. A code saved before sign-in is
 * unbound and available to the first account that binds it.
 */
export function readSavedReferralCode(clerkUserId?: string): string | null {
  const saved = readStored()
  if (!saved) return null
  if (saved.clerkUserId && !clerkUserId) return null
  if (saved.clerkUserId && saved.clerkUserId !== clerkUserId) return null
  return saved.code
}

export function saveReferralCode(code: string): void {
  writeStored({ code })
}

/**
 * Binds an unclaimed invitation to the first signed-in account that sees it.
 * Returns the code when this account owns the saved invitation.
 */
export function bindSavedReferralCode(clerkUserId: string): string | null {
  const saved = readStored()
  if (!saved) return null
  if (saved.clerkUserId && saved.clerkUserId !== clerkUserId) return null
  if (!saved.clerkUserId) writeStored({ ...saved, clerkUserId })
  return saved.code
}

export function clearSavedReferralCode(): void {
  try {
    window.localStorage.removeItem(REFERRAL_CODE_STORAGE_KEY)
  } catch {
    // Clearing is best effort.
  }
}
