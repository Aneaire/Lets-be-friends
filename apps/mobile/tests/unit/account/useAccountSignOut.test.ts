type HookSlot = Record<string, any>

const mockHooks: HookSlot[] = []
let mockCursor = 0
let mockStateWrites = 0

function mockSameDeps(left?: unknown[], right?: unknown[]): boolean {
  return Boolean(left && right && left.length === right.length && left.every((value, index) => Object.is(value, right[index])))
}

jest.mock('react', () => ({
  useRef: (initialValue: unknown) => {
    const index = mockCursor++
    mockHooks[index] ??= { current: initialValue }
    return mockHooks[index]
  },
  useState: (initialValue: unknown) => {
    const index = mockCursor++
    mockHooks[index] ??= { value: initialValue }
    return [mockHooks[index].value, (value: unknown) => {
      mockStateWrites += 1
      mockHooks[index].value = typeof value === 'function' ? value(mockHooks[index].value) : value
    }]
  },
  useMemo: (factory: () => unknown, deps: unknown[]) => {
    const index = mockCursor++
    const slot = mockHooks[index]
    if (!slot || !mockSameDeps(slot.deps, deps)) mockHooks[index] = { value: factory(), deps }
    return mockHooks[index].value
  },
  useEffect: (effect: () => void | (() => void), deps: unknown[]) => {
    const index = mockCursor++
    const slot = mockHooks[index]
    if (slot && mockSameDeps(slot.deps, deps)) return
    slot?.cleanup?.()
    mockHooks[index] = { deps, cleanup: effect() }
  },
}))

import { useAccountSignOut } from '@/features/account/useAccountSignOut'

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}

function renderHook(input: Parameters<typeof useAccountSignOut>[0]) {
  mockCursor = 0
  return useAccountSignOut(input)
}

function unmountHook(): void {
  for (const slot of mockHooks) slot.cleanup?.()
}

describe('useAccountSignOut session isolation', () => {
  beforeEach(() => {
    mockHooks.length = 0
    mockCursor = 0
    mockStateWrites = 0
  })

  afterEach(() => {
    unmountHook()
  })

  it('ignores an old rejection across A to B to A while the new A flight succeeds', async () => {
    const oldGate = deferred<void>()
    const newGate = deferred<void>()
    const oldSignedOut = jest.fn()
    const newSignedOut = jest.fn()
    const oldSignOut = jest.fn(() => oldGate.promise)
    const newSignOut = jest.fn(() => newGate.promise)

    const oldA = renderHook({ accountId: 'user-a', signOut: oldSignOut, onSignedOut: oldSignedOut })
    const oldFlight = oldA.runSignOut()
    renderHook({ accountId: 'user-b', signOut: jest.fn(async () => undefined) })
    const newA = renderHook({ accountId: 'user-a', signOut: newSignOut, onSignedOut: newSignedOut })
    const newFlight = newA.runSignOut()

    oldGate.reject(new Error('old failure'))
    await expect(oldFlight).resolves.toBe('stale')
    expect(oldSignedOut).not.toHaveBeenCalled()
    expect(mockHooks[4].value).toBe(true)
    expect(mockHooks[5].value).toBe(false)

    newGate.resolve()
    await expect(newFlight).resolves.toBe('signed_out')
    expect(newSignedOut).toHaveBeenCalledTimes(1)
    expect(oldSignOut).toHaveBeenCalledTimes(1)
    expect(newSignOut).toHaveBeenCalledTimes(1)
  })

  it('does not update state or callbacks after unmount', async () => {
    const gate = deferred<void>()
    const onSignedOut = jest.fn()
    const hook = renderHook({ accountId: 'user-a', signOut: () => gate.promise, onSignedOut })
    const flight = hook.runSignOut()
    unmountHook()
    const writesAtUnmount = mockStateWrites

    gate.resolve()
    await expect(flight).resolves.toBe('stale')
    expect(mockStateWrites).toBe(writesAtUnmount)
    expect(onSignedOut).not.toHaveBeenCalled()
  })

  it('does nothing when auth sign-out is unavailable', async () => {
    const hook = renderHook({ accountId: 'user-a', signOut: null })
    const writesBeforeRun = mockStateWrites

    await expect(hook.runSignOut()).resolves.toBe('stale')
    expect(mockStateWrites).toBe(writesBeforeRun)
  })
})
