// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    to,
    hash,
    className,
  }: {
    children: React.ReactNode
    to?: string
    hash?: string
    className?: string
  }) => (
    <a href={`${to ?? '#'}${hash ? `#${hash}` : ''}`} className={className}>
      {children}
    </a>
  ),
}))

import {
  CheckinsCard,
  FriendayHowItWorksRail,
  FriendayMobileSummary,
  FriendaySafetyRail,
  SafetyCard,
  StartCard,
  StepsCard,
  friendayCheckins,
  friendayPromise,
  friendaySteps,
} from '../../src/features/social/FriendayGuide'

afterEach(() => {
  cleanup()
})

describe('Frienday clickable cards fill the Home feed side space', () => {
  it('shows icon led cards instead of a wall of text', () => {
    render(<FriendayHowItWorksRail />)

    expect(screen.getByText('What is a Frienday')).toBeTruthy()
    expect(screen.getByText('How a Frienday works')).toBeTruthy()
    expect(screen.getByText('Three Friend Selfies')).toBeTruthy()
    for (const step of friendaySteps.slice(0, 2)) {
      expect(screen.getByText(step.title)).toBeTruthy()
    }
    expect(screen.queryByText('Chat and agree in writing')).toBeNull()
    expect(friendaySteps).toHaveLength(9)
  })

  it('opens and closes when the card header is clicked', () => {
    render(<StepsCard defaultOpen={false} />)

    expect(screen.queryByText('Set up your profile')).toBeNull()
    fireEvent.click(screen.getByText('How a Frienday works'))
    expect(screen.getByText('Set up your profile')).toBeTruthy()
    fireEvent.click(screen.getByText('How a Frienday works'))
    expect(screen.queryByText('Set up your profile')).toBeNull()
  })

  it('expands the nine steps on demand', () => {
    render(<StepsCard defaultOpen />)

    expect(screen.getByText('Set up your profile')).toBeTruthy()
    expect(screen.queryByText('Leave an honest review')).toBeNull()
    fireEvent.click(screen.getByText(/Show all 9 steps/))
    expect(screen.getByText('Leave an honest review')).toBeTruthy()
    fireEvent.click(screen.getByText('Show fewer steps'))
    expect(screen.queryByText('Leave an honest review')).toBeNull()
  })

  it('lets users tap check-in moments to see each purpose', () => {
    render(<CheckinsCard defaultOpen />)

    expect(screen.getByText('First Friend Selfie')).toBeTruthy()
    fireEvent.click(screen.getByText('Around the midpoint'))
    expect(screen.getByText('Second Friend Selfie')).toBeTruthy()
    expect(screen.getByText(/continuing as agreed/)).toBeTruthy()
    expect(friendayCheckins).toHaveLength(3)
  })

  it('switches safety moments with Before, During, and Emergency tabs', () => {
    render(<SafetyCard defaultOpen />)

    expect(screen.getByText('Before the Frienday')).toBeTruthy()
    fireEvent.click(screen.getByText('Emergency'))
    expect(screen.getByText('In an emergency')).toBeTruthy()
    expect(screen.getByText(/local emergency services/)).toBeTruthy()
    fireEvent.click(screen.getByText('During'))
    expect(screen.getByText('During the Frienday')).toBeTruthy()
  })

  it('keeps safety and start actions in the right rail', () => {
    render(<FriendaySafetyRail />)

    expect(screen.getByText('Frienday safety rules')).toBeTruthy()
    expect(screen.getByText('Ready for your next Frienday')).toBeTruthy()
    expect(screen.getByText('Create your Companion profile')).toBeTruthy()
    expect(screen.getByText('Find a Companion')).toBeTruthy()
    expect(screen.queryByText('Not allowed')).toBeNull()
    expect(friendayPromise.length).toBeGreaterThan(5)
  })

  it('uses booking intent for actions: profile setup stays self, discovery stays social', () => {
    const { container } = render(<StartCard defaultOpen />)

    const profileAction = container.querySelector('a[href="/become-companion"]')
    const discoveryAction = container.querySelector('a[href="/nearby"]')
    expect(profileAction?.className).toContain('btn-self')
    expect(discoveryAction?.className).toContain('btn-social')
  })

  it('gives small screens tappable cards that link to the full guide', () => {
    render(<FriendayMobileSummary />)

    expect(
      screen.getByText('How a Frienday works: 9 steps, 3 check-ins, safety rules'),
    ).toBeTruthy()
    fireEvent.click(screen.getByText('How a Frienday works: 9 steps, 3 check-ins, safety rules'))
    fireEvent.click(screen.getByText('How a Frienday works'))
    expect(screen.getByText('Set up your profile')).toBeTruthy()
    expect(screen.getByText('Read the full Frienday guide')).toBeTruthy()
  })

  it('contains no em dashes in user facing copy', () => {
    const { container } = render(
      <>
        <FriendayHowItWorksRail />
        <FriendaySafetyRail />
        <FriendayMobileSummary />
      </>,
    )

    expect(container.textContent).not.toContain('—')
    expect(container.textContent).not.toContain('–')
  })
})
