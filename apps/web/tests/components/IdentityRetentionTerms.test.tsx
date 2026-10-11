// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { IdentityRetentionTerms } from '../../src/features/identity/IdentityRetentionTerms'

afterEach(cleanup)

describe('identity retention terms', () => {
  it('explains ID image storage for safety and future transactions', () => {
    const { container } = render(<IdentityRetentionTerms />)

    expect(screen.getByText('ID image storage terms for safety and future transactions')).toBeTruthy()
    expect(screen.getByText(/What we store/)).toBeTruthy()
    expect(screen.getByText(/Why we store it/)).toBeTruthy()
    expect(screen.getByText(/up to 730 days/)).toBeTruthy()
    expect(screen.getByText(/Only authorized safety reviewers/)).toBeTruthy()
    expect(screen.getByText(/active report about/)).toBeTruthy()
    expect(screen.getByText(/legal hold may extend/)).toBeTruthy()
    expect(screen.getByText(/future booking reports/)).toBeTruthy()
  })

  it('uses respectful product language without em dashes', () => {
    const { container } = render(<IdentityRetentionTerms />)
    const copy = container.textContent ?? ''

    expect(copy).not.toContain('—')
    expect(copy).not.toContain('–')
    expect(copy).toMatch(/Companion/)
    expect(copy).toMatch(/member/)
  })
})
