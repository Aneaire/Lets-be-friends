import { LoaderCircle, Paperclip, Send } from 'lucide-react'
import { useId, useRef, type KeyboardEvent, type ReactNode } from 'react'
import { Textarea } from '../../design-system/atoms/Field'

export type CompactComposerVariant = 'standalone' | 'thread'

export type CompactComposerProps = {
  value: string
  placeholder?: string
  maxLength?: number
  disabled?: boolean
  canSubmit: boolean
  sending?: boolean
  preparing?: boolean
  variant?: CompactComposerVariant
  attachments?: ReactNode
  accept?: string
  attachDisabled?: boolean
  onFilesSelected?: (files: File[]) => void
  hint?: ReactNode
  onChange: (value: string) => void
  onSubmit: () => void
}

export function CompactComposer({
  value,
  placeholder = 'Write a message',
  maxLength = 2000,
  disabled = false,
  canSubmit,
  sending = false,
  preparing = false,
  variant = 'standalone',
  attachments,
  accept = 'image/*,video/*,.pdf,.txt,.csv,.doc,.docx,.xls,.xlsx,.ppt,.pptx',
  attachDisabled = false,
  onFilesSelected,
  hint,
  onChange,
  onSubmit,
}: CompactComposerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const composingRef = useRef(false)
  const hintId = useId()
  const showAttach = Boolean(onFilesSelected)
  const submitDisabled = !canSubmit || disabled || sending || preparing

  const submit = () => {
    if (!submitDisabled) onSubmit()
  }

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    submit()
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing && !composingRef.current) {
      event.preventDefault()
      event.currentTarget.form?.requestSubmit()
    }
  }

  const handleFilesSelected = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.currentTarget.files ?? [])
    event.currentTarget.value = ''
    if (files.length > 0 && onFilesSelected) onFilesSelected(files)
  }

  const sendContent = (
    <>
      {sending || preparing ? <LoaderCircle className="ds-spinner" size={16} aria-hidden="true" /> : <Send size={16} aria-hidden="true" />}
      <span>{sending ? 'Sending…' : preparing ? 'Preparing…' : 'Send'}</span>
    </>
  )

  if (variant === 'standalone') {
    return (
      <form className="ds-compact-composer" data-variant="standalone" onSubmit={handleSubmit}>
        <div className="ds-compact-composer-controls">
          <Textarea
            className="ds-compact-composer-field"
            aria-label="Message"
            rows={1}
            maxLength={maxLength}
            value={value}
            placeholder={placeholder}
            disabled={disabled || sending}
            onChange={(event) => onChange(event.currentTarget.value)}
            onKeyDown={handleKeyDown}
            onCompositionStart={() => { composingRef.current = true }}
            onCompositionEnd={() => { composingRef.current = false }}
          />
          <button type="submit" className="btn btn-social ds-compact-composer-send" disabled={submitDisabled} aria-busy={sending || undefined}>
            {sendContent}
          </button>
        </div>
      </form>
    )
  }

  return (
    <form className="ds-compact-composer" data-variant="thread" onSubmit={handleSubmit}>
      {attachments ? <div className="ds-compact-composer-tray" aria-label="Selected files">{attachments}</div> : null}
      <div className="ds-compact-composer-controls" data-attach={showAttach ? 'true' : undefined}>
        {showAttach && (
          <>
            <input
              ref={fileInputRef}
              className="sr-only"
              type="file"
              multiple
              accept={accept}
              aria-label="Attach files"
              disabled={disabled || sending || attachDisabled}
              onChange={handleFilesSelected}
            />
            <button
              type="button"
              className="ds-compact-composer-attach"
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled || sending || attachDisabled}
              aria-label="Attach files"
              title="Attach files"
            >
              <Paperclip size={18} aria-hidden="true" />
            </button>
          </>
        )}
        <Textarea
          className="ds-compact-composer-field"
          aria-label="Message"
          rows={1}
          maxLength={maxLength}
          value={value}
          placeholder={placeholder}
          disabled={disabled || sending}
          aria-describedby={hint ? hintId : undefined}
          onChange={(event) => onChange(event.currentTarget.value)}
          onKeyDown={handleKeyDown}
          onCompositionStart={() => { composingRef.current = true }}
          onCompositionEnd={() => { composingRef.current = false }}
        />
        <button type="submit" className="btn btn-social ds-compact-composer-send" disabled={submitDisabled} aria-busy={sending || undefined}>
          {sendContent}
        </button>
      </div>
      {hint ? <p className="ds-compact-composer-hint" id={hintId}>{hint}</p> : null}
    </form>
  )
}
