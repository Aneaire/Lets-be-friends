import { readCurrentCoordinates } from '@/features/discovery/nearbyLocation'

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
