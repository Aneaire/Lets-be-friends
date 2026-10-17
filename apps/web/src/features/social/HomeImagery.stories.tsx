import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, waitFor, within } from 'storybook/test'
import { useMemo, useRef, type ReactNode } from 'react'
import { RouterProvider, createMemoryHistory, createRootRoute, createRoute, createRouter } from '@tanstack/react-router'

import { FriendayHowItWorksRail, FriendayIdeas, FriendayMobileSummary, FriendaySafetyRail } from './FriendayGuide'

const storyPaths = ['/nearby', '/safety', '/become-companion']

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

function HomeImageryComposition() {
  return (
    <main className="social-page social-page-with-rails">
      <aside className="frienday-rail" aria-label="Frienday guide">
        <FriendayHowItWorksRail />
      </aside>
      <section className="social-timeline" aria-label="Home feed">
        <header className="social-timeline-header">
          <div>
            <h1 className="text-h1">Home</h1>
            <p className="text-meta">Everyday help, useful ideas, and people worth connecting with.</p>
          </div>
        </header>
        <FriendayMobileSummary />
        <FriendayIdeas />
      </section>
      <aside className="frienday-rail" aria-label="Frienday safety">
        <FriendaySafetyRail />
      </aside>
    </main>
  )
}

async function expectHomeImagery(canvasElement: HTMLElement) {
  const canvas = within(canvasElement)
  await expect(canvas.getByText('A little inspiration for your next Frienday')).toBeVisible()
  await expect(
    canvas.getByAltText('Two people walking and talking together on a public path in daylight'),
  ).toBeVisible()
  await expect(
    canvas.getByAltText('A person smiling during a video call with a Companion on a laptop at home'),
  ).toBeVisible()
  await expect(canvas.getByRole('region', { name: 'A little inspiration for your next Frienday' })).toBeVisible()
  const ideas = within(canvas.getByRole('region', { name: 'A little inspiration for your next Frienday' }))
  await expect(ideas.getByRole('link', { name: 'Find a Companion' })).toHaveAttribute(
    'href',
    '/nearby',
  )
  for (const photo of ideas.getAllByRole('img') as HTMLImageElement[]) {
    await waitFor(() => expect(photo.complete && photo.naturalWidth > 0).toBe(true))
  }
  await expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth)
}

const meta = {
  title: 'Web/Organisms/Home imagery',
  decorators: [
    (Story) => (
      <StoryRouter>
        <Story />
      </StoryRouter>
    ),
  ],
  parameters: { layout: 'fullscreen' },
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

export const HomeDesktopLight: Story = {
  globals: { theme: 'light', viewport: { value: 'desktop', isRotated: false } },
  render: () => <HomeImageryComposition />,
  play: async ({ canvasElement }) => {
    await expectHomeImagery(canvasElement)
  },
}

export const HomeDesktopDark: Story = {
  globals: { theme: 'dark', viewport: { value: 'desktop', isRotated: false } },
  render: () => <HomeImageryComposition />,
  play: async ({ canvasElement }) => {
    await expectHomeImagery(canvasElement)
  },
}

export const Home320Light: Story = {
  globals: { theme: 'light', viewport: { value: 'mobileSmall', isRotated: false } },
  render: () => <HomeImageryComposition />,
  play: async ({ canvasElement }) => {
    await expectHomeImagery(canvasElement)
  },
}

export const Home390Dark: Story = {
  globals: { theme: 'dark', viewport: { value: 'mobileDefault', isRotated: false } },
  render: () => <HomeImageryComposition />,
  play: async ({ canvasElement }) => {
    await expectHomeImagery(canvasElement)
  },
}
