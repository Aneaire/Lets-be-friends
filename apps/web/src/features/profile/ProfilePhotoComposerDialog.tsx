import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react'
import { ImagePlus } from 'lucide-react'
import { Dialog } from '../../design-system/molecules/Dialog'
import { SegmentedControl } from '../../design-system/molecules/SegmentedControl'
import { describeConvexError } from '../../lib/convexErrors'
import { MentionField } from '../social/MentionField'
import { PostCard } from '../social/PostCard'
import { AvatarCropper } from './AvatarCropper'
import { defaultAvatarCrop, type AvatarCrop } from './avatarCrop'

const profileImageMaxBytes = 5 * 1024 * 1024

/**
 * The profile photo is chosen inside the same post card members will see it on,
 * so the crop, author, and framing read as one update instead of a file picker.
 */
export function ProfilePhotoComposerView({
  authorName,
  authorImageUrl,
  previewUrl,
  file,
  crop,
  onCropChange,
  captionField,
  shareToFeed,
  onShareToFeedChange,
  dragging,
  onDraggingChange,
  onChooseFile,
  busy,
  error,
  draggingLabel,
  emptyLabel,
  imageHint,
}: {
  authorName: string
  authorImageUrl?: string | null
  previewUrl?: string
  file: File | null
  crop: AvatarCrop
  onCropChange: (crop: AvatarCrop) => void
  captionField?: ReactNode
  shareToFeed: boolean
  onShareToFeedChange: (shareToFeed: boolean) => void
  dragging: boolean
  onDraggingChange: (dragging: boolean) => void
  onChooseFile: (files: File[]) => void
  busy: boolean
  error: string
  draggingLabel: string
  emptyLabel: string
  imageHint: string
}) {
  const inputId = useId()
  const dragDepth = useRef(0)

  return (
    <div
      className="post-editor profile-photo-editor"
      data-dragging={dragging ? 'true' : undefined}
      onDragEnter={(event) => {
        event.preventDefault()
        dragDepth.current += 1
        onDraggingChange(true)
      }}
      onDragOver={(event) => event.preventDefault()}
      onDragLeave={(event) => {
        event.preventDefault()
        dragDepth.current = Math.max(0, dragDepth.current - 1)
        if (dragDepth.current === 0) onDraggingChange(false)
      }}
      onDrop={(event) => {
        event.preventDefault()
        dragDepth.current = 0
        onDraggingChange(false)
        if (busy) return
        onChooseFile(Array.from(event.dataTransfer.files))
      }}
    >
      <input
        id={inputId}
        type="file"
        accept="image/*"
        className="sr-only"
        aria-label="Choose a profile photo"
        disabled={busy}
        onChange={(event) => {
          onChooseFile(Array.from(event.currentTarget.files ?? []))
          event.currentTarget.value = ''
        }}
      />
      <PostCard
        author={authorName}
        imageUrl={previewUrl ?? authorImageUrl}
        timestamp="Just now"
        className="post-editor-card profile-photo-card"
        aria-label="Profile photo preview"
      >
        {captionField}

        {file ? (
          <>
            <div className="profile-photo-cropper">
              <AvatarCropper file={file} crop={crop} onChange={onCropChange} />
            </div>
            <label htmlFor={inputId} className="post-editor-drop" data-compact="true">
              <ImagePlus size={16} aria-hidden="true" />
              <span className="post-editor-drop-title">Choose another photo</span>
            </label>
          </>
        ) : (
          <label htmlFor={inputId} className="post-editor-drop">
            <ImagePlus size={20} aria-hidden="true" />
            <span className="post-editor-drop-title">
              {dragging ? draggingLabel : emptyLabel}
            </span>
            <span className="text-meta">{imageHint}</span>
          </label>
        )}

        <SegmentedControl
          label="Who can see this update?"
          options={[
            { value: 'public', label: 'Public', disabled: busy },
            { value: 'private', label: 'Private', disabled: busy },
          ]}
          value={shareToFeed ? 'public' : 'private'}
          onChange={(value) => onShareToFeedChange(value === 'public')}
          tone={shareToFeed ? 'social' : 'self'}
          className="profile-photo-visibility"
        />
        <p className="profile-photo-share-note">
          {shareToFeed
            ? 'A post is added to the feed. Your profile picture changes too.'
            : 'Only your profile picture changes. No post is added to the feed.'}
        </p>

        {error && <p className="post-editor-error" role="alert">{error}</p>}
      </PostCard>
    </div>
  )
}

