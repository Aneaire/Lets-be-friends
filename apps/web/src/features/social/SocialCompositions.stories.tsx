import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { useMemo, useRef, useState, type ReactNode } from 'react'
import { RouterProvider, createMemoryHistory, createRootRoute, createRoute, createRouter } from '@tanstack/react-router'

import { PostActionBar } from './PostActionBar'
import { PostCard } from './PostCard'
import { PollCard, type PollView } from './PollCard'
import { PostMediaGrid, type DisplayPostMediaItem } from './PostMediaGrid'
import { FeaturedComment, type FeaturedCommentView } from './FeaturedComment'
import { SharedPostEmbed, SharedReviewEmbed, type SharedPostView, type SharedReviewView } from './SharedEmbeds'
import { ProfileContentPanel, type ProfileContentPost, type ProfileContentReview } from '../profile/ProfileContentPanel'

const storyPaths = ['/profile', '/member-profile', '/companion-profile', '/social', '/discover']

function StoryRouter({ children }: { children: ReactNode }) {
  const childrenRef = useRef(children)
  childrenRef.current = children
  const router = useMemo(() => {
    const rootRoute = createRootRoute({ component: () => <>{childrenRef.current}</> })
    const routeTree = rootRoute.addChildren([
      createRoute({ getParentRoute: () => rootRoute, path: '/' }),
      ...storyPaths.map((path) => createRoute({ getParentRoute: () => rootRoute, path })),
    ])
    return createRouter({ routeTree, history: createMemoryHistory({ initialEntries: ['/'] }) })
  }, [])
  return <RouterProvider router={router} />
}

const ownerImageUrl = '/images/marketing/public-cafe-meetup-768.webp'

const photoMedia: DisplayPostMediaItem[] = [
  { storageId: 'photography-walk', kind: 'image', url: '/images/marketing/photography-walk-768.webp' },
  { storageId: 'public-cafe-meetup', kind: 'image', url: '/images/marketing/public-cafe-meetup-768.webp' },
]

const profilePosts: ProfileContentPost[] = [
  {
    _id: 'post-1',
    body: 'Looking for someone to practice conversational English with this weekend.',
    createdAt: Date.UTC(2026, 7, 23, 8, 13),
    media: photoMedia,
    likeCount: 3,
    commentCount: 2,
    liked: false,
    saved: false,
  },
  {
    _id: 'post-2',
    createdAt: Date.UTC(2026, 7, 22, 8, 13),
    media: [photoMedia[0]],
    likeCount: 1,
    commentCount: 0,
    liked: true,
    saved: false,
  },
]

const profileReviews: ProfileContentReview[] = [
  {
    _id: 'review-1',
    body: 'The photo walk was comfortable and easy to follow.',
    createdAt: Date.UTC(2026, 7, 19, 14, 13),
    rating: 5,
    reviewerId: 'user-angelo',
    reviewerDisplayName: 'Angelo Santiago',
    reviewerProfileImageUrl: null,
    companionDisplayName: 'Mara Reyes',
    likeCount: 2,
    liked: false,
    commentCount: 1,
    comments: [
      {
        _id: 'comment-1',
        body: 'This sounds like a thoughtful plan.',
        createdAt: Date.UTC(2026, 7, 20, 14, 13),
        authorDisplayName: 'Alex Rivera',
        ownComment: false,
      },
    ],
    saved: false,
  },
]

const sharedPost: SharedPostView = {
  authorId: 'user-original',
  authorDisplayName: 'Gelo Santiago',
  authorProfileImageUrl: null,
  ownPost: false,
  createdAt: Date.UTC(2026, 7, 20, 8, 10),
  body: 'A few moments from our relaxed Saturday meetup.',
  media: photoMedia,
}

const sharedReview: SharedReviewView = {
  reviewerId: 'user-angelo',
  reviewerDisplayName: 'Angelo Santiago',
  reviewerProfileImageUrl: null,
  companionDisplayName: 'Mara Reyes',
  rating: 5,
  body: 'The photo walk was comfortable and easy to follow.',
  imageUrl: '/images/marketing/cook-together-768.webp',
}

const featuredComment: FeaturedCommentView = {
  authorId: 'user-alex',
  authorDisplayName: 'Alex Rivera',
  authorProfileImageUrl: null,
  ownComment: false,
  body: 'This sounds like a thoughtful plan.',
  threadInteractionCount: 6,
  createdAt: Date.UTC(2026, 7, 20, 14, 13),
  updatedAt: Date.UTC(2026, 7, 20, 14, 13),
}

const longBody = [
  'I have been hoping to find a regular walking partner for the quiet mornings along the river.',
  'It does not need to be anything structured. I mostly want steady company, an easy pace, and time to talk about what is going on in our weeks.',
  'If you prefer a different time of day, coffee and a loop around the park works just as well. I am happy to adapt to what feels comfortable for both of us.',
].join('\n\n')

