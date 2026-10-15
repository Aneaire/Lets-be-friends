import { describe, expect, it } from 'vitest'
import { identityReadFailureMessage } from '../../src/features/identity/identityReadFailure'

describe('identity read failure copy', () => {
  it('names the photo problem the reader actually found', () => {
    expect(identityReadFailureMessage('blur')).toMatch(/blurred/)
    expect(identityReadFailureMessage('glare')).toMatch(/reflection/)
    expect(identityReadFailureMessage('cropped')).toMatch(/cut off/)
    expect(identityReadFailureMessage('wrong_side')).toMatch(/back of your ID/)
    expect(identityReadFailureMessage('not_a_document')).toMatch(/government ID/)
    expect(identityReadFailureMessage('unreadable')).toMatch(/not readable/)
  })

  it('does not blame the photo for a problem that was ours', () => {
    const retryable = identityReadFailureMessage('retryable')
    expect(retryable).toMatch(/on our side/)
    expect(retryable).not.toMatch(/blur|reflection|cut off|readable/i)
    expect(identityReadFailureMessage('service_unavailable')).toMatch(/briefly unavailable/)
  })

  it('falls back to neutral guidance for a missing or unknown reason', () => {
    const fallback = identityReadFailureMessage('unknown')
    expect(identityReadFailureMessage(undefined)).toBe(fallback)
    expect(identityReadFailureMessage('something_new')).toBe(fallback)
    expect(identityReadFailureMessage('')).toBe(fallback)
    expect(fallback).not.toMatch(/blur|reflection/)
  })

  it('never uses an em dash in member-facing copy', () => {
    const reasons = ['service_unavailable', 'blur', 'glare', 'cropped', 'wrong_side', 'not_a_document', 'unreadable', 'retryable', 'unknown']
    for (const reason of reasons) expect(identityReadFailureMessage(reason)).not.toContain('—')
  })
})
