// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest'
import {
  bindSavedReferralCode,
  clearSavedReferralCode,
  readSavedReferralCode,
  saveReferralCode,
} from '../../src/features/referral/referralStorage'

afterEach(() => {
  clearSavedReferralCode()
})

describe('saved referral invitation', () => {
  it('keeps an invitation available until the member claims or dismisses it', () => {
    saveReferralCode('ABCD12')
    expect(readSavedReferralCode('user-1')).toBe('ABCD12')
    expect(readSavedReferralCode()).toBe('ABCD12')
  })

  it('binds an unclaimed invitation to the first account that sees it', () => {
    saveReferralCode('ABCD12')
    expect(bindSavedReferralCode('user-1')).toBe('ABCD12')

    expect(readSavedReferralCode('user-1')).toBe('ABCD12')
    expect(readSavedReferralCode('user-2')).toBeNull()
  })

  it('reads older plain-string invitations', () => {
    window.localStorage.setItem('lets-be-friends-referral-code', 'ABCD12')
    expect(readSavedReferralCode('user-1')).toBe('ABCD12')
  })
})