function PostComposition({
  body,
  media,
  poll,
  shared,
  featured,
}: {
  body?: string
  media?: DisplayPostMediaItem[]
  poll?: boolean
  shared?: boolean
  featured?: boolean
}) {
  const [pollView, setPollView] = useState<PollView>({
    question: 'What should our next meetup include?',
    options: [
      { id: 'walk', label: 'A quiet photo walk', voteCount: 4, percentage: 57 },
      { id: 'coffee', label: 'Coffee and conversation', voteCount: 3, percentage: 43 },
    ],
    totalVotes: 7,
    closed: false,
  })

  return (
    <div className="social-story-timeline">
      <PostCard
        author="Maya Santos"
        imageUrl={ownerImageUrl}
        timestamp="Aug 23, 4:15 PM"
        dateTime="2026-08-23T08:15:00.000Z"
      >
        {body ? <p className="ds-post-copy">{body}</p> : null}
        {media?.length ? <PostMediaGrid media={media} /> : null}
        {poll ? (
          <PollCard
            poll={pollView}
            onVote={async (optionId) => {
              setPollView((current) => ({
                ...current,
                votedOptionId: optionId,
                options: current.options.map((option) => (
                  option.id === optionId ? { ...option, voteCount: option.voteCount + 1 } : option
                )),
                totalVotes: current.totalVotes + 1,
              }))
            }}
          />
        ) : null}
        {shared ? (
          <>
            <SharedPostEmbed post={sharedPost} />
            <SharedReviewEmbed review={sharedReview} />
          </>
        ) : null}
        {featured ? <FeaturedComment comment={featuredComment} onOpenThread={fn()} /> : null}
        <PostActionBar
          liked={false}
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
    </div>
  )
}

function ProfileComposition({ interactive = true }: { interactive?: boolean }) {
  return (
    <div className="social-story-timeline">
      <ProfileContentPanel
        ownerName="Mara Reyes"
        ownerImageUrl={ownerImageUrl}
        posts={profilePosts}
        reviews={profileReviews}
        rating={4.9}
        reviewCount={21}
        onLikePost={interactive ? fn() : undefined}
        onSavePost={interactive ? fn() : undefined}
        onOpenPostComments={interactive ? fn() : undefined}
        onLikeReview={interactive ? fn() : undefined}
        onCommentReview={interactive ? fn() : undefined}
        onShareReviewToFeed={interactive ? fn() : undefined}
        reviewAction={() => <button type="button" className="btn btn-neutral btn-sm">Save rating</button>}
      />
    </div>
  )
}

const mobileSmall = { value: 'mobileSmall', isRotated: false }
const mobileDefault = { value: 'mobileDefault', isRotated: false }

const meta = {
  title: 'Web/Organisms/Social compositions',
  decorators: [
    (Story) => (
      <StoryRouter>
        <Story />
      </StoryRouter>
    ),
  ],
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

export const ProfileLight320: Story = {
  globals: { theme: 'light', viewport: mobileSmall },
  render: () => <ProfileComposition />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const card = canvasElement.querySelector('.profile-post-list .profile-post-card')
    await expect(card?.classList.contains('ds-post-card')).toBe(true)
    await expect(canvas.getByText('Looking for someone to practice conversational English with this weekend.')).toBeVisible()
    await userEvent.click(canvas.getByRole('tab', { name: 'Reviews' }))
    await expect(canvas.getByText('Angelo Santiago')).toBeVisible()
    await expect(canvas.getByLabelText('5 out of 5 stars')).toBeVisible()
  },
}

export const ProfileDark390: Story = {
  globals: { theme: 'dark', viewport: mobileDefault },
  render: () => <ProfileComposition />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('tablist', { name: 'Mara Reyes profile content' })).toBeTruthy()
    await expect(canvas.getByText('Looking for someone to practice conversational English with this weekend.')).toBeVisible()
  },
}

export const PostMediaOnly320Light: Story = {
  globals: { theme: 'light', viewport: mobileSmall },
  render: () => <PostComposition media={photoMedia} />,
}

export const PostMediaOnly390Dark: Story = {
  globals: { theme: 'dark', viewport: mobileDefault },
  render: () => <PostComposition media={[photoMedia[0]]} />,
}

export const PostSharedEmbeds320Light: Story = {
  globals: { theme: 'light', viewport: mobileSmall },
  render: () => <PostComposition body="Sharing this because it made my week easier." shared />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('article', { name: 'Shared post by Gelo Santiago' })).toBeVisible()
    await expect(canvas.getByRole('article', { name: 'Shared review by Angelo Santiago' })).toBeVisible()
  },
}

export const PostSharedEmbeds390Dark: Story = {
  globals: { theme: 'dark', viewport: mobileDefault },
  render: () => <PostComposition body="Sharing this because it made my week easier." shared />,
}

export const PostPoll320Light: Story = {
  globals: { theme: 'light', viewport: mobileSmall },
  render: () => <PostComposition body="Help me choose what feels easiest for everyone." poll />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('radio', { name: /Coffee and conversation/ }))
    await userEvent.click(canvas.getByRole('button', { name: 'Vote' }))
    await expect(canvas.getByText('Your vote is in. Results stay live.')).toBeVisible()
  },
}

export const PostLongContent320Light: Story = {
  globals: { theme: 'light', viewport: mobileSmall },
  render: () => <PostComposition body={longBody} />,
}

export const PostLongContent390Dark: Story = {
  globals: { theme: 'dark', viewport: mobileDefault },
  render: () => <PostComposition body={longBody} media={[photoMedia[1]]} />,
}

export const PostFeaturedDiscussion320Light: Story = {
  globals: { theme: 'light', viewport: mobileSmall },
  render: () => <PostComposition body="A relaxed Saturday plan for anyone who wants to join." featured />,
}
