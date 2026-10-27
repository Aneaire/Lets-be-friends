import {
  accountIdentityKey,
  buildAccountSheetItems,
  createAccountSignOutCoordinator,
  resolveAccountAvatarAction,
  runAccountSignOut,
  selectAccountSheetItem,
  type AccountSheetItem,
  type AccountSignOutSession,
} from '@/features/account/accountSheet'
import { companionIsPublic } from '@/member/profileSections'

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}

function signOutSession(accountId: string, generation: number): AccountSignOutSession {
  return { accountId, generation, flightId: Symbol('test-sign-out') }
}

describe('account sheet model', () => {
  it('shows the public Companion profile only when approved with current identity approval', () => {
    const base = { identityEligible: true, hasCompanionContext: true }
    expect(
      buildAccountSheetItems({ ...base, applicationStatus: 'approved', applicationId: 'cp-1' }).map((item) => item.id),
    ).toEqual(['profile', 'verification', 'public-profile', 'companion', 'wallet', 'settings', 'safety'])

    expect(
      buildAccountSheetItems({ ...base, applicationStatus: 'approved', applicationId: 'cp-1', identityEligible: false }).map((item) => item.id),
    ).not.toContain('public-profile')

    expect(
      buildAccountSheetItems({ ...base, applicationStatus: 'pending_review', applicationId: 'cp-1' }).map((item) => item.id),
    ).not.toContain('public-profile')

    expect(
      buildAccountSheetItems({ ...base, applicationStatus: null, applicationId: null }).map((item) => item.id),
    ).not.toContain('public-profile')
    expect(companionIsPublic('approved', true)).toBe(true)
    expect(companionIsPublic('approved', false)).toBe(false)
  })

  it('labels Companion setup versus tools with valid routes only', () => {
    const setup = buildAccountSheetItems({ applicationStatus: null, applicationId: null, identityEligible: false, hasCompanionContext: false })
    expect(setup.find((item) => item.id === 'companion')?.label).toBe('Become a Companion')
    const tools = buildAccountSheetItems({ applicationStatus: 'approved', applicationId: 'cp-1', identityEligible: true, hasCompanionContext: true })
    expect(tools.find((item) => item.id === 'companion')?.label).toBe('Companion tools')
    const publicItem = tools.find((item) => item.id === 'public-profile')
    expect(publicItem?.route).toEqual({ pathname: '/companion-profile/[id]', params: { id: 'cp-1' } })
    for (const item of [...setup, ...tools]) {
      expect(item.route.pathname).toMatch(/^\/(get-verified|profile|companion|companion-profile\/\[id\]|wallet|settings|safety)$/)
    }
  })

  it('opens the sheet for signed-in members and sends guests to sign in', () => {
    expect(resolveAccountAvatarAction(true)).toBe('open_sheet')
    expect(resolveAccountAvatarAction(false)).toBe('sign_in')
  })

  it('scopes sheet state to one account so sign-out never leaks state', () => {
    expect(accountIdentityKey({ status: 'signed_in', clerkUserId: 'user-a' })).toBe('signed_in:user-a')
    expect(accountIdentityKey({ status: 'signed_in', clerkUserId: 'user-b' })).not.toBe(accountIdentityKey({ status: 'signed_in', clerkUserId: 'user-a' }))
    expect(accountIdentityKey({ status: 'signed_out' })).toBe('signed_out')
    expect(accountIdentityKey({ status: 'unconfigured' })).toBe('unconfigured')
  })

  it('closes the sheet before routing to the selected destination', () => {
    const item = buildAccountSheetItems({ applicationStatus: null, applicationId: null, identityEligible: false, hasCompanionContext: false })
      .find((entry): entry is AccountSheetItem => entry.id === 'settings')!
    const order: string[] = []
    selectAccountSheetItem(item, {
      close: () => { order.push('close') },
      navigate: (route) => { order.push(`navigate:${route.pathname}`) },
    })
    expect(order).toEqual(['close', 'navigate:/settings'])
  })
})

describe('account sign-out coordinator', () => {
  it('runs auth cleanup once when two taps land in the same tick', async () => {
    const coordinator = createAccountSignOutCoordinator()
    const session = signOutSession('user-a', 1)
    const gate = deferred<void>()
    const signOut = jest.fn(async () => { await gate.promise })
    const isCurrent = () => true

    const first = runAccountSignOut({ session, coordinator, isCurrent, signOut })
    const second = runAccountSignOut({ session, coordinator, isCurrent, signOut })
    await expect(second).resolves.toBe('duplicate')
    expect(coordinator.isBusy()).toBe(true)
    gate.resolve()
    await expect(first).resolves.toBe('signed_out')
    expect(signOut).toHaveBeenCalledTimes(1)
    expect(coordinator.isBusy()).toBe(false)
  })

  it('allows a retry after a failed cleanup', async () => {
    const coordinator = createAccountSignOutCoordinator()
    const session = signOutSession('user-a', 1)
    const isCurrent = () => true
    const failing = jest.fn(async () => { throw new Error('offline') })

    await expect(runAccountSignOut({ session, coordinator, isCurrent, signOut: failing })).resolves.toBe('failed')
    expect(coordinator.isBusy()).toBe(false)

    const signOut = jest.fn(async () => undefined)
    await expect(runAccountSignOut({ session, coordinator, isCurrent, signOut })).resolves.toBe('signed_out')
    expect(signOut).toHaveBeenCalledTimes(1)
  })

  it('treats a rejected old flight as stale after the account generation changes', async () => {
    const coordinator = createAccountSignOutCoordinator()
    const session = signOutSession('user-a', 1)
    const gate = deferred<void>()
    let currentGeneration = 1
    const signOut = jest.fn(async () => { await gate.promise })

    const flight = runAccountSignOut({
      session,
      coordinator,
      isCurrent: (candidate) => candidate.generation === currentGeneration,
      signOut,
    })
    currentGeneration = 2
    gate.reject(new Error('old account failure'))
    await expect(flight).resolves.toBe('stale')
    expect(coordinator.isBusy()).toBe(false)
    expect(signOut).toHaveBeenCalledTimes(1)
  })

  it('keeps an old same-account generation from clearing a newer flight', () => {
    const coordinator = createAccountSignOutCoordinator()
    const oldFlight = signOutSession('user-a', 1)
    const newFlight = signOutSession('user-a', 2)
    expect(coordinator.begin(oldFlight)).toBe(true)
    coordinator.cancel()
    expect(coordinator.begin(newFlight)).toBe(true)
    coordinator.finish(oldFlight)
    expect(coordinator.isBusy()).toBe(true)
    coordinator.finish(newFlight)
    expect(coordinator.isBusy()).toBe(false)
  })

  it('does not call auth for a stale or missing sign-out session', async () => {
    const coordinator = createAccountSignOutCoordinator()
    const signOut = jest.fn(async () => undefined)

    await expect(runAccountSignOut({
      session: signOutSession('user-a', 1),
      coordinator,
      isCurrent: () => false,
      signOut,
    })).resolves.toBe('stale')
    await expect(runAccountSignOut({
      session: signOutSession('user-a', 2),
      coordinator,
      isCurrent: () => true,
      signOut: null,
    })).resolves.toBe('stale')
    expect(signOut).not.toHaveBeenCalled()
    expect(coordinator.isBusy()).toBe(false)
  })
})
