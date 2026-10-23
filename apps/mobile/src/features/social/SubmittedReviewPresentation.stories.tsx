import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { expect, fn, userEvent, within } from 'storybook/test'

import { SubmittedReviewPresentation } from './SubmittedReviewPresentation'

const onLike = fn()
const onSave = fn()
const onSubmitComment = fn()

const review = {
  id: 'review-1', reviewerId: 'member-1', reviewerDisplayName: 'Maya Santos', timestamp: 'Today',
  revieweeDisplayName: 'Casey Reyes', companionProfileId: 'companion-1', rating: 5,
  body: 'The plan was clear and the conversation felt easy.', liked: false, likeCount: 2, saved: false, commentCount: 1,
  comments: [{ id: 'comment-1', authorDisplayName: 'Maya Santos', body: 'Thank you.', timestamp: 'Now', ownComment: true }],
}

const meta = {
  title: 'Mobile/Social/Submitted review',
  component: SubmittedReviewPresentation,
  globals: { viewport: { value: 'mobileSmall', isRotated: false } },
  args: {
    review, busy: false, commentBusy: false, commentDraft: 'A follow-up', onBack: fn(), onOpenReviewerProfile: fn(),
    onOpenPublicReview: fn(), onLike, onSave, onShareToFeed: fn(), onShareLink: fn(), onCommentDraftChange: fn(),
    onSubmitComment, onDeleteComment: fn(),
  },
} satisfies Meta<typeof SubmittedReviewPresentation>

export default meta
type Story = StoryObj<typeof meta>

export const PublicCompanionReview: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Experience with Casey Reyes')).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: 'Like post' }))
    await expect(onLike).toHaveBeenCalled()
    await userEvent.click(canvas.getByRole('button', { name: 'Post comment' }))
    await expect(onSubmitComment).toHaveBeenCalled()
    await expect(canvas.getByRole('button', { name: 'Share post' })).toBeVisible()
  },
}

export const PrivateMemberReview: Story = {
  args: { review: { ...review, companionProfileId: undefined, revieweeDisplayName: 'Jordan Member' } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Experience with Jordan Member')).toBeVisible()
    await expect(canvas.getByText('This private Companion-to-member review cannot be shared publicly.')).toBeVisible()
    await expect(canvas.queryByRole('button', { name: 'Share post' })).not.toBeInTheDocument()
  },
}

export const DarkPrivateReview: Story = {
  args: { review: { ...review, companionProfileId: undefined, revieweeDisplayName: 'Jordan Member' } },
  globals: { theme: 'dark', viewport: { value: 'mobileSmall', isRotated: false } },
}
