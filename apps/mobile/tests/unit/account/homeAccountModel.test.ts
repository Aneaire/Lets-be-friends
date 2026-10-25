import { homeAccountModel } from '@/features/account/homeAccountModel'

describe('home account model', () => {
  it('sends guests to sign in with no sheet and no Clerk account state', () => {
    const model = homeAccountModel({
      signedIn: false,
      authStatus: 'signed_out',
      clerkUserId: null,
      authDisplayName: undefined,
      identityEligible: false,
    })

    expect(model.avatarAction).toBe('sign_in')
    expect(model.items).toEqual([])
    expect(model.accountEmail).toBeUndefined()
    expect(model.accountImage).toBeUndefined()
    expect(model.fullyVerified).toBe(false)
    expect(model.identityKey).toBe('signed_out')
  })

  it('keeps unconfigured builds on the guest path without touching Clerk', () => {
    const model = homeAccountModel({
      signedIn: false,
      authStatus: 'unconfigured',
      clerkUserId: null,
      identityEligible: false,
    })

    expect(model.avatarAction).toBe('sign_in')
    expect(model.identityKey).toBe('unconfigured')
  })

  it('opens the sheet for signed-in members with email, public profile, and tools', () => {
    const model = homeAccountModel({
      signedIn: true,
      authStatus: 'signed_in',
      clerkUserId: 'user-a',
      displayName: 'Alex Rivera',
      authDisplayName: 'Alex Rivera',
      profileImageUrl: 'https://example.com/photo.jpg',
      email: 'alex@example.com',
      role: 'member',
      identityEligible: true,
      application: { _id: 'cp-1', status: 'approved' },
    })

    expect(model.avatarAction).toBe('open_sheet')
    expect(model.accountName).toBe('Alex Rivera')
    expect(model.accountEmail).toBe('alex@example.com')
    expect(model.identityKey).toBe('signed_in:user-a')
    expect(model.items.map((item) => item.id)).toEqual([
      'profile',
      'public-profile',
      'companion',
      'wallet',
      'settings',
      'safety',
    ])
    expect(model.items.find((item) => item.id === 'companion')?.label).toBe('Companion tools')
    expect(model.fullyVerified).toBe(true)
  })

  it('isolates sheet state per account and hides the public row without approval', () => {
    const first = homeAccountModel({
      signedIn: true,
      authStatus: 'signed_in',
      clerkUserId: 'user-a',
      displayName: 'Alex Rivera',
      identityEligible: false,
      application: { _id: 'cp-1', status: 'pending_review' },
    })
    const second = homeAccountModel({
      signedIn: true,
      authStatus: 'signed_in',
      clerkUserId: 'user-b',
      displayName: 'Mika Santos',
      identityEligible: false,
      application: null,
    })

    expect(first.identityKey).not.toBe(second.identityKey)
    expect(first.items.map((item) => item.id)).not.toContain('public-profile')
    expect(second.items.find((item) => item.id === 'companion')?.label).toBe('Become a Companion')
    expect(second.fullyVerified).toBe(false)
  })
})
