import type { HTMLAttributes, ReactNode } from 'react'
import { Avatar } from '../../design-system/atoms/Avatar'

export function CommentBubble({ author, imageUrl, timestamp, dateTime, edited = false, actions, children, className = '', ...props }: HTMLAttributes<HTMLElement> & {
  author: string
  imageUrl?: string | null
  timestamp: string
  dateTime?: string
  edited?: boolean
  actions?: ReactNode
}) {
  return (
    <article className={`ds-comment-bubble ${className}`.trim()} {...props}>
      <Avatar name={author} src={imageUrl} size="small" decorative />
      <div className="ds-comment-copy">
        <header className="ds-comment-head">
          <div className="ds-comment-identity">
            <strong>{author}</strong>
            <div className="ds-comment-meta">
              <time dateTime={dateTime}>{timestamp}</time>
              {edited ? (
                <>
                  <span aria-hidden="true">·</span>
                  <span>Edited</span>
                </>
              ) : null}
            </div>
          </div>
          {actions ? <div className="ds-comment-actions">{actions}</div> : null}
        </header>
        <div className="ds-comment-body">{children}</div>
      </div>
    </article>
  )
}
