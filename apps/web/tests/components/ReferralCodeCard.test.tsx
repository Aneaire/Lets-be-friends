// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ReferralCodeCard } from '../../src/features/referral/ReferralCodeCard'

afterEach(cleanup)

describe('referral code card', () => {
  it('normalizes and submits a valid code', () => {
    const onSubmit = vi.fn()
    render(<ReferralCodeCard busy={false} error="" notice="" onSubmit={onSubmit} onSkip={vi.fn()} />)

    fireEvent.change(screen.getByLabelText(/Referral code/), { target: { value: 'ab-cd12' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add referral code' }))

    expect(onSubmit).toHaveBeenCalledWith('ABCD12')
  })

  it('shows a validation message and does not submit a short code', () => {
    const onSubmit = vi.fn()
    render(<ReferralCodeCard busy={false} error="" notice="" onSubmit={onSubmit} onSkip={vi.fn()} />)

    fireEvent.change(screen.getByLabelText(/Referral code/), { target: { value: 'AB' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add referral code' }))

    expect(onSubmit).not.toHaveBeenCalled()
    expect(screen.getByRole('alert').textContent).toContain('at least 6')
  })

  it('offers a one-time skip', () => {
    const onSkip = vi.fn()
    render(<ReferralCodeCard busy={false} error="" notice="" onSubmit={vi.fn()} onSkip={onSkip} />)

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }))

    expect(onSkip).toHaveBeenCalledTimes(1)
  })

  it('shows a server error', () => {
    render(<ReferralCodeCard busy={false} error="That referral code was not found." notice="" onSubmit={vi.fn()} onSkip={vi.fn()} />)

    expect(screen.getByRole('alert').textContent).toContain('That referral code was not found.')
  })
})
