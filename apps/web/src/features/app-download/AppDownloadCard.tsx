import { Smartphone, X } from 'lucide-react'
import { PLAY_STORE_URL } from './appDownload'

export function AppDownloadCard({
  playStoreUrl = PLAY_STORE_URL,
  onDismiss,
}: {
  playStoreUrl?: string
  onDismiss: () => void
}) {
  return (
    <section className="panel p-5 mb-6" aria-labelledby="app-download-title">
      <div className="flex items-start gap-3">
        <span
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[color:var(--rule)] bg-[color:var(--surface-subtle)] text-[color:var(--text)]"
          aria-hidden="true"
        >
          <Smartphone size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 id="app-download-title" className="text-h3">Take Let&apos;s Be Friends with you</h2>
              <p className="text-meta mt-1">
                Get the Android app to book, message, and keep up with your plans on the go. The iPhone app is coming later.
              </p>
            </div>
            <button
              type="button"
              className="btn btn-ghost btn-sm shrink-0"
              aria-label="Dismiss the app download offer"
              onClick={onDismiss}
            >
              <X size={16} aria-hidden="true" />
            </button>
          </div>
          <div className="mt-3">
            <a className="btn btn-neutral btn-sm" href={playStoreUrl} target="_blank" rel="noreferrer">
              Get the Android app
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}
