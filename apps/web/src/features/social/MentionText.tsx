import { splitBodyIntoSegments, type StoredMention } from '@lets-be-friends/shared'
import { Link } from '@tanstack/react-router'

export function MentionText({ body, mentions, className }: { body: string; mentions?: StoredMention[]; className?: string }) {
  const segments = splitBodyIntoSegments(body, mentions ?? [])
  return (
    <p className={className}>
      {segments.map((segment, index) => segment.type === 'mention' ? (
        <Link
          key={index}
          to="/member-profile"
          search={{ userId: segment.userId }}
          className="social-mention"
          onClick={(event) => event.stopPropagation()}
        >
          @{segment.username}
        </Link>
      ) : (
        <span key={index}>{segment.text}</span>
      ))}
    </p>
  )
}
