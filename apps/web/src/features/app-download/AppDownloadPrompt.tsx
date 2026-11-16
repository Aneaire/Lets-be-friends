import { useEffect, useState } from 'react'
import { AppDownloadCard } from './AppDownloadCard'
import { appDownloadDismissKey, shouldOfferAppDownload } from './appDownload'

export function AppDownloadPrompt({
  viewerId,
  onboardingCompletedAt,
}: {
  viewerId?: string
  onboardingCompletedAt?: number | null
}) {
  const [dismissed, setDismissed] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    setReady(false)
    setDismissed(false)
    if (!viewerId) return
    try {
      setDismissed(window.localStorage.getItem(appDownloadDismissKey(viewerId)) === '1')
    } catch {
      // Storage being unavailable does not block the offer.
      setDismissed(false)
    }
    setReady(true)
  }, [viewerId])

  if (!ready || !viewerId) return null
  if (!shouldOfferAppDownload({ onboardingCompletedAt, dismissed })) return null

  return (
    <AppDownloadCard
      onDismiss={() => {
        setDismissed(true)
        try {
          window.localStorage.setItem(appDownloadDismissKey(viewerId), '1')
        } catch {
          // Dismissing still hides the card for this visit.
        }
      }}
    />
  )
}
