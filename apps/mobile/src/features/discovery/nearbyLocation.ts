type Coordinates = {
  latitude: number
  longitude: number
}

type Position = {
  coords: Coordinates
}

type CurrentPositionReader = () => Promise<Position>
type Wait = (milliseconds: number) => Promise<void>

const retryDelaysMs = [750, 1_500] as const

const defaultWait: Wait = (milliseconds) => new Promise((resolve) => {
  setTimeout(resolve, milliseconds)
})

export async function readCurrentCoordinates(
  getCurrentPosition: CurrentPositionReader,
  wait: Wait = defaultWait,
): Promise<Coordinates> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return (await getCurrentPosition()).coords
    } catch (error) {
      const delay = retryDelaysMs[attempt]
      if (delay === undefined || !isProviderWarmupError(error)) throw error
      await wait(delay)
    }
  }
}

function isProviderWarmupError(error: unknown): boolean {
  const message = error instanceof Error
    ? error.message.toLowerCase()
    : typeof error === 'string'
      ? error.toLowerCase()
      : ''

  return message.includes('location provider is unavailable')
    || message.includes('location is unavailable')
    || message.includes('current location is unknown')
}
