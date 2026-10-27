const mockEffects: Array<() => (() => void) | undefined> = []
const mockListener = jest.fn()
const mockRemove = jest.fn()
jest.mock('react', () => ({ ...jest.requireActual('react'), useEffect: (effect: () => (() => void) | undefined) => mockEffects.push(effect) }))

import { AppState } from 'react-native'
import { useTopUpReconciliation } from '@/features/finance/useTopUpReconciliation'

describe('automatic QR payment checks', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    mockEffects.length = 0
    mockListener.mockReset().mockReturnValue({ remove: mockRemove })
    jest.spyOn(AppState, 'addEventListener').mockImplementation((...args) => mockListener(...args))
    mockRemove.mockReset()
    AppState.currentState = 'active'
  })
  afterEach(() => { jest.useRealTimers(); jest.restoreAllMocks() })
  it('checks immediately and periodically, then stops when the screen is closed', async () => {
    const refresh = jest.fn().mockResolvedValue(undefined)
    useTopUpReconciliation('top-up', refresh)
    const stop = mockEffects[0]()!
    expect(refresh).toHaveBeenCalledWith('top-up')
    await jest.advanceTimersByTimeAsync(20_000)
    expect(refresh).toHaveBeenCalledTimes(2)
    stop()
    await jest.advanceTimersByTimeAsync(40_000)
    expect(refresh).toHaveBeenCalledTimes(2)
    expect(mockRemove).toHaveBeenCalled()
  })
  it('does not poll completed attempts, background screens, or overlap provider requests', async () => {
    const refresh = jest.fn(() => new Promise(() => undefined))
    useTopUpReconciliation(undefined, refresh)
    expect(mockEffects[0]()).toBeUndefined()
    useTopUpReconciliation('top-up', refresh)
    const stop = mockEffects[1]()!
    await jest.advanceTimersByTimeAsync(40_000)
    expect(refresh).toHaveBeenCalledTimes(1)
    stop()
    AppState.currentState = 'background'
    useTopUpReconciliation('another', refresh)
    const stopBackground = mockEffects[2]()!
    await jest.advanceTimersByTimeAsync(20_000)
    expect(refresh).toHaveBeenCalledTimes(1)
    AppState.currentState = 'active'
    mockListener.mock.calls.at(-1)![1]('active')
    expect(refresh).toHaveBeenLastCalledWith('another')
    stopBackground()
  })
  it('retries a failed check without inferring a payment result', async () => {
    const refresh = jest.fn().mockRejectedValue(new Error('offline'))
    useTopUpReconciliation('top-up', refresh)
    const stop = mockEffects[0]()!
    await jest.advanceTimersByTimeAsync(20_000)
    expect(refresh).toHaveBeenCalledTimes(2)
    stop()
  })
})
