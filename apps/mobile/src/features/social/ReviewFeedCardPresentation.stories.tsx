import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { expect, fn, userEvent, within } from 'storybook/test'

import { ReviewFeedCardPresentation } from './ReviewFeedCardPresentation'

const openReviewerProfile = fn()
const openReview = fn()
const like = fn()
const save = fn()
const share = fn()

const meta = {
  title: 'Mobile/Social/Review feed card',
  component: ReviewFeedCardPresentation,
  globals: { viewport: { value: 'mobileSmall', isRotated: false } },
  args: {
    reviewerDisplayName: 'Alex Rivera',
    timestamp: 'Aug 14, 9:22 PM',
    companionName: 'María Santos',
    rating: 4.7,
    body: 'We kept the session public and it was a calm, useful hour of conversation practice.',
    liked: false,
    likeCount: 3,
    saved: false,
    commentCount: 2,
    onOpenReviewerProfile: openReviewerProfile,
    onOpenReview: openReview,
    onLike: like,
    onSave: save,
    onShare: share,
  },
} satisfies Meta<typeof ReviewFeedCardPresentation>

export default meta
type Story = StoryObj<typeof meta>

export const Ready: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Experience with María Santos')).toBeVisible()
    await expect(canvas.getByLabelText('4.7 out of 5 stars')).toBeVisible()
    await expect(canvas.getAllByRole('button', { name: /View Alex Rivera's profile/ })).toHaveLength(2)
    await userEvent.click(canvas.getAllByRole('button', { name: /View Alex Rivera's profile/ })[1])
    await userEvent.click(canvas.getByRole('button', { name: 'View review' }))
    await userEvent.click(canvas.getByRole('button', { name: 'Like post' }))
    await userEvent.click(canvas.getByRole('button', { name: 'Save post' }))
    await userEvent.click(canvas.getByRole('button', { name: 'Share post' }))
    await expect(openReviewerProfile).toHaveBeenCalled()
    await expect(openReview).toHaveBeenCalled()
    await expect(like).toHaveBeenCalledTimes(1)
    await expect(save).toHaveBeenCalledTimes(1)
    await expect(share).toHaveBeenCalledTimes(1)
  },
}

export const SignedOutReadOnly: Story = {
  args: { disabled: true, onShare: undefined },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('button', { name: 'Like post' })).toBeDisabled()
    await expect(canvas.queryByRole('button', { name: 'Share post' })).not.toBeInTheDocument()
  },
}

export const LongIdentityAt320: Story = {
  args: { reviewerDisplayName: 'María Alexandra de la Cruz-Santos' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const profileLinks = canvas.getAllByRole('button', { name: /View María Alexandra de la Cruz-Santos's profile/ })
    const nameLink = profileLinks[1]
    const experienceLink = canvas.getByRole('button', { name: 'Experience with María Santos' })

    await expect(canvasElement.scrollWidth).toBeLessThanOrEqual(canvasElement.clientWidth)
    await expect(canvas.getByText('María Alexandra de la Cruz-Santos')).toBeVisible()
    await expect(nameLink.getBoundingClientRect().width).toBeGreaterThan(160)
    await expect(experienceLink.getBoundingClientRect().top).toBeGreaterThan(nameLink.getBoundingClientRect().top)
  },
}
