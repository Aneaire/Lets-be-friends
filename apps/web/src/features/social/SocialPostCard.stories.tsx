import type { Meta, StoryObj } from '@storybook/react-vite'
import { RouterProvider, createMemoryHistory, createRootRoute, createRoute, createRouter } from '@tanstack/react-router'
import { useMemo, useRef, type ReactNode } from 'react'
import { expect, fn, userEvent, within } from 'storybook/test'

import { SocialPostCard, type SocialPostView } from './SocialPostCard'

const storyPaths = ['/profile', '/member-profile', '/companion-profile', '/social']

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

const memberPost: SocialPostView = {
  _id: 'post-member',
  authorId: 'user-niko',
  authorDisplayName: 'Niko Santiago',
  authorProfileImageUrl: '/images/marketing/public-cafe-meetup-768.webp',
  body: 'Looking for someone to practice conversational English with this weekend.',
  createdAt: Date.UTC(2026, 9, 12, 13, 26),
  media: [],
  liked: false,
  likeCount: 3,
  commentCount: 1,
  saved: false,
}

const ownPost: SocialPostView = {
  ...memberPost,
  _id: 'post-owner',
  authorId: 'user-owner',
  authorDisplayName: 'Mara Reyes',
  ownPost: true,
  body: 'The photo walk last Saturday was a comfortable way to meet new people.',
  liked: true,
  likeCount: 5,
}

const meta = {
  title: 'Web/Organisms/Social post card',
  globals: { viewport: { value: 'desktop', isRotated: false } },
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

export const MemberPost: Story = {
  render: () => (
    <StoryRouter>
      <div className="social-feed">
        <SocialPostCard
          post={memberPost}
          viewerReady
          onToggleComments={fn()}
          onLike={fn()}
          onSave={fn()}
          onReport={fn()}
          onShareToFeed={fn()}
        />
      </div>
    </StoryRouter>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Post options' }))
    await expect(canvas.getByRole('menuitem', { name: 'Report post' })).toBeVisible()
    await expect(canvas.getByRole('button', { name: 'Share post' })).toBeVisible()
  },
}

export const OwnerPost: Story = {
  render: () => (
    <StoryRouter>
      <div className="social-feed">
        <SocialPostCard
          post={ownPost}
          viewerReady
          onToggleComments={fn()}
          onLike={fn()}
          onSave={fn()}
          onEdit={fn()}
          onDelete={fn()}
          onShareToFeed={fn()}
        />
      </div>
    </StoryRouter>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Post options' }))
    await expect(canvas.getByRole('menuitem', { name: 'Edit post' })).toBeVisible()
    await expect(canvas.getByRole('menuitem', { name: 'Delete post' })).toBeVisible()
  },
}
