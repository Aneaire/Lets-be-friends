import {
  clearPendingReferralCode,
  readPendingReferralCode,
  savePendingReferralCode,
} from '@/features/referral/pendingReferralCode.web'

function memoryStorage() {
  const values = new Map<string, string>()
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => void values.set(key, value),
    removeItem: (key: string) => void values.delete(key),
  }
}

describe('web pending referral code', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: memoryStorage(),
    })
  })

  it('saves, reads, and clears the invitation', async () => {
    await expect(savePendingReferralCode('ABCD12')).resolves.toBe(true)
    await expect(readPendingReferralCode()).resolves.toBe('ABCD12')
    await clearPendingReferralCode()
    await expect(readPendingReferralCode()).resolves.toBeNull()
  })

  it('survives unavailable storage without throwing', async () => {
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() {
        throw new Error('blocked')
      },
    })
    await expect(savePendingReferralCode('ABCD12')).resolves.toBe(false)
    await expect(readPendingReferralCode()).resolves.toBeNull()
    await expect(clearPendingReferralCode()).resolves.toBeUndefined()
  })
})
