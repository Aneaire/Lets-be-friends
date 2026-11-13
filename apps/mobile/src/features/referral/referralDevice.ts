import { nativePushAdapter, type NativePushAdapter } from '@/notifications/nativeAdapter'

/**
 * Stable per-install identifier used for the same-device referral signal.
 * Returns undefined when the platform cannot provide one, so attribution
 * still succeeds without the fraud signal.
 */
export async function mobileReferralDeviceId(
  adapter: Pick<NativePushAdapter, 'ensureInstallation'> = nativePushAdapter,
): Promise<string | undefined> {
  try {
    const installation = await adapter.ensureInstallation()
    const id = installation.installationId.trim()
    return id || undefined
  } catch {
    return undefined
  }
}