export function ProfilePhotoComposerDialog({
  open,
  onClose,
  authorName,
  authorImageUrl,
  onSave,
  renderCaptionField,
}: {
  open: boolean
  onClose: () => void
  authorName: string
  authorImageUrl?: string | null
  onSave: (input: { file: File; crop: AvatarCrop; caption: string; shareToFeed: boolean }) => Promise<void>
  renderCaptionField?: (field: { value: string; onChange: (value: string) => void }) => ReactNode
}) {
  const [file, setFile] = useState<File | null>(null)
  const [crop, setCrop] = useState<AvatarCrop>(defaultAvatarCrop)
  const [caption, setCaption] = useState('')
  const [shareToFeed, setShareToFeed] = useState(true)
  const [dragging, setDragging] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const previewUrl = useMemo(() => (file ? URL.createObjectURL(file) : undefined), [file])

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
  }, [previewUrl])

  // Each opening starts from the current photo so a cancelled draft leaves no
  // selected file or framing behind.
  useEffect(() => {
    if (!open) return
    setFile(null)
    setCrop(defaultAvatarCrop)
    setCaption('')
    setShareToFeed(true)
    setDragging(false)
    setError('')
  }, [open])

  function chooseFile(files: File[]) {
    setError('')
    const next = files[0]
    if (!next) return
    if (!next.type.startsWith('image/')) {
      setError('Choose an image file for your profile photo.')
      return
    }
    if (next.size > profileImageMaxBytes) {
      setError('Profile image must be 5 MB or smaller.')
      return
    }
    setFile(next)
    setCrop(defaultAvatarCrop)
  }

  async function save() {
    if (!file) {
      setError('Choose a photo for your profile first.')
      return
    }
    setBusy(true)
    setError('')
    try {
      await onSave({ file, crop, caption: caption.trim(), shareToFeed })
      onClose()
    } catch (saveError) {
      setError(saveError instanceof Error
        ? describeConvexError(saveError)
        : shareToFeed ? 'Profile photo could not be posted.' : 'Profile photo could not be saved.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      open={open}
      onClose={busy ? () => undefined : onClose}
      title="Update profile picture"
      description="Choose the photo members will see next to your name."
      size="large"
      className="post-composer-dialog profile-photo-dialog"
      busy={busy}
      footer={(
        <>
          <button type="button" className="btn btn-neutral" onClick={onClose} disabled={busy}>Cancel</button>
          <button
            type="button"
            className={shareToFeed ? 'btn btn-social' : 'btn btn-self'}
            onClick={() => void save()}
            disabled={busy || !file}
          >
            {busy ? (shareToFeed ? 'Posting…' : 'Saving…') : shareToFeed ? 'Post' : 'Save photo'}
          </button>
        </>
      )}
    >
      <ProfilePhotoComposerView
        authorName={authorName}
        authorImageUrl={authorImageUrl}
        previewUrl={previewUrl}
        file={file}
        crop={crop}
        onCropChange={setCrop}
        captionField={shareToFeed ? (
          renderCaptionField
            ? renderCaptionField({ value: caption, onChange: setCaption })
            : (
              <MentionField
                value={caption}
                onChange={setCaption}
                name="profilePictureCaption"
                className="post-editor-body"
                maxLength={1000}
                placeholder="Say something about your new photo (optional)"
                ariaLabel="Profile picture caption"
                multiline
              />
            )
        ) : undefined}
        shareToFeed={shareToFeed}
        onShareToFeedChange={setShareToFeed}
        dragging={dragging}
        onDraggingChange={setDragging}
        onChooseFile={chooseFile}
        busy={busy}
        error={error}
        draggingLabel="Drop to use this photo"
        emptyLabel="Drag a photo here, or choose a file"
        imageHint="PNG, JPG, or GIF. 5 MB max."
      />
    </Dialog>
  )
}
