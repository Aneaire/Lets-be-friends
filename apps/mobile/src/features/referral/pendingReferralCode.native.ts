import * as SecureStore from 'expo-secure-store'

const PENDING_REFERRAL_CODE_KEY = 'lets-be-friends-referral-code'

export async function readPendingReferralCode(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(PENDING_REFERRAL_CODE_KEY)
  } catch {
    return null
  }
}

export async function savePendingReferralCode(code: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(PENDING_REFERRAL_CODE_KEY, code)
  } catch {
    // A storage failure only loses the prefill; the member can still type it.
  }
}

export async function clearPendingReferralCode(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(PENDING_REFERRAL_CODE_KEY)
  } catch {
    // Clearing is best effort.
  }
}
