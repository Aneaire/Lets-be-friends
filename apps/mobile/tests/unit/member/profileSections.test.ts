import {
  companionIsPublic,
  companionModeLabel,
  companionStatusLabel,
  companionStatusTone,
  formatDiscoveryArea,
  profileActionLabels,
  verificationActionFor,
} from '@/member/profileSections'

describe('profile sections mirror web profile rules', () => {
  it('marks a Companion profile public only with approval and current identity approval', () => {
    expect(companionIsPublic('approved', true)).toBe(true)
    expect(companionIsPublic('approved', false)).toBe(false)
    expect(companionIsPublic('pending_review', true)).toBe(false)
    expect(companionIsPublic(null, true)).toBe(false)
  })

  it('labels Companion status like the web profile', () => {
    expect(companionStatusLabel('approved')).toBe('Profile saved')
    expect(companionStatusLabel('pending_review')).toBe('Saved')
    expect(companionStatusLabel('rejected')).toBe('Needs changes')
    expect(companionStatusLabel('suspended')).toBe('Suspended')
    expect(companionStatusLabel('not started')).toBe('Not started')
    expect(companionStatusTone('approved')).toBe('success')
    expect(companionStatusTone('rejected')).toBe('danger')
    expect(companionStatusTone('pending_review')).toBe('warning')
  })

  it('labels session format like the web profile', () => {
    expect(companionModeLabel('online')).toBe('Online')
    expect(companionModeLabel('in_person')).toBe('In-person')
    expect(companionModeLabel('both')).toBe('Online and in-person')
  })

  it('formats the discovery area only from real coordinates', () => {
    expect(formatDiscoveryArea(14.5, 121)).toBe('14.5, 121')
    expect(formatDiscoveryArea(undefined, 121)).toBe('')
    expect(formatDiscoveryArea('14.5', 121)).toBe('')
  })

  it('keeps the three profile actions behind the hero menu', () => {
    expect(profileActionLabels(true).map((action) => action.label)).toEqual([
      'Edit profile',
      'Your bookings',
      'Edit Companion profile',
    ])
    expect(profileActionLabels(false).map((action) => action.label)).toEqual([
      'Edit profile',
      'Your bookings',
      'Become a Companion',
    ])
  })

  it('derives the verification action from authoritative fields only', () => {
    expect(verificationActionFor('approved', null, true)).toBe('none')
    expect(verificationActionFor('rejected', null, false)).toBe('retry')
    expect(verificationActionFor('not_started', { adminStatus: 'rejected' }, false)).toBe('retry')
    expect(verificationActionFor('pending', null, false)).toBe('continue')
    expect(verificationActionFor('not_started', { adminStatus: 'pending' }, false)).toBe('none')
    expect(verificationActionFor('not_started', { personaStatus: 'created' }, false)).toBe('continue')
    expect(verificationActionFor('not_started', { identityStage: 'confirmation_required' }, false)).toBe('continue')
    expect(verificationActionFor('not_started', { personaStatus: 'failed' }, false)).toBe('retry')
    expect(verificationActionFor('not_started', { personaStatus: 'expired' }, false)).toBe('retry')
    expect(verificationActionFor('not_started', null, false)).toBe('verify')
  })
})
