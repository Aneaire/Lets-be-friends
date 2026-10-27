import { readCurrentCoordinates, readDeviceLocation } from '@/features/location/deviceLocation'

describe('nearby current location', () => {
  const position = { coords: { latitude: 14.5995, longitude: 120.9842 } }

  it('returns the first available current location without waiting', async () => {
    const getCurrentPosition = jest.fn().mockResolvedValue(position)
    const wait = jest.fn().mockResolvedValue(undefined)

    await expect(readCurrentCoordinates(getCurrentPosition, wait)).resolves.toEqual(position.coords)
    expect(getCurrentPosition).toHaveBeenCalledTimes(1)
    expect(wait).not.toHaveBeenCalled()
  })

  it('retries when the provider is still warming up after permission is granted', async () => {
    const getCurrentPosition = jest.fn()
      .mockRejectedValueOnce(new Error('Location provider is unavailable'))
      .mockResolvedValueOnce(position)
    const wait = jest.fn().mockResolvedValue(undefined)

    await expect(readCurrentCoordinates(getCurrentPosition, wait)).resolves.toEqual(position.coords)
    expect(getCurrentPosition).toHaveBeenCalledTimes(2)
    expect(wait).toHaveBeenCalledWith(750)
  })

  it('reports the lookup failure after the bounded retries are exhausted', async () => {
    const finalError = new Error('Location provider is unavailable')
    const getCurrentPosition = jest.fn()
      .mockRejectedValueOnce(new Error('Location provider is unavailable'))
      .mockRejectedValueOnce(new Error('Current location is unknown'))
      .mockRejectedValueOnce(finalError)
    const wait = jest.fn().mockResolvedValue(undefined)

    await expect(readCurrentCoordinates(getCurrentPosition, wait)).rejects.toBe(finalError)
    expect(getCurrentPosition).toHaveBeenCalledTimes(3)
    expect(wait.mock.calls).toEqual([[750], [1_500]])
  })

  it('does not repeat a settings prompt that the member cancelled', async () => {
    const settingsError = new Error('Location request failed due to unsatisfied device settings')
    const getCurrentPosition = jest.fn().mockRejectedValue(settingsError)
    const wait = jest.fn().mockResolvedValue(undefined)

    await expect(readCurrentCoordinates(getCurrentPosition, wait)).rejects.toBe(settingsError)
    expect(getCurrentPosition).toHaveBeenCalledTimes(1)
    expect(wait).not.toHaveBeenCalled()
  })
})

