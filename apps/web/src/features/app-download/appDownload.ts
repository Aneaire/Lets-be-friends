// Placeholder store listing. Replace this when the APK is published so the
// card starts linking to the real Play Store page.
export const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.letsbefriends.mobile'

export const APP_DOWNLOAD_DISMISS_KEY_PREFIX = 'lets-be-friends:app-download-dismissed:'

export function appDownloadDismissKey(viewerId: string) {
  return `${APP_DOWNLOAD_DISMISS_KEY_PREFIX}${viewerId}`
}

/**
 * The download offer belongs to members who finished the welcome guide on the
 * website. It is dismissed per account in this browser.
 */
export function shouldOfferAppDownload({
  onboardingCompletedAt,
  dismissed,
}: {
  onboardingCompletedAt?: number | null
  dismissed: boolean
}) {
  return Boolean(onboardingCompletedAt) && !dismissed
}
