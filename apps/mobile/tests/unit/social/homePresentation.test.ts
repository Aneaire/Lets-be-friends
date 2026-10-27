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

  it('shows a connection failure instead of an endless loading skeleton', () => {
    expect(homeAccountPresentation('signed_in', 'error')).toBe('account_error')
    expect(homeAccountPresentation('signed_in', 'unavailable')).toBe('account_error')
    expect(homeAccountPresentation('signed_out', 'error')).toBe('signed_out')
  })

  it('shows the sign-in prompt only after signed-out state is known', () => {
    expect(homeAccountPresentation('signed_out', 'signed_out')).toBe('signed_out')
  })
})
