import { mobileReferralDeviceId } from '@/features/referral/referralDevice'

function adapter(installationId: string | Error) {
  return {
    ensureInstallation: async () => {
      if (installationId instanceof Error) throw installationId
      return { installationId, freshInstall: false }
    },
  }
}

describe('mobile referral device id', () => {
  it('returns the installation identifier used for the same-device signal', async () => {
    await expect(mobileReferralDeviceId(adapter(' device-1 '))).resolves.toBe('device-1')
  })

  it('returns undefined when the platform has no identifier', async () => {
    await expect(mobileReferralDeviceId(adapter(''))).resolves.toBeUndefined()
  })

  it('returns undefined instead of blocking a legitimate claim when lookup fails', async () => {
    await expect(mobileReferralDeviceId(adapter(new Error('secure storage unavailable'))))
      .resolves.toBeUndefined()
  })
})
