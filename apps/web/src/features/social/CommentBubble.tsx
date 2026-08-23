import type { HTMLAttributes, ReactNode } from 'react'
import { Avatar } from '../../design-system/atoms/Avatar'

export function CommentBubble({ author, imageUrl, timestamp, actions, children, className = '', ...props }: HTMLAttributes<HTMLElement> & {
  author: string
  imageUrl?: string | null
  timestamp: string
  actions?: ReactNode
}) {
  return (
    <article className={`ds-comment-bubble ${className}`.trim()} {...props}>
      <Avatar name={author} src={imageUrl} size="small" decorative />
      <div className="ds-comment-copy">
        <header className="ds-comment-head">
          <strong>{author}</strong>
          <span aria-hidden="true">·</span>
          <time>{timestamp}</time>
          {actions ? <div className="ds-comment-actions">{actions}</div> : null}
        </header>
        <div className="ds-comment-body">{children}</div>
      </div>
    </article>
  )
}
