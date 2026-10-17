import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { useMemo, useRef, type ReactNode } from 'react'
import { RouterProvider, createMemoryHistory, createRootRoute, createRoute, createRouter } from '@tanstack/react-router'

import { VerifiedCelebration } from './VerifiedPage'

const storyPaths = ['/discover', '/app', '/safety', '/profile', '/become-companion', '/get-verified']

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

const meta = {
  title: 'Features/Verification/Verified celebration',
  component: VerifiedCelebration,
  parameters: { layout: 'fullscreen' },
  globals: { viewport: { value: 'desktop', isRotated: false } },
  render: () => (
    <StoryRouter>
      <main className="verified-page">
        <VerifiedCelebration />
      </main>
    </StoryRouter>
  ),
} satisfies Meta<typeof VerifiedCelebration>

export default meta
type Story = StoryObj<typeof meta>

export const ApprovedMember: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('heading', { name: 'You are verified. Start making friends.' })).toBeVisible()
    await expect(
      canvas.getByAltText('Two people who just met greeting each other warmly over coffee in a bright public cafe'),
    ).toBeVisible()
    await expect(canvas.getByRole('heading', { name: 'Three easy ways to begin' })).toBeVisible()
    const exploreLinks = canvas.getAllByRole('link', { name: /Explore people/ })
    await expect(exploreLinks[0]).toHaveAttribute('href', '/discover')
    await expect(canvas.getByRole('link', { name: /How safety works/ })).toHaveAttribute('href', '/safety')
  },
}

export const MobileApprovedMember: Story = {
  globals: { viewport: { value: 'mobileDefault', isRotated: false } },
}
