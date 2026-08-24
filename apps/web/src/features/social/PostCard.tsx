import { forwardRef, type HTMLAttributes, type ReactNode } from 'react'
import { Avatar } from '../../design-system/atoms/Avatar'

export const PostCard = forwardRef<HTMLElement, HTMLAttributes<HTMLElement> & {
  author: string
  imageUrl?: string | null
  timestamp: string
  dateTime?: string
  meta?: ReactNode
  avatarAction?: ReactNode
  authorAction?: ReactNode
  actions?: ReactNode
}>(function PostCard({ author, imageUrl, timestamp, dateTime, meta, avatarAction, authorAction, actions, children, className = '', ...props }, ref) {
  const avatar = <Avatar name={author} src={imageUrl} size="large" decorative />

  return (
    <article ref={ref} className={`ds-post-card ${className}`.trim()} {...props}>
      <header className="ds-post-head">
        <div className="ds-post-avatar">{avatarAction ?? avatar}</div>
        <div className="ds-post-identity">
          {authorAction ?? <strong>{author}</strong>}
          <span className="ds-post-meta-separator" aria-hidden="true">·</span>
          <time dateTime={dateTime}>{timestamp}</time>
          {meta}
        </div>
        {actions}
      </header>
      <div className="ds-post-body">{children}</div>
    </article>
  )
})
