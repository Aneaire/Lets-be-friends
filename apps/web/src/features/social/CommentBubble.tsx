import type { HTMLAttributes, ReactNode } from 'react'
import type { CommentThreadPosition } from '@lets-be-friends/shared'
import { Avatar } from '../../design-system/atoms/Avatar'

export function CommentBubble({ author, imageUrl, timestamp, dateTime, edited = false, avatarAction, actions, replyContext, threadPosition = 'standalone', isLastReply = false, children, className = '', ...props }: HTMLAttributes<HTMLElement> & {
  author: string
  imageUrl?: string | null
  timestamp: string
  dateTime?: string
  edited?: boolean
  avatarAction?: ReactNode
  actions?: ReactNode
  replyContext?: ReactNode
  threadPosition?: CommentThreadPosition
  isLastReply?: boolean
}) {
  const avatar = <Avatar name={author} src={imageUrl} size="small" className="ds-comment-avatar" decorative />

  return (
    <article
      className={`ds-comment-bubble ${threadPosition === 'reply' ? 'ds-comment-bubble--reply' : ''} ${className}`.trim()}
      data-thread-position={threadPosition}
      data-last-reply={isLastReply}
      {...props}
    >
      <div className="ds-comment-avatar-slot">
        {avatarAction ? <div className="ds-comment-avatar-action">{avatarAction}</div> : avatar}
      </div>
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
        {replyContext ? <div className="ds-comment-reply-context">{replyContext}</div> : null}
        <div className="ds-comment-body">{children}</div>
      </div>
    </article>
  )
}
