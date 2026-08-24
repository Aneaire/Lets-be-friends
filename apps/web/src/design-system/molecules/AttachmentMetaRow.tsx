import type { HTMLAttributes, ReactNode } from 'react'

export type AttachmentStateTone = 'neutral' | 'progress' | 'success' | 'danger'

export type AttachmentMetaRowProps = HTMLAttributes<HTMLDivElement> & {
  leading?: ReactNode
  name: ReactNode
  detail?: ReactNode
  state?: ReactNode
  stateTone?: AttachmentStateTone
  action?: ReactNode
}

export function AttachmentMetaRow({
  leading,
  name,
  detail,
  state,
  stateTone = 'neutral',
  action,
  className = '',
  ...props
}: AttachmentMetaRowProps) {
  const hasState = state !== undefined && state !== null

  return (
    <div
      {...props}
      className={`ds-attachment-meta-row ${className}`.trim()}
      data-state-tone={hasState ? stateTone : undefined}
    >
      {leading ? <span className="ds-attachment-meta-row-leading">{leading}</span> : null}
      <span className="ds-attachment-meta-row-copy">
        <strong className="ds-attachment-meta-row-name">{name}</strong>
        {detail ? <span className="ds-attachment-meta-row-detail">{detail}</span> : null}
      </span>
      {hasState ? <span className="ds-attachment-meta-row-state">{state}</span> : null}
      {action ? <span className="ds-attachment-meta-row-action">{action}</span> : null}
    </div>
  )
}
