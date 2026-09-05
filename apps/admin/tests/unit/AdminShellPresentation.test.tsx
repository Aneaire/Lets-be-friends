// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { AdminShellPresentation } from '../../src/design-system/templates/AdminShellPresentation'

beforeEach(() => {
  vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: false }))
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('admin shell presentation', () => {
  it('keeps the active work area and account context visible', () => {
    render(
      <AdminShellPresentation
        viewerRole="admin"
        displayName="Morgan Lee"
        pathname="/reports"
        counts={{ reportsOpen: 4 }}
        userAppHref="/app"
        onSignOut={() => undefined}>
        <p>Report queue</p>
      </AdminShellPresentation>,
    )

    expect(screen.getByText('Review', { selector: '.admin-topbar-section' })).toBeTruthy()
    expect(screen.getByText('Reports', { selector: '.admin-topbar-title' })).toBeTruthy()
    expect(screen.getByText('ML', { selector: '.admin-account-avatar' })).toBeTruthy()
    expect(screen.getByRole('link', { name: /Reports/ }).getAttribute('aria-current')).toBe('page')
    expect(screen.getByRole('link', { name: 'Open user app' })).toBeTruthy()
  })

  it('keeps sign out available as a named action', () => {
    const onSignOut = vi.fn()
    render(
      <AdminShellPresentation
        viewerRole="reviewer"
        displayName="Sam Rivera"
        pathname="/overview"
        userAppHref="/app"
        onSignOut={onSignOut}>
        <p>Overview</p>
      </AdminShellPresentation>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }))
    expect(onSignOut).toHaveBeenCalledOnce()
  })
})
