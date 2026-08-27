import { homeAccountPresentation } from '@/features/social/homePresentation'

describe('home account presentation', () => {
  it('keeps the authenticated shell while account state settles', () => {
    expect(homeAccountPresentation('loading', 'loading')).toBe('account_loading')
    expect(homeAccountPresentation('signed_in', 'loading')).toBe('account_loading')
    expect(homeAccountPresentation('signed_in', 'syncing')).toBe('account_loading')
    expect(homeAccountPresentation('signed_in', 'signed_out')).toBe('account_loading')
  })

  it('shows the real signed-in controls when the member is ready', () => {
    expect(homeAccountPresentation('signed_in', 'ready')).toBe('ready')
  })

  it('shows the sign-in prompt only after signed-out state is known', () => {
    expect(homeAccountPresentation('signed_out', 'signed_out')).toBe('signed_out')
  })
})
