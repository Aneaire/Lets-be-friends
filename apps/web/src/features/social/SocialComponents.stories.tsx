import type { Meta, StoryObj } from '@storybook/react-vite'
import type { ReactNode } from 'react'
import { expect, fn, userEvent, within } from 'storybook/test'

import { CommentActionsMenu } from './CommentActionsMenu'
import { CommentBubble } from './CommentBubble'
import { PostActionBar } from './PostActionBar'
import { PostActionsMenu } from './PostActionsMenu'
import { PostCard } from './PostCard'

function SocialPost({ owner, author = 'Gelo Santiago' }: { owner: boolean; author?: string }) {
  return (
    <PostCard
      author={author}
      timestamp="Aug 14, 9:22 PM"
      dateTime="2026-08-14T13:22:00.000Z"
      actions={(
        <PostActionsMenu
          ownedByViewer={owner}
          onEdit={() => undefined}
          onDelete={() => undefined}
          onReport={() => undefined}
        />
      )}
    >
      <p className="ds-post-copy">
        Looking for someone to practice conversational English with this weekend.
      </p>
      <PostActionBar
        liked
        likeCount={3}
        commentCount={2}
        saved={false}
        commentsOpen={false}
        likeDisabled={false}
        showSave
        onLike={() => undefined}
        onToggleComments={() => undefined}
        onSave={() => undefined}
      />
    </PostCard>
  )
}

function SocialStoryTimeline({ children }: { children: ReactNode }) {
  return <div className="social-story-timeline">{children}</div>
}

const meta = {
  title: 'Web/Organisms/Social content',
  parameters: { viewport: { defaultViewport: 'mobileSmall' } },
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

export const ViewerPost: Story = {
  render: () => (
    <SocialStoryTimeline>
      <SocialPost owner={false} />
    </SocialStoryTimeline>
  ),
}

export const OwnerPost: Story = {
  render: () => (
    <SocialStoryTimeline>
      <SocialPost owner />
    </SocialStoryTimeline>
  ),
}

export const LongIdentityNarrow: Story = {
  render: () => (
    <SocialStoryTimeline>
      <SocialPost owner={false} author="María Alexandra de la Cruz-Santos" />
    </SocialStoryTimeline>
  ),
}

export const ViewerComment: Story = {
  render: () => (
    <SocialStoryTimeline>
      <CommentBubble
        author="Alex Rivera"
        timestamp="9:28 PM"
        dateTime="2026-08-14T13:28:00.000Z"
        actions={(
          <CommentActionsMenu
            ownedByViewer={false}
            onReport={fn()}
          />
        )}
      >
        I am available on Saturday morning.
      </CommentBubble>
    </SocialStoryTimeline>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(
      canvas.getByRole('button', { name: 'Comment options' }),
    )
    await expect(
      canvas.getByRole('menuitem', { name: 'Report comment' }),
    ).toBeVisible()
    await expect(
      canvas.queryByRole('menuitem', { name: 'Edit comment' }),
    ).not.toBeInTheDocument()
  },
}

export const EditedOwnerComment: Story = {
  render: () => (
    <SocialStoryTimeline>
      <CommentBubble
        author="Gelo Santiago"
        timestamp="9:28 PM"
        dateTime="2026-08-14T13:28:00.000Z"
        edited
        actions={(
          <CommentActionsMenu
            ownedByViewer
            onEdit={fn()}
          />
        )}
      >
        Saturday morning works for me.
      </CommentBubble>
    </SocialStoryTimeline>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Edited')).toBeVisible()
    await userEvent.click(
      canvas.getByRole('button', { name: 'Comment options' }),
    )
    await expect(
      canvas.getByRole('menuitem', { name: 'Edit comment' }),
    ).toBeVisible()
    await expect(
      canvas.queryByRole('menuitem', { name: 'Report comment' }),
    ).not.toBeInTheDocument()
  },
}
