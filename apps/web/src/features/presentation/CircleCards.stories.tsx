import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'

import { CircleCard, CircleHomeCard, type CircleCardView } from './CircleCards'

const joinedOpen: CircleCardView = {
  name: 'Sunday Coffee Friends',
  mode: 'in_person',
  purpose: 'A relaxed weekly coffee walk around the neighborhood.',
  category: 'Coffee',
  memberCount: 12,
  approximateArea: 'Cebu City',
  membershipState: 'active',
  circleState: 'active',
  role: 'member',
  joinPolicy: 'open',
}

const requestToJoin: CircleCardView = {
  name: 'Quiet Co-working Circle',
  mode: 'online',
  purpose: 'Silent focus sessions with a short check-in before and after.',
  category: 'Focus',
  memberCount: 8,
  approximateArea: 'Online',
  membershipState: null,
  circleState: 'active',
  role: null,
  joinPolicy: 'approval_required',
}

const hostedApproval: CircleCardView = {
  name: 'Neighborhood Garden Volunteers',
  mode: 'both',
  purpose: 'Plan planting days and share what is ready to harvest.',
  category: 'Outdoors',
  memberCount: 24,
  approximateArea: 'Bacolor',
  membershipState: 'active',
  circleState: 'active',
  role: 'host',
  joinPolicy: 'approval_required',
}

const archived: CircleCardView = {
  name: 'Holiday Craft Circle',
  mode: 'online',
  purpose: 'A seasonal circle that has paused new conversations.',
  category: 'Crafts',
  memberCount: 5,
  approximateArea: 'Online',
  membershipState: 'active',
  circleState: 'archived',
  role: 'member',
  joinPolicy: 'approval_required',
}

function CardList({ circles }: { circles: CircleCardView[] }) {
  return (
    <main className="circles-index-page">
      <div className="circle-index-list">
        {circles.map((circle) => (
          <CircleCard key={circle.name} link={<a href={`/circles/${encodeURIComponent(circle.name)}`} />} circle={circle} />
        ))}
      </div>
    </main>
  )
}

const meta = {
  title: 'Features/Circles/Circle cards',
  globals: { viewport: { value: 'desktop', isRotated: false } },
  parameters: { layout: 'fullscreen' },
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

export const JoinedOpen: Story = {
  render: () => <CardList circles={[joinedOpen]} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('img', { name: 'In person, joined' })).toBeVisible()
    await expect(canvas.getByText('Open join')).toBeVisible()
    await expect(canvas.getByText('12 members')).toBeVisible()
    await expect(canvas.getByRole('link')).toHaveAttribute('href', '/circles/Sunday%20Coffee%20Friends')
  },
}

export const RequestToJoin: Story = {
  render: () => <CardList circles={[requestToJoin]} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Quiet Co-working Circle')).toBeVisible()
    await expect(canvas.queryByText('Open join')).not.toBeInTheDocument()
    await expect(canvas.queryByText('Archived')).not.toBeInTheDocument()
  },
}

export const HostedAndArchived: Story = {
  render: () => <CardList circles={[hostedApproval, archived]} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('host')).toBeVisible()
    await expect(canvas.getByText('Archived')).toBeVisible()
  },
}

export const LongNameAt320: Story = {
  globals: { viewport: { value: 'mobileSmall', isRotated: false } },
  render: () => (
    <CardList
      circles={[{
        ...joinedOpen,
        name: 'A very long Circle name that keeps going with several descriptive words',
        purpose: 'A long purpose statement that should wrap instead of pushing the layout wider than a small phone viewport allows.',
      }]}
    />
  ),
  play: async ({ canvasElement }) => {
    await expect(canvasElement.scrollWidth).toBeLessThanOrEqual(canvasElement.clientWidth)
  },
}

export const HomeModuleCards: Story = {
  globals: { viewport: { value: 'mobileDefault', isRotated: false } },
  render: () => (
    <main className="circles-index-page">
      <section className="home-circles-module" aria-labelledby="story-home-circles-title">
        <div className="circle-section-heading"><h2 id="story-home-circles-title">My circles</h2><a href="/circles">See all</a></div>
        <div>
          <CircleHomeCard link={<a href="/circles/sunday-coffee" />} circle={joinedOpen} />
          <CircleHomeCard link={<a href="/circles/garden" />} circle={hostedApproval} />
        </div>
      </section>
    </main>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Sunday Coffee Friends')).toBeVisible()
    await expect(canvas.getByText('12 members')).toBeVisible()
    await expect(canvas.getByRole('link', { name: /Sunday Coffee Friends/ })).toHaveAttribute('href', '/circles/sunday-coffee')
  },
}

export const Dark: Story = {
  globals: { theme: 'dark', viewport: { value: 'desktop', isRotated: false } },
  render: () => <CardList circles={[joinedOpen, requestToJoin, hostedApproval, archived]} />,
}
