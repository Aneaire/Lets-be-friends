import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, within } from 'storybook/test'
import { useMemo, useRef, type ReactNode } from 'react'
import { RouterProvider, createMemoryHistory, createRootRoute, createRoute, createRouter } from '@tanstack/react-router'

import { SubmittedReviewView, type SubmittedReviewViewModel } from './SubmittedReviewView'

const storyPaths = ['/app', '/member-profile']

function StoryRouter({ children }: { children: ReactNode }) {
  const childrenRef = useRef(children)
  childrenRef.current = children
  const router = useMemo(() => {
    const rootRoute = createRootRoute({ component: () => <>{childrenRef.current}</> })
    const routeTree = rootRoute.addChildren(storyPaths.map((path) => createRoute({ getParentRoute: () => rootRoute, path })))
    return createRouter({ routeTree, history: createMemoryHistory({ initialEntries: ['/'] }) })
  }, [])
  return <RouterProvider router={router} />
}

const review: SubmittedReviewViewModel = {
  _id: 'review_story',
  reviewerId: 'member_story',
  reviewerDisplayName: 'Gelo Santiago',
  reviewerProfileImageUrl: '/images/marketing/public-cafe-meetup-768.webp',
  createdAt: Date.UTC(2026, 9, 21, 4, 13),
  rating: 5,
  body: 'This guy is awesome, will book again next time.',
  imageUrl: '/images/marketing/photography-walk-768.webp',
  imageUrls: ['/images/marketing/photography-walk-768.webp'],
  companionDisplayName: 'Angelo Santiago',
  likeCount: 3,
  liked: false,
  commentCount: 1,
  comments: [
    {
      _id: 'comment_story',
      body: 'Glad the walk went well.',
      authorDisplayName: 'Rina Cruz',
      ownComment: false,
    },
  ],
}

const meta = {
  title: 'Features/Review/Submitted review page',
  component: SubmittedReviewView,
  parameters: { layout: 'fullscreen' },
  globals: { viewport: { value: 'desktop', isRotated: false } },
  decorators: [(Story) => <StoryRouter><Story /></StoryRouter>],
  args: {
    review,
    onLike: fn(async () => undefined),
    onCreateComment: fn(async () => undefined),
    onDeleteComment: fn(async () => undefined),
  },
} satisfies Meta<typeof SubmittedReviewView>

export default meta
type Story = StoryObj<typeof meta>

export const WithPhoto: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Gelo Santiago')).toBeVisible()
    await expect(canvas.getByText('This guy is awesome, will book again next time.')).toBeVisible()
    await expect(canvas.getByText('Experience with Angelo Santiago')).toBeVisible()
    await expect(canvas.getByRole('img', { name: 'Photo shared with your review' })).toBeVisible()
    await expect(canvas.getByRole('link', { name: 'View Gelo Santiago\'s profile' })).toBeVisible()
  },
}

export const WithoutPhoto: Story = {
  args: {
    review: {
      ...review,
      imageUrl: null,
      imageUrls: [],
      body: undefined,
      commentCount: 0,
      comments: [],
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('No comments yet.')).toBeVisible()
    await expect(canvas.queryByRole('img', { name: 'Photo shared with your review' })).toBeNull()
  },
}

export const CompanionReviewOfMember: Story = {
  args: {
    review: {
      ...review,
      companionDisplayName: undefined,
      revieweeDisplayName: 'Sam Rivera',
      imageUrl: null,
      imageUrls: [],
    },
  },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('Review of Sam Rivera')).toBeVisible()
  },
}
