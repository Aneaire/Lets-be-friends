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
  FriendayIdeas,
  FriendayMomentPhotoCard,
  WhatIsFriendayCard,
} from '../../src/features/social/FriendayGuide'

afterEach(() => {
  cleanup()
})

describe('Home imagery', () => {
  it('shows the cafe photo above the guide copy when the guide is open', () => {
    const { container } = render(<WhatIsFriendayCard defaultOpen />)

    const photo = screen.getByAltText(
      'Two people talking over coffee at a table in a bright public cafe',
    ) as HTMLImageElement
    expect(photo.getAttribute('src')).toContain('frienday-cafe-conversation-1024')
    expect(photo.getAttribute('srcset')).toContain('frienday-cafe-conversation-768.webp 768w')
    expect(photo.getAttribute('srcset')).toContain('frienday-cafe-conversation-1024.webp 1024w')
    expect(photo.getAttribute('loading')).toBe('lazy')
    expect(photo.getAttribute('decoding')).toBe('async')
    expect(photo.width).toBe(1024)
    expect(photo.height).toBe(768)

    const body = container.querySelector('.frienday-flip-body')
    expect(body).toBeTruthy()
    const imageIndex = Array.from(body?.children ?? []).findIndex((child) =>
      child.contains(photo),
    )
    const copyIndex = Array.from(body?.children ?? []).findIndex((child) =>
      child.textContent?.includes('agreed time when a Companion'),
    )
    expect(imageIndex).toBeGreaterThanOrEqual(0)
    expect(copyIndex).toBeGreaterThan(imageIndex)
  })

  it('collapses the guide and hides the cafe photo on header click', () => {
    render(<WhatIsFriendayCard defaultOpen />)

    expect(
      screen.getByAltText('Two people talking over coffee at a table in a bright public cafe'),
    ).toBeTruthy()
    fireEvent.click(screen.getByText('What is a Frienday'))
    expect(
      screen.queryByAltText('Two people talking over coffee at a table in a bright public cafe'),
    ).toBeNull()
    fireEvent.click(screen.getByText('What is a Frienday'))
    expect(
      screen.getByAltText('Two people talking over coffee at a table in a bright public cafe'),
    ).toBeTruthy()
  })

  it('keeps the existing picnic card unchanged', () => {
    render(<FriendayMomentPhotoCard />)

    const photo = screen.getByAltText(
      'Two Filipino friends smiling at each other over a picnic in a sunny public park',
    ) as HTMLImageElement
    expect(photo.getAttribute('src')).toContain('frienday-park-picnic-1024')
    expect(screen.getByText('Time together in a public place')).toBeTruthy()
  })

  it('shows two inspiration photos with one pink discovery link', () => {
    const { container } = render(<FriendayIdeas />)

    expect(screen.getByText('A little inspiration for your next Frienday')).toBeTruthy()
    expect(screen.getByText('A walk and a good conversation')).toBeTruthy()
    expect(screen.getByText('Good company, wherever you are')).toBeTruthy()

    const walk = screen.getByAltText(
      'Two people walking and talking together on a public path in daylight',
    ) as HTMLImageElement
    const online = screen.getByAltText(
      'A person smiling during a video call with a Companion on a laptop at home',
    ) as HTMLImageElement
    for (const photo of [walk, online]) {
      expect(photo.getAttribute('loading')).toBe('lazy')
      expect(photo.getAttribute('decoding')).toBe('async')
      expect(photo.width).toBe(1024)
      expect(photo.height).toBe(768)
      expect(photo.getAttribute('srcset')).toContain('768w')
      expect(photo.getAttribute('srcset')).toContain('1024w')
    }
    expect(walk.getAttribute('src')).toContain('frienday-public-walk-1024')
    expect(online.getAttribute('src')).toContain('frienday-online-session-1024')

    const links = Array.from(container.querySelectorAll('a[href="/nearby"]'))
    expect(links).toHaveLength(1)
    expect(links[0].textContent).toContain('Find a Companion')
    expect(links[0].className).toContain('btn-social')
  })

  it('contains no em dashes in user facing copy', () => {
    const { container } = render(
      <>
        <WhatIsFriendayCard defaultOpen />
        <FriendayIdeas />
        <FriendayMomentPhotoCard />
      </>,
    )

    expect(container.textContent).not.toContain('—')
    expect(container.textContent).not.toContain('–')
  })
})
