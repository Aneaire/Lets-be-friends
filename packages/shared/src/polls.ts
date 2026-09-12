export const MIN_POLL_OPTIONS = 2
export const MAX_POLL_OPTIONS = 4
export const MAX_POLL_QUESTION_LENGTH = 200
export const MAX_POLL_OPTION_LENGTH = 80

export type PollValidationInput = {
  question: string
  options: readonly string[]
}

/**
 * Validates a poll before it is written. Returns a member-readable error, or
 * null when the poll is valid. Callers trim and store the normalized values
 * separately so the stored poll matches what was validated.
 */
export function pollValidationError(input: PollValidationInput): string | null {
  const question = input.question.trim()
  if (question.length < 1) return 'Poll question cannot be empty'
  if (question.length > MAX_POLL_QUESTION_LENGTH) {
    return `Poll question must be ${MAX_POLL_QUESTION_LENGTH} characters or fewer`
  }
  const options = input.options.map((option) => option.trim())
  if (options.length < MIN_POLL_OPTIONS) return `A poll needs at least ${MIN_POLL_OPTIONS} options`
  if (options.length > MAX_POLL_OPTIONS) return `A poll can include up to ${MAX_POLL_OPTIONS} options`
  if (options.some((option) => option.length < 1)) return 'Poll options cannot be empty'
  if (options.some((option) => option.length > MAX_POLL_OPTION_LENGTH)) {
    return `Poll options must be ${MAX_POLL_OPTION_LENGTH} characters or fewer`
  }
  const seen = new Set<string>()
  for (const option of options) {
    const key = option.toLowerCase()
    if (seen.has(key)) return 'Poll options must be different'
    seen.add(key)
  }
  return null
}

/**
 * Whole-number percentages that always sum to 100 when at least one vote
 * exists. Uses the largest-remainder method so rounding never drops or adds a
 * percentage point. When there are no votes every option reports zero.
 */
export function pollPercentages(counts: readonly number[]): number[] {
  const safe = counts.map((count) => (Number.isFinite(count) && count > 0 ? count : 0))
  const total = safe.reduce((sum, count) => sum + count, 0)
  if (total === 0) return safe.map(() => 0)
  const raw = safe.map((count) => (count / total) * 100)
  const floors = raw.map((value) => Math.floor(value))
  let remainder = 100 - floors.reduce((sum, value) => sum + value, 0)
  const byRemainder = raw
    .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((left, right) => right.fraction - left.fraction || left.index - right.index)
  const result = [...floors]
  for (const entry of byRemainder) {
    if (remainder <= 0) break
    result[entry.index] += 1
    remainder -= 1
  }
  return result
}
