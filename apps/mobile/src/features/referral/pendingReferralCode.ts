const PENDING_REFERRAL_CODE_KEY = 'lets-be-friends-referral-code'
const memory = new Map<string, string>()

/**
 * Default in-memory store. Metro and jest-expo resolve the platform file
 * (`.native`, `.web`) when present.
 */
export async function readPendingReferralCode(): Promise<string | null> {
  return memory.get(PENDING_REFERRAL_CODE_KEY) ?? null
}

export async function savePendingReferralCode(code: string): Promise<void> {
  memory.set(PENDING_REFERRAL_CODE_KEY, code)
}

export async function clearPendingReferralCode(): Promise<void> {
  memory.delete(PENDING_REFERRAL_CODE_KEY)
}
