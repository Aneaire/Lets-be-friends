import { useRef, useState } from 'react'
import { useQuery } from 'convex/react'
import { User } from 'lucide-react'
import { activeMentionQuery } from '@lets-be-friends/shared'
import { api } from '../../../convex/_generated/api'

export function MentionField({
  value,
  onChange,
  name,
  placeholder,
  ariaLabel,
  maxLength,
  multiline = false,
  className,
  autoFocus = false,
}: {
  value: string
  onChange: (value: string) => void
  name: string
  placeholder: string
  ariaLabel: string
  maxLength: number
  multiline?: boolean
  className?: string
  autoFocus?: boolean
}) {
  const [caret, setCaret] = useState(value.length)
  const [open, setOpen] = useState(false)
  const openRef = useRef(false)
  const activeToken = activeMentionQuery(value, caret)
  const suggestions = useQuery(api.social.mentionLookup, activeToken ? { query: activeToken } : 'skip')

  const syncCaret = (nextValue: string, nextCaret: number) => {
    setCaret(nextCaret)
    openRef.current = Boolean(activeMentionQuery(nextValue, nextCaret))
    setOpen(openRef.current)
  }

  const insertMention = (username: string) => {
    const before = value.slice(0, caret).replace(/@[a-z0-9_]*$/i, `@${username} `)
    const after = value.slice(caret)
    onChange(before + after)
    openRef.current = false
    setOpen(false)
  }

  const shared = {
    name,
    placeholder,
    'aria-label': ariaLabel,
    maxLength,
    autoFocus,
    value,
    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const next = event.currentTarget.value
      const nextCaret = event.currentTarget.selectionStart ?? next.length
      onChange(next)
      syncCaret(next, nextCaret)
    },
    onSelect: (event: React.SyntheticEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const el = event.currentTarget
      syncCaret(el.value, el.selectionStart ?? el.value.length)
    },
    onFocus: () => {
      openRef.current = Boolean(activeMentionQuery(value, caret))
      setOpen(openRef.current)
    },
    onKeyDown: (event: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      if (event.key === 'Escape' && openRef.current) {
        event.preventDefault()
        openRef.current = false
        setOpen(false)
      }
    },
  }

  return (
    <div className="social-mention-wrap">
      {multiline ? (
        <textarea {...shared} className={className} />
      ) : (
        <input {...shared} className={className} />
      )}
      {open && suggestions && suggestions.length > 0 && (
        <div className="social-mention-menu" role="listbox" aria-label="Mention suggestions">
          {suggestions.map((suggestion) => (
            <button
              key={suggestion.userId}
              type="button"
              role="option"
              className="social-mention-option"
              onClick={() => insertMention(suggestion.username)}
            >
              <span className="avatar" aria-hidden="true"><User aria-hidden="true" /></span>
              <span className="social-mention-option-copy">
                <strong>{suggestion.displayName}</strong>
                <small>@{suggestion.username}</small>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
