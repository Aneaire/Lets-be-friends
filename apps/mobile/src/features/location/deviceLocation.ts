export type Coordinates = {
  latitude: number
  longitude: number
}

type Position = {
  coords: Coordinates
}

type CurrentPositionReader = () => Promise<Position>
export type Wait = (milliseconds: number) => Promise<void>

export type ForegroundLocationPermission = {
  granted: boolean
  canAskAgain?: boolean
}

export type DeviceLocationFailureReason =
  | 'permission_denied'
  | 'permission_blocked'
  | 'accuracy_declined'
  | 'unavailable'

export type DeviceLocationResult =
  | { status: 'located'; coordinates: Coordinates }
  | { status: 'unavailable'; reason: DeviceLocationFailureReason }

export type ReadDeviceLocationOptions = {
  getPermission: () => Promise<ForegroundLocationPermission>
  requestPermission: () => Promise<ForegroundLocationPermission>
  /**
   * Android asks for "Location Accuracy" through a system dialog. Resolve that
   * dialog before reading a fix, otherwise the fix starts while the app is
   * paused behind it and the member has to tap again. Rejects when declined.
   */
  ensureAccurateLocation?: () => Promise<void>
  getCurrentPosition: (options: { mayShowUserSettingsDialog: boolean }) => Promise<Position>
  wait?: Wait
  timeoutMs?: number
}

const retryDelaysMs = [750, 1_500] as const
const defaultTimeoutMs = 20_000

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

/**
 * Reads one foreground fix after resolving every system dialog the member has
 * to answer. The permission prompt comes first, then the Android Location
 * Accuracy dialog, then the fix. Each step settles before the next one starts,
 * so the preview appears from a single tap on "Use device location".
 */
export async function readDeviceLocation(options: ReadDeviceLocationOptions): Promise<DeviceLocationResult> {
  const permission = await resolvePermission(options)
  if (!permission.granted) {
    return {
      status: 'unavailable',
      reason: permission.canAskAgain === false ? 'permission_blocked' : 'permission_denied',
    }
  }

  let accuracyDeclined = false
  if (options.ensureAccurateLocation) {
    try {
      await options.ensureAccurateLocation()
    } catch {
      // The member declined the accuracy dialog. Device-only providers can
      // still answer the fix, so keep going without prompting again.
      accuracyDeclined = true
    }
  }

  try {
    const coordinates = await readCurrentCoordinates(
      () => withTimeout(
        options.getCurrentPosition({ mayShowUserSettingsDialog: false }),
        options.timeoutMs ?? defaultTimeoutMs,
      ),
      options.wait,
    )
    return { status: 'located', coordinates }
  } catch {
    return { status: 'unavailable', reason: accuracyDeclined ? 'accuracy_declined' : 'unavailable' }
  }
}

async function resolvePermission({
  getPermission,
  requestPermission,
}: Pick<ReadDeviceLocationOptions, 'getPermission' | 'requestPermission'>): Promise<ForegroundLocationPermission> {
  try {
    const existing = await getPermission()
    if (existing.granted) return existing
    return await requestPermission()
  } catch {
    // An unexpected permission API failure can still be retried by the member,
    // so do not route them to device settings.
    return { granted: false, canAskAgain: true }
  }
}

function withTimeout<T>(promise: Promise<T>, milliseconds: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Device location request timed out')), milliseconds)
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (error: unknown) => {
        clearTimeout(timer)
        reject(error)
      },
    )
  })
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
