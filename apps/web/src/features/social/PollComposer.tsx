import { MAX_POLL_OPTIONS, MAX_POLL_OPTION_LENGTH, MAX_POLL_QUESTION_LENGTH, MIN_POLL_OPTIONS, pollValidationError } from '@lets-be-friends/shared'
import { Plus, X } from 'lucide-react'

export type PollDraft = {
  question: string
  options: string[]
}

export function emptyPollDraft(): PollDraft {
  return { question: '', options: ['', ''] }
}

export function PollComposer({
  value,
  onChange,
  disabled = false,
}: {
  value: PollDraft
  onChange: (next: PollDraft) => void
  disabled?: boolean
}) {
  const error = pollValidationError(value)
  const update = (next: Partial<PollDraft>) => onChange({ ...value, ...next })

  function setOption(index: number, text: string) {
    update({ options: value.options.map((option, current) => (current === index ? text : option)) })
  }

  function addOption() {
    if (value.options.length >= MAX_POLL_OPTIONS) return
    update({ options: [...value.options, ''] })
  }

  function removeOption(index: number) {
    if (value.options.length <= MIN_POLL_OPTIONS) return
    update({ options: value.options.filter((_, current) => current !== index) })
  }

  return (
    <fieldset className="social-poll-composer" disabled={disabled}>
      <legend>Poll</legend>
      <label className="social-poll-composer-field">
        <span>Question</span>
        <input
          className="field"
          value={value.question}
          maxLength={MAX_POLL_QUESTION_LENGTH}
          placeholder="Ask the community a question"
          onChange={(event) => update({ question: event.currentTarget.value })}
        />
        <small className="text-meta tabular">{value.question.length}/{MAX_POLL_QUESTION_LENGTH}</small>
      </label>
      <div className="social-poll-composer-options">
        {value.options.map((option, index) => (
          <div className="social-poll-composer-option" key={index}>
            <input
              className="field"
              value={option}
              maxLength={MAX_POLL_OPTION_LENGTH}
              placeholder={`Option ${index + 1}`}
              aria-label={`Poll option ${index + 1}`}
              onChange={(event) => setOption(index, event.currentTarget.value)}
            />
            {value.options.length > MIN_POLL_OPTIONS && (
              <button
                type="button"
                className="social-icon-button"
                aria-label={`Remove option ${index + 1}`}
                title={`Remove option ${index + 1}`}
                onClick={() => removeOption(index)}
              >
                <X size={15} />
              </button>
            )}
          </div>
        ))}
      </div>
      <div className="social-poll-composer-actions">
        <button
          type="button"
          className="btn btn-neutral btn-sm"
          disabled={value.options.length >= MAX_POLL_OPTIONS}
          onClick={addOption}
        >
          <Plus size={14} />
          Add option
        </button>
        <span className="text-meta" role={error ? 'alert' : undefined}>{error ?? `${value.options.length} of ${MAX_POLL_OPTIONS} options`}</span>
      </div>
    </fieldset>
  )
}
