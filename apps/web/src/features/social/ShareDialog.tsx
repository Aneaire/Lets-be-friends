import { Share2 } from 'lucide-react'
import { useState } from 'react'
import { Dialog } from '../../design-system/molecules/Dialog'
import { Button } from '../../design-system/atoms/Button'
import { copyShareUrl } from './shareLinks'

export type SharePreview = {
  label: string
  body: string
  imageUrl?: string | null
  meta?: string
}

export function ShareDialog({
  open,
  onClose,
  title,
  preview,
  url,
  onShareToFeed,
  onShared,
  onCopied,
}: {
  open: boolean
  onClose: () => void
  title: string
  preview: SharePreview
  url: string
  onShareToFeed: (message: string) => Promise<void>
  onShared?: () => void
  onCopied?: () => void
}) {
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  function close() {
    if (busy) return
    setMessage('')
    setError('')
    onClose()
  }

  async function shareToFeed() {
    setBusy(true)
    setError('')
    try {
      await onShareToFeed(message.trim())
      setMessage('')
      onShared?.()
      onClose()
    } catch (shareError) {
      setError(shareError instanceof Error ? shareError.message : 'This could not be shared.')
    } finally {
      setBusy(false)
    }
  }

  async function copyLink() {
    setError('')
    const copied = await copyShareUrl(url)
    if (copied) {
      onCopied?.()
      onClose()
    } else {
      setError('The link could not be copied. Copy it from the address bar instead.')
    }
  }

  return (
    <Dialog
      open={open}
      onClose={close}
      title={title}
      description="Share it to your feed with a note, or copy a link."
      busy={busy}
      size="medium"
      footer={(
        <>
          <Button intent="ghost" onClick={() => void copyLink()} disabled={busy}>
            <span className="social-share-copy-label"><Share2 size={15} aria-hidden="true" /> Copy link</span>
          </Button>
          <Button intent="social" loading={busy} loadingLabel="Sharing" onClick={() => void shareToFeed()}>
            Share to feed
          </Button>
        </>
      )}
    >
      <div className="social-share-preview" aria-label={`${preview.label} preview`}>
        {preview.imageUrl ? <img src={preview.imageUrl} alt="" className="social-share-preview-image" /> : null}
        <div className="social-share-preview-copy">
          <p className="social-share-preview-label">{preview.label}</p>
          {preview.meta ? <p className="social-share-preview-meta">{preview.meta}</p> : null}
          {preview.body ? <p className="social-share-preview-body">{preview.body}</p> : null}
        </div>
      </div>
      <label className="social-share-message">
        <span className="text-meta">Add a note (optional)</span>
        <textarea
          className="field"
          value={message}
          maxLength={500}
          placeholder="Why is this worth sharing?"
          onChange={(event) => setMessage(event.currentTarget.value)}
        />
      </label>
      {error ? <p className="social-comment-error" role="alert">{error}</p> : null}
    </Dialog>
  )
}
