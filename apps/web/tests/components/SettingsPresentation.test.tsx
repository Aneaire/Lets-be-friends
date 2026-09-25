// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { SettingsLinkRow, SettingsSection } from '../../src/features/presentation/SettingsPresentation'

afterEach(cleanup)

describe('settings presentation', () => {
  it('labels each settings section by its heading', () => {
    render(
      <SettingsSection headingId="account-heading" title="Account" description="Keep personal details separate.">
        <p>Account body</p>
      </SettingsSection>,
    )

    const section = screen.getByRole('region', { name: 'Account' })
    expect(section.querySelector('h2')?.id).toBe('account-heading')
    expect(screen.getByText('Keep personal details separate.')).toBeTruthy()
    expect(screen.getByText('Account body')).toBeTruthy()
  })

  it('decorates the typed link element with the row layout and copy', () => {
    render(
      <SettingsLinkRow
        link={<a href="/become-companion?edit=true" />}
        icon={<span aria-hidden="true">$</span>}
        title="Hourly rate"
        description="Rate changes go live right away."
        actionLabel="Change"
      />,
    )

    const link = screen.getByRole('link', { name: /Hourly rate/ })
    expect(link.getAttribute('href')).toBe('/become-companion?edit=true')
    expect(link.getAttribute('class')).toBe('settings-link-row')
    expect(screen.getByText('Rate changes go live right away.')).toBeTruthy()
    expect(screen.getByText('Change')).toBeTruthy()
  })
})
