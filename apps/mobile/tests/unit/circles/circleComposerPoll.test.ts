import { emptyPollDraft } from '@/features/social/PollComposer'
import { canPublishFeedPost, feedComposerValidationError, feedPostPollPayload } from '@/features/social/feedComposer'
import {
  MAX_CIRCLE_POST_MEDIA,
  circleActionError,
  circlePollAnnouncementError,
} from '@/features/circles/circlePresentation'

describe('mobile Circle poll composer', () => {
  it('starts polls from the shared empty draft', () => {
    expect(emptyPollDraft()).toEqual({ question: '', options: ['', ''] })
  })

  it('keeps Circle polls text-only and capped at three media items', () => {
    expect(MAX_CIRCLE_POST_MEDIA).toBe(3)
    expect(
      feedComposerValidationError({
        body: '',
        mediaCount: 1,
        pollOpen: true,
        pollDraft: { question: 'Which morning works?', options: ['Saturday', 'Sunday'] },
      }),
    ).toContain('Polls cannot include')
  })

  it('validates a Circle poll through the shared composer rules', () => {
    const valid = { question: 'Which morning works?', options: ['Saturday', 'Sunday'] }
    expect(feedComposerValidationError({ body: '', mediaCount: 0, pollOpen: true, pollDraft: valid })).toBeNull()
    expect(canPublishFeedPost({ body: '', mediaCount: 0, pollOpen: true, pollDraft: valid }, false)).toBe(true)
    expect(
      feedComposerValidationError({ body: '', mediaCount: 0, pollOpen: true, pollDraft: emptyPollDraft() }),
    ).not.toBeNull()
    expect(canPublishFeedPost({ body: '', mediaCount: 0, pollOpen: true, pollDraft: emptyPollDraft() }, false)).toBe(false)
  })

  it('builds the Circle poll payload from the shared helper', () => {
    const payload = feedPostPollPayload({
      body: '',
      mediaCount: 0,
      pollOpen: true,
      pollDraft: { question: '  Which morning works?  ', options: [' Saturday ', 'Sunday'] },
    })
    expect(payload).toEqual({ question: 'Which morning works?', options: ['Saturday', 'Sunday'] })
    expect(
      feedPostPollPayload({ body: 'hello', mediaCount: 0, pollOpen: false, pollDraft: emptyPollDraft() }),
    ).toBeUndefined()
  })

  it('never attaches a poll to an announcement', () => {
    expect(circlePollAnnouncementError({ announcement: true, pollOpen: true })).toContain('Announcements cannot include a poll')
    expect(circlePollAnnouncementError({ announcement: false, pollOpen: true })).toBeNull()
    expect(circlePollAnnouncementError({ announcement: true, pollOpen: false })).toBeNull()
  })
})

describe('mobile Circle action error copy', () => {
  it('shows the fallback instead of backend diagnostics', () => {
    expect(circleActionError(new Error('Uncaught ConvexError: posts.create failed at Object.keys'), 'The Circle action could not be completed.')).toBe(
      'The Circle action could not be completed.',
    )
    expect(circleActionError(new Error('at run (convex/social.ts:42:11)\nstack overflow'), 'Please try again.')).toBe('Please try again.')
    expect(circleActionError(undefined, 'Please try again.')).toBe('Please try again.')
  })

  it('passes through short known-safe member copy', () => {
    expect(circleActionError(new Error('Circle posts can include up to 3 photos or videos.'), 'Please try again.')).toContain('up to 3')
    expect(
      circleActionError(new Error('Your daily community media allowance is used. You can publish without media or try again tomorrow.'), 'Please try again.'),
    ).toContain('daily community media allowance')
  })
})
