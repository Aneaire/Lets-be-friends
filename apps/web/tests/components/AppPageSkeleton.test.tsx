// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { AppPageSkeleton, BookingsViewSkeleton } from '../../src/features/booking/AppPageSkeleton'

afterEach(cleanup)

describe('AppPageSkeleton', () => {
  it('announces loading once and hides the visual placeholder from assistive technology', () => {
    const { container } = render(<AppPageSkeleton />)

    const status = screen.getByRole('status')
    expect(status.textContent).toMatch(/Loading your bookings/)
    expect(screen.getAllByRole('status')).toHaveLength(1)

    const hidden = container.querySelector('.app-page-skeleton > [aria-hidden="true"]')
    expect(hidden).toBeTruthy()
    expect(hidden?.contains(status)).toBe(false)
  })

  it('renders no actionable controls and no literal booking counts while loading', () => {
    const { container } = render(<AppPageSkeleton />)

    expect(container.querySelectorAll('button, a, [role="button"], [role="link"]')).toHaveLength(0)
    expect(container.textContent).not.toMatch(/0 active/)
    expect(container.textContent).not.toMatch(/Balance/)
  })

  it('matches the calendar and navigation geometry of the loaded workspace', () => {
    const { container } = render(<AppPageSkeleton />)

    expect(container.querySelector('.workspace')).toBeTruthy()
    expect(container.querySelectorAll('.booking-view-switch')).toHaveLength(2)
    expect(container.querySelector('.booking-calendar-grid')).toBeTruthy()
    expect(container.querySelectorAll('.booking-calendar-weekday')).toHaveLength(7)
    expect(container.querySelectorAll('.booking-calendar-day')).toHaveLength(42)
    expect(container.querySelectorAll('.rail-link').length).toBeGreaterThan(0)
    expect(container.querySelectorAll('.workspace-mobile-nav-link').length).toBeGreaterThan(0)
  })

  it('exports a reusable bookings placeholder without controls or literal counts', () => {
    const { container } = render(<BookingsViewSkeleton />)

    expect(container.querySelectorAll('button, a, [role="button"], [role="link"]')).toHaveLength(0)
    expect(container.querySelectorAll('.booking-calendar-day')).toHaveLength(42)
    expect(container.textContent).not.toMatch(/\d+\s+(active|bookings?)/i)
  })
})
