// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const circleState = vi.hoisted(() => ({
  mine: undefined as unknown,
}))

vi.mock('convex/react', () => ({
  useQuery: () => circleState.mine,
  useMutation: () => vi.fn(),
  usePaginatedQuery: () => ({ results: [], status: 'Exhausted', loadMore: vi.fn() }),
}))

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    to,
    params,
    hash,
    className,
  }: {
    children: React.ReactNode
    to?: string
    params?: Record<string, string>
    hash?: string
    className?: string
  }) => (
    <a
      href={`${to ?? '#'}${params?.circleId ? `/${params.circleId}` : ''}${hash ? `#${hash}` : ''}`}
      className={className}
    >
      {children}
    </a>
  ),
}))

import {
  CurrentCircleRailCard,
  selectCurrentCircles,
  type RailCircle,
} from '../../src/features/circles/CurrentCircleRailCard'

function buildCircle(partial: Partial<RailCircle> & { _id: string; name: string }): RailCircle {
  return {
    purpose: `${partial.name} purpose`,
    category: 'Coffee',
    mode: 'online',
    memberCount: 12,
    membershipState: 'active',
    role: 'member',
    ...partial,
  }
}

afterEach(() => {
  cleanup()
  circleState.mine = undefined
})

describe('CurrentCircleRailCard shows the current circle on top', () => {
  it('keeps backend order so the most recent Circle stays on top', () => {
    const mine = [
      buildCircle({ _id: 'recent', name: 'Recent Circle' }),
      buildCircle({ _id: 'older', name: 'Older Circle' }),
    ]

    const selected = selectCurrentCircles(mine)

    expect(selected.top?.name).toBe('Recent Circle')
    expect(selected.rest.map((circle) => circle.name)).toEqual(['Older Circle'])
    expect(selected.totalActive).toBe(2)
  })

  it('hides memberships that are not active', () => {
    const mine = [
      buildCircle({ _id: 'pending', name: 'Pending Circle', membershipState: 'pending' }),
      buildCircle({ _id: 'active', name: 'Active Circle' }),
    ]

    const selected = selectCurrentCircles(mine)

    expect(selected.top?.name).toBe('Active Circle')
    expect(selected.totalActive).toBe(1)
  })

  it('shows a loading state while circles load', () => {
    circleState.mine = undefined
    render(<CurrentCircleRailCard />)

    expect(screen.getByText('Loading your circles...')).toBeTruthy()
  })

  it('invites users without circles to discover them', () => {
    circleState.mine = []
    render(<CurrentCircleRailCard />)

    expect(screen.getByText('Your current circle')).toBeTruthy()
    expect(screen.getByText('Discover circles')).toBeTruthy()
    expect(screen.queryByLabelText(/Open /)).toBeNull()
  })

  it('opens the top Circle first and lists up to three more below', () => {
    circleState.mine = [
      buildCircle({ _id: 'one', name: 'Cebu Coffee Friends', role: 'host' }),
      buildCircle({ _id: 'two', name: 'Weekend Walkers' }),
      buildCircle({ _id: 'three', name: 'Board Game Night' }),
    ]
    const { container } = render(<CurrentCircleRailCard />)

    expect(screen.getByText('Your current circle')).toBeTruthy()
    const heroLink = container.querySelector('a[href*="/one"]')
    expect(heroLink?.textContent).toContain('Cebu Coffee Friends')
    expect(screen.getByText('Weekend Walkers')).toBeTruthy()
    expect(screen.getByText('Board Game Night')).toBeTruthy()
    expect(screen.getByText('See all circles')).toBeTruthy()
  })

  it('marks muted circles without hiding them', () => {
    circleState.mine = [buildCircle({ _id: 'one', name: 'Quiet Circle', muted: true })]
    render(<CurrentCircleRailCard />)

    expect(screen.getByText(/Muted/)).toBeTruthy()
  })

  it('collapses and reopens when the card header is clicked', () => {
    circleState.mine = [buildCircle({ _id: 'one', name: 'Cebu Coffee Friends' })]
    render(<CurrentCircleRailCard />)

    fireEvent.click(screen.getByText('Your current circle'))
    expect(screen.queryByText('Cebu Coffee Friends')).toBeNull()
    fireEvent.click(screen.getByText('Your current circle'))
    expect(screen.getByText('Cebu Coffee Friends')).toBeTruthy()
  })

  it('contains no em dashes in user facing copy', () => {
    circleState.mine = [buildCircle({ _id: 'one', name: 'Cebu Coffee Friends' })]
    const { container } = render(<CurrentCircleRailCard />)

    expect(container.textContent).not.toContain('—')
    expect(container.textContent).not.toContain('–')
  })
})
