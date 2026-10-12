import { emptyPollDraft } from '@/features/social/PollComposer'
import {
  canPublishFeedPost,
  feedComposerValidationError,
  feedPostPollPayload,
  mediaPickerSelectionLimit,
} from '@/features/social/feedComposer'

describe('feed composer validation', () => {
  it('limits each picker selection by staged media, daily quota, and post capacity', () => {
    expect(mediaPickerSelectionLimit({ selected: 0, remaining: 4, limit: 5 })).toBe(4)
    expect(mediaPickerSelectionLimit({ selected: 1, remaining: 4, limit: 5 })).toBe(3)
    expect(mediaPickerSelectionLimit({ selected: 3, remaining: 4, limit: 5 })).toBe(1)
    expect(mediaPickerSelectionLimit({ selected: 2, remaining: 1, limit: 5 })).toBe(0)
    expect(mediaPickerSelectionLimit({ selected: 1, remaining: 4, limit: 2 })).toBe(1)
  })

  it('returns finite clamped picker limits for malformed counts', () => {
    expect(mediaPickerSelectionLimit({ selected: -2, remaining: 3.9, limit: 5.8 })).toBe(3)
    expect(mediaPickerSelectionLimit({ selected: Number.NaN, remaining: 3, limit: 5 })).toBe(0)
    expect(mediaPickerSelectionLimit({ selected: 0, remaining: Number.POSITIVE_INFINITY, limit: 5 })).toBe(0)
    expect(mediaPickerSelectionLimit({ selected: 0, remaining: 3, limit: Number.POSITIVE_INFINITY })).toBe(0)
  })

  it('starts with an empty two-option poll draft', () => {
    expect(emptyPollDraft()).toEqual({ question: '', options: ['', ''] })
  })

  it('publishes text-only, media-only, and poll-only posts', () => {
    expect(feedComposerValidationError({
      body: 'Weekend walk, anyone?',
      mediaCount: 0,
      pollOpen: false,
      pollDraft: emptyPollDraft(),
    })).toBeNull()
    expect(feedComposerValidationError({
      body: '',
      mediaCount: 1,
      pollOpen: false,
      pollDraft: emptyPollDraft(),
    })).toBeNull()
    expect(feedComposerValidationError({
      body: '',
      mediaCount: 0,
      pollOpen: true,
      pollDraft: { question: 'Which time works?', options: ['Morning', 'Afternoon'] },
    })).toBeNull()
  })

  it('prohibits media and polls on the same post', () => {
    expect(feedComposerValidationError({
      body: '',
      mediaCount: 1,
      pollOpen: true,
      pollDraft: { question: 'Which time works?', options: ['Morning', 'Afternoon'] },
    })).toBe('Polls cannot include photos or video. Remove the poll to add media, or remove media to keep the poll.')
  })

  it('surfaces shared poll validation before publishing', () => {
    expect(feedComposerValidationError({
      body: '',
      mediaCount: 0,
      pollOpen: true,
      pollDraft: { question: '', options: ['Morning', 'Afternoon'] },
    })).toBe('Poll question cannot be empty')
    expect(feedComposerValidationError({
      body: '',
      mediaCount: 0,
      pollOpen: true,
      pollDraft: { question: 'Which time?', options: ['Morning', 'morning'] },
    })).toBe('Poll options must be different')
  })

  it('rejects empty and over-long posts', () => {
    expect(feedComposerValidationError({
      body: '   ',
      mediaCount: 0,
      pollOpen: false,
      pollDraft: emptyPollDraft(),
    })).toBe('Write something or add media to publish.')
    expect(feedComposerValidationError({
      body: `${'a'.repeat(1_001)}`,
      mediaCount: 0,
      pollOpen: false,
      pollDraft: emptyPollDraft(),
    })).toContain('Shorten the post to publish.')
  })

  it('gates the publish control on validity and busy state', () => {
    const valid = {
      body: 'Weekend walk, anyone?',
      mediaCount: 0,
      pollOpen: false,
      pollDraft: emptyPollDraft(),
    }
    expect(canPublishFeedPost(valid, false)).toBe(true)
    expect(canPublishFeedPost(valid, true)).toBe(false)
    expect(canPublishFeedPost({ ...valid, body: '' }, false)).toBe(false)
  })

  it('builds a trimmed poll payload only when a poll is open', () => {
    expect(feedPostPollPayload({
      body: '',
      mediaCount: 0,
      pollOpen: true,
      pollDraft: { question: '  Which time works?  ', options: ['  Morning ', 'Afternoon  '] },
    })).toEqual({ question: 'Which time works?', options: ['Morning', 'Afternoon'] })
    expect(feedPostPollPayload({
      body: 'Just text',
      mediaCount: 0,
      pollOpen: false,
      pollDraft: emptyPollDraft(),
    })).toBeUndefined()
  })
})