describe('device location flow', () => {
  const coordinates = { latitude: 14.5995, longitude: 120.9842 }
  const position = { coords: coordinates }
  const wait = jest.fn().mockResolvedValue(undefined)

  beforeEach(() => {
    wait.mockClear()
  })

  it('previews an existing grant without asking for permission again', async () => {
    const getPermission = jest.fn().mockResolvedValue({ granted: true, canAskAgain: true })
    const requestPermission = jest.fn()
    const getCurrentPosition = jest.fn().mockResolvedValue(position)

    await expect(readDeviceLocation({
      getPermission,
      requestPermission,
      getCurrentPosition,
      wait,
    })).resolves.toEqual({ status: 'located', coordinates })

    expect(requestPermission).not.toHaveBeenCalled()
    expect(getCurrentPosition).toHaveBeenCalledTimes(1)
  })

  it('asks for permission, settles the accuracy dialog, then reads one fix', async () => {
    const calls: string[] = []
    const getPermission = jest.fn(async () => {
      calls.push('check')
      return { granted: false, canAskAgain: true }
    })
    const requestPermission = jest.fn(async () => {
      calls.push('permission')
      return { granted: true, canAskAgain: true }
    })
    const ensureAccurateLocation = jest.fn(async () => {
      calls.push('accuracy')
    })
    const getCurrentPosition = jest.fn(async () => {
      calls.push('fix')
      return position
    })

    await expect(readDeviceLocation({
      getPermission,
      requestPermission,
      ensureAccurateLocation,
      getCurrentPosition,
      wait,
    })).resolves.toEqual({ status: 'located', coordinates })

    expect(calls).toEqual(['check', 'permission', 'accuracy', 'fix'])
    expect(getCurrentPosition).toHaveBeenCalledWith({ mayShowUserSettingsDialog: false })
  })

  it('does not start the fix while the accuracy dialog is still open', async () => {
    let answerAccuracy: (() => void) | undefined
    const accuracyAnswered = new Promise<void>((resolve) => {
      answerAccuracy = resolve
    })
    const getCurrentPosition = jest.fn().mockResolvedValue(position)

    const read = readDeviceLocation({
      getPermission: async () => ({ granted: true }),
      requestPermission: async () => ({ granted: true }),
      ensureAccurateLocation: () => accuracyAnswered,
      getCurrentPosition,
      wait,
    })
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(getCurrentPosition).not.toHaveBeenCalled()

    answerAccuracy?.()
    await expect(read).resolves.toEqual({ status: 'located', coordinates })
    expect(getCurrentPosition).toHaveBeenCalledTimes(1)
  })

  it('still previews the area when the member declines Location Accuracy', async () => {
    const getCurrentPosition = jest.fn().mockResolvedValue(position)

    await expect(readDeviceLocation({
      getPermission: async () => ({ granted: true }),
      requestPermission: async () => ({ granted: true }),
      ensureAccurateLocation: async () => {
        throw new Error('Location request failed due to unsatisfied device settings')
      },
      getCurrentPosition,
      wait,
    })).resolves.toEqual({ status: 'located', coordinates })
  })

  it('explains a declined accuracy setting when no fix arrives', async () => {
    await expect(readDeviceLocation({
      getPermission: async () => ({ granted: true }),
      requestPermission: async () => ({ granted: true }),
      ensureAccurateLocation: async () => {
        throw new Error('Location request failed due to unsatisfied device settings')
      },
      getCurrentPosition: async () => {
        throw new Error('Location request failed due to unsatisfied device settings')
      },
      wait,
    })).resolves.toEqual({ status: 'unavailable', reason: 'accuracy_declined' })
  })

  it('reports a denied permission without reading a fix', async () => {
    const getCurrentPosition = jest.fn()

    await expect(readDeviceLocation({
      getPermission: async () => ({ granted: false, canAskAgain: true }),
      requestPermission: async () => ({ granted: false, canAskAgain: true }),
      getCurrentPosition,
      wait,
    })).resolves.toEqual({ status: 'unavailable', reason: 'permission_denied' })

    expect(getCurrentPosition).not.toHaveBeenCalled()
  })

  it('reports a blocked permission when the member cannot be asked again', async () => {
    const getCurrentPosition = jest.fn()

    await expect(readDeviceLocation({
      getPermission: async () => ({ granted: false, canAskAgain: false }),
      requestPermission: async () => ({ granted: false, canAskAgain: false }),
      getCurrentPosition,
      wait,
    })).resolves.toEqual({ status: 'unavailable', reason: 'permission_blocked' })

    expect(getCurrentPosition).not.toHaveBeenCalled()
  })

  it('keeps an unexpected permission failure retryable', async () => {
    const getCurrentPosition = jest.fn()

    await expect(readDeviceLocation({
      getPermission: async () => {
        throw new Error('Permission service unavailable')
      },
      requestPermission: async () => ({ granted: true }),
      getCurrentPosition,
      wait,
    })).resolves.toEqual({ status: 'unavailable', reason: 'permission_denied' })

    expect(getCurrentPosition).not.toHaveBeenCalled()
  })

  it('retries a provider that is still warming up', async () => {
    const getCurrentPosition = jest.fn()
      .mockRejectedValueOnce(new Error('Current location is unknown'))
      .mockResolvedValueOnce(position)

    await expect(readDeviceLocation({
      getPermission: async () => ({ granted: true }),
      requestPermission: async () => ({ granted: true }),
      getCurrentPosition,
      wait,
    })).resolves.toEqual({ status: 'located', coordinates })

    expect(getCurrentPosition).toHaveBeenCalledTimes(2)
    expect(wait).toHaveBeenCalledWith(750)
  })

  it('stops waiting when the device never returns a fix', async () => {
    jest.useFakeTimers()
    try {
      const read = readDeviceLocation({
        getPermission: async () => ({ granted: true }),
        requestPermission: async () => ({ granted: true }),
        getCurrentPosition: () => new Promise(() => {}),
        timeoutMs: 5_000,
      })

      await jest.advanceTimersByTimeAsync(5_000)
      await expect(read).resolves.toEqual({ status: 'unavailable', reason: 'unavailable' })
    } finally {
      jest.useRealTimers()
    }
  })
})
