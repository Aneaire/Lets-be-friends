import type { Meta, StoryObj } from '@storybook/react-vite'
import type { ReactNode } from 'react'

import { CommentBubble } from './CommentBubble'
import { PostActionBar } from './PostActionBar'
import { PostActionsMenu } from './PostActionsMenu'
import { PostCard } from './PostCard'

function SocialPost({ owner }: { owner: boolean }) {
  return (
    <PostCard
      author="Gelo Santiago"
      timestamp="Aug 14, 9:22 PM"
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

export const Comment: Story = {
  render: () => (
    <SocialStoryTimeline>
      <CommentBubble
        author="Alex Rivera"
        timestamp="9:28 PM"
        actions={(
          <button type="button" className="ds-comment-action" aria-label="Report comment">
            Report
          </button>
        )}
      >
        I am available on Saturday morning.
      </CommentBubble>
    </SocialStoryTimeline>
  ),
}
