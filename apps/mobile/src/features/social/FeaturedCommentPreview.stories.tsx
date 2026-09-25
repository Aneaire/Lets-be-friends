import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { expect, fn, userEvent, within } from 'storybook/test'

import { FeaturedCommentPreview, type FeaturedComment } from './FeaturedCommentPreview'

const openThread = fn()

const featuredComment: FeaturedComment = {
  _id: 'comment-one',
  authorId: 'user-two',
  authorDisplayName: 'Alex Rivera',
  authorProfileImageUrl: undefined,
  body: 'The library cafe is quiet on weekday mornings and easy to reach by transit.',
  mentions: [],
  threadInteractionCount: 6,
} as unknown as FeaturedComment

const meta = {
  title: 'Mobile/Organisms/Featured comment preview',
  component: FeaturedCommentPreview,
  globals: { viewport: { value: 'mobileSmall', isRotated: false } },
  args: { comment: featuredComment, onOpenThread: openThread },
} satisfies Meta<typeof FeaturedCommentPreview>

export default meta
type Story = StoryObj<typeof meta>

export const MostDiscussed: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Most discussed')).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: /See the conversation \(6 interactions\)/ }))
    await expect(openThread).toHaveBeenCalledTimes(1)
  },
}

export const LongAuthorAt320: Story = {
  args: {
    comment: {
      ...featuredComment,
      authorDisplayName: 'María Alexandra de la Cruz-Santos',
      threadInteractionCount: 1,
    } as FeaturedComment,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('button', { name: /See the conversation \(1 interaction\)/ })).toBeVisible()
    await expect(canvasElement.scrollWidth).toBeLessThanOrEqual(canvasElement.clientWidth)
  },
}
