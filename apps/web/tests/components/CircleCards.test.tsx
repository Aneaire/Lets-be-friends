// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { CircleCard, CircleHomeCard, type CircleCardView } from '../../src/features/presentation/CircleCards'

afterEach(cleanup)

const joinedOpen: CircleCardView = {
  name: 'Sunday Coffee Friends',
  mode: 'in_person',
  purpose: 'A relaxed weekly coffee walk.',
  category: 'Coffee',
  memberCount: 12,
  approximateArea: 'Cebu City',
  membershipState: 'active',
  circleState: 'active',
  role: 'member',
  joinPolicy: 'open',
}

describe('circle card presentation', () => {
  it('decorates the typed link element and shows joined, open-join, and meta facts', () => {
    render(<CircleCard link={<a href="/circles/sunday" />} circle={joinedOpen} />)

    const link = screen.getByRole('link')
    expect(link.getAttribute('href')).toBe('/circles/sunday')
    expect(link.getAttribute('class')).toBe('circle-index-row')
    expect(screen.getByRole('img', { name: 'In person, joined' })).toBeTruthy()
    expect(screen.getByText('Sunday Coffee Friends')).toBeTruthy()
    expect(screen.getByText('A relaxed weekly coffee walk.')).toBeTruthy()
    expect(screen.getByText('12 members')).toBeTruthy()
    expect(screen.getByText('Cebu City')).toBeTruthy()
    expect(screen.getByText('Coffee')).toBeTruthy()
    expect(screen.getByText('Open join')).toBeTruthy()
  })

  it('shows a host role pill and an archived pill, and no role pill for ordinary members', () => {
    render(<CircleCard link={<a href="/circles/garden" />} circle={{ ...joinedOpen, role: 'host', circleState: 'archived', joinPolicy: 'approval_required' }} />)
    expect(screen.getByText('host')).toBeTruthy()
    expect(screen.getByText('Archived')).toBeTruthy()
    expect(screen.queryByText('Open join')).toBeNull()

    cleanup()
    render(<CircleCard link={<a href="/circles/plain" />} circle={{ ...joinedOpen, role: 'member', circleState: 'active', joinPolicy: 'approval_required' }} />)
    expect(screen.queryByText('member')).toBeNull()
    expect(screen.queryByText('Archived')).toBeNull()
  })

  it('falls back to a location label when no approximate area is shared', () => {
    cleanup()
    render(<CircleCard link={<a href="/circles/online" />} circle={{ ...joinedOpen, mode: 'online', approximateArea: undefined, membershipState: null }} />)
    expect(screen.getByText('Online')).toBeTruthy()
    expect(screen.getByRole('img', { name: 'Online' })).toBeTruthy()

    cleanup()
    render(<CircleCard link={<a href="/circles/local" />} circle={{ ...joinedOpen, mode: 'in_person', approximateArea: undefined }} />)
    expect(screen.getByText('Area shared in Circle')).toBeTruthy()
  })

  it('renders the compact home card with its member count while keeping the link', () => {
    render(<CircleHomeCard link={<a href="/circles/sunday" />} circle={joinedOpen} />)

    const link = screen.getByRole('link', { name: /Sunday Coffee Friends/ })
    expect(link.getAttribute('href')).toBe('/circles/sunday')
    expect(screen.getByText('12 members')).toBeTruthy()
    expect(link.querySelector('.circle-marker')).toBeTruthy()
  })

  it('shows the brand logo when a Circle has no icon and the icon image when it does', () => {
    render(<CircleCard link={<a href="/circles/no-icon" />} circle={{ ...joinedOpen, iconUrl: undefined }} />)

    const logo = screen.getByRole('link').querySelector<HTMLImageElement>('.circle-marker-logo')
    expect(logo).toBeTruthy()
    expect(logo?.getAttribute('src')).toBe('/logo.svg')

    cleanup()
    render(<CircleCard link={<a href="/circles/with-icon" />} circle={{ ...joinedOpen, iconUrl: 'https://example.com/icon.png' }} />)

    const link = screen.getByRole('link')
    expect(link.querySelector<HTMLImageElement>('.circle-icon')?.getAttribute('src')).toBe('https://example.com/icon.png')
    expect(link.querySelector('.circle-marker')).toBeNull()
  })
})
