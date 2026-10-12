import { pollValidationError } from '@lets-be-friends/shared'

import type { PollDraft } from './PollComposer'

export const maximumComposerBodyLength = 1_000

export type FeedComposerDraft = {
  body: string
  mediaCount: number
  pollOpen: boolean
  pollDraft: PollDraft
}

export type FeedComposerPollPayload = {
  question: string
  options: string[]
}

export function mediaPickerSelectionLimit(input: { selected: number; remaining?: number; limit: number }): number {
  const limit = Number.isFinite(input.limit) ? Math.max(0, Math.floor(input.limit)) : 0
  const selected = Number.isFinite(input.selected) ? Math.max(0, Math.floor(input.selected)) : limit
  const remaining = input.remaining === undefined
    ? limit
    : Number.isFinite(input.remaining) ? Math.max(0, Math.floor(input.remaining)) : 0
  return Math.max(0, Math.min(limit - selected, remaining - selected))
}

/**
 * Member-readable gating for Home and Circle post creation. Polls are
 * text-only: the backend rejects media plus polls, experience posts with
 * polls, and shared posts with polls, so the composer blocks media plus
 * polls before any upload starts. Circle discussions can reuse these helpers
 * with their own media limit.
 */
export function feedComposerValidationError(draft: FeedComposerDraft): string | null {
  const body = draft.body.trim()
  if (body.length > maximumComposerBodyLength) {
    return `Posts can be up to ${maximumComposerBodyLength.toLocaleString()} characters. Shorten the post to publish.`
  }
  if (draft.pollOpen && draft.mediaCount > 0) {
    return 'Polls cannot include photos or video. Remove the poll to add media, or remove media to keep the poll.'
  }
  if (draft.pollOpen) {
    return pollValidationError(draft.pollDraft)
  }
  if (!body && draft.mediaCount === 0) {
    return 'Write something or add media to publish.'
  }
  return null
}

export function canPublishFeedPost(draft: FeedComposerDraft, busy: boolean): boolean {
  if (busy) return false
  return feedComposerValidationError(draft) === null
}

/**
 * Normalized poll payload for `social.createPost`. Callers must check
 * {@link feedComposerValidationError} first; this returns undefined when no
 * poll is open so media posts never carry a poll payload.
 */
export function feedPostPollPayload(draft: FeedComposerDraft): FeedComposerPollPayload | undefined {
  if (!draft.pollOpen) return undefined
  return {
    question: draft.pollDraft.question.trim(),
    options: draft.pollDraft.options.map((option) => option.trim()),
  }
}
