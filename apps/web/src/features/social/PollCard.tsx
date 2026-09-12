import { useEffect, useState } from 'react'

export type PollView = {
  question: string
  options: Array<{ id: string; label: string; voteCount: number; percentage: number }>
  totalVotes: number
  closesAt?: number
  closed: boolean
  votedOptionId?: string
}

export function PollCard({
  poll,
  disabled = false,
  onVote,
}: {
  poll: PollView
  disabled?: boolean
  onVote: (optionId: string) => Promise<void>
}) {
  const [selected, setSelected] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const hasVoted = Boolean(poll.votedOptionId)
  const canVote = !hasVoted && !poll.closed && !disabled
  const totalLabel = `${poll.totalVotes} ${poll.totalVotes === 1 ? 'vote' : 'votes'}`

  useEffect(() => {
    setSelected(null)
  }, [poll.votedOptionId])

  async function vote() {
    if (!selected || busy) return
    setBusy(true)
    setError('')
    try {
      await onVote(selected)
    } catch (voteError) {
      setError(voteError instanceof Error ? voteError.message : 'Your vote could not be recorded.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="social-poll" aria-label={`Poll: ${poll.question}`}>
      <div className="social-poll-head">
        <p className="social-poll-question">{poll.question}</p>
        <span className="social-poll-total tabular">{poll.closed ? 'Closed' : totalLabel}</span>
      </div>
      <div className="social-poll-options" role="radiogroup" aria-label="Poll options">
        {poll.options.map((option) => {
          const voted = poll.votedOptionId === option.id
          const isSelected = selected === option.id
          const active = voted || isSelected
          return (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={active}
              className="social-poll-option"
              data-voted={voted}
              data-selected={isSelected}
              disabled={!canVote || busy}
              onClick={() => {
                setSelected(option.id)
                setError('')
              }}
            >
              <span className="social-poll-fill" style={{ width: `${Math.min(100, Math.max(0, option.percentage))}%` }} aria-hidden="true" />
              <span className="social-poll-marker" aria-hidden="true" data-active={active} />
              <span className="social-poll-option-label">{option.label}</span>
              <span className="social-poll-option-result tabular">{option.percentage}% ({option.voteCount})</span>
            </button>
          )
        })}
      </div>
      {canVote && (
        <button type="button" className="btn btn-social btn-sm social-poll-vote" disabled={!selected || busy} onClick={() => void vote()}>
          {busy ? 'Voting...' : 'Vote'}
        </button>
      )}
      {hasVoted && <p className="text-meta social-poll-status" role="status">Your vote is in. Results stay live.</p>}
      {poll.closed && !hasVoted && <p className="text-meta social-poll-status" role="status">This poll is closed.</p>}
      {error && <p className="notice notice-danger social-poll-error" role="alert">{error}</p>}
    </section>
  )
}
