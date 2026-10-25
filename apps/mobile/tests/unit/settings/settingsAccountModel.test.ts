import { settingsAccountModel } from '@/features/settings/settingsAccountModel'

describe('settings account model', () => {
  it('keeps approved identity display-only with no new verification flow', () => {
    const model = settingsAccountModel({
      verificationStatus: 'approved',
      verification: { adminStatus: 'approved', personaStatus: 'completed', identityStage: 'approved' },
      identityEligible: true,
      applicationStatus: 'approved',
    })

    expect(model.verificationAction).toBe('none')
    expect(model.showVerificationFlow).toBe(false)
    expect(model.showWithdrawals).toBe(true)
    expect(model.showCompanionSections).toBe(true)
  })

  it('routes unverified members into the verification flow', () => {
    const model = settingsAccountModel({
      verificationStatus: 'not_started',
      verification: null,
      identityEligible: false,
      applicationStatus: null,
    })

    expect(model.verificationAction).toBe('verify')
    expect(model.showVerificationFlow).toBe(true)
    expect(model.showWithdrawals).toBe(false)
    expect(model.showCompanionSections).toBe(false)
  })

  it('offers retry after rejection without companion sections', () => {
    const model = settingsAccountModel({
      verificationStatus: 'rejected',
      verification: { adminStatus: 'rejected', personaStatus: 'completed', identityStage: 'rejected' },
      identityEligible: false,
      applicationStatus: 'pending_review',
    })

    expect(model.verificationAction).toBe('retry')
    expect(model.showCompanionSections).toBe(false)
  })
})
