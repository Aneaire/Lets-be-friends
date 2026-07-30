import { describe, expect, it } from 'vitest'
import { memberVerificationPresentation } from './memberVerification'

describe('member verification presentation', () => {
  it('shows Not started before a member requests review', () => {
    expect(memberVerificationPresentation('not_started', null)).toMatchObject({
      state: 'not_started',
      label: 'Not started',
      tone: 'self',
    })
  })

  it('derives Pending review from the latest member request', () => {
    expect(memberVerificationPresentation('not_started', 'pending')).toMatchObject({
      state: 'pending',
      label: 'Pending review',
      tone: 'warning',
    })
  })

  it('shows a stored Pending review without request metadata', () => {
    expect(memberVerificationPresentation('pending', null).state).toBe('pending')
  })

  it('keeps approved status authoritative over stale request data', () => {
    expect(memberVerificationPresentation('approved', 'rejected')).toMatchObject({
      state: 'approved',
      label: 'Verified',
      tone: 'success',
    })
  })

  it('preserves a rejected member review state', () => {
    expect(memberVerificationPresentation('rejected', null)).toMatchObject({
      state: 'rejected',
      label: 'Not approved',
      tone: 'danger',
    })
  })

  it('derives rejection from the latest member request', () => {
    expect(memberVerificationPresentation('not_started', 'rejected').state).toBe('rejected')
  })
})
