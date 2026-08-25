// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { WorkspaceShell } from '../../src/design-system/templates/WorkspaceShell'

afterEach(cleanup)

describe('WorkspaceShell', () => {
  it('labels desktop and mobile navigation and exposes optional workspace regions', () => {
    const { container } = render(
      <WorkspaceShell
        title="Your bookings"
        variant="bookings"
        railLabel="Booking sections"
        rail={<a href="#open">Open requests</a>}
        mobileNavigation={<a href="#open">Open</a>}
        status={<span>Verified</span>}
        actions={<button type="button">Create booking</button>}
        toolbar={<button type="button">Active requests</button>}>
        <section>Booking list</section>
      </WorkspaceShell>,
    )

    expect(screen.getByRole('heading', { name: 'Your bookings' })).toBeTruthy()
    expect(screen.getByRole('complementary', { name: 'Booking sections' })).toBeTruthy()
    expect(screen.getByRole('navigation', { name: 'Booking sections' })).toBeTruthy()
    expect(screen.getByLabelText('Workspace tools')).toBeTruthy()
    const workspace = container.querySelector('.workspace')
    expect(workspace?.getAttribute('data-variant')).toBe('bookings')
    expect(workspace?.classList.contains('workspace-has-mobile-navigation')).toBe(true)
  })
})
