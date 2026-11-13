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

    fireEvent.click(screen.getByRole('button', { name: 'Not now' }))

    expect(onSkip).toHaveBeenCalledTimes(1)
  })

  it('shows a server error', () => {
    render(<ReferralCodeCard busy={false} error="That referral code was not found." notice="" onSubmit={vi.fn()} onSkip={vi.fn()} />)

    expect(screen.getByRole('alert').textContent).toContain('That referral code was not found.')
  })
})

it('shows a saved invitation instead of the entry form', () => {
  window.localStorage.setItem('lets-be-friends-referral-code', 'f9u29d5u')
  render(<ReferralCodeCard busy={false} error="" notice="" onSubmit={vi.fn()} onSkip={vi.fn()} />)
  expect(screen.getByText(/Invitation F9U29D5U will be added when you finish setup/)).toBeTruthy()
  expect(screen.queryByLabelText(/Referral code/)).toBeNull()
  window.localStorage.removeItem('lets-be-friends-referral-code')
})

it('removes a saved invitation and reports it', () => {
  window.localStorage.setItem('lets-be-friends-referral-code', 'F9U29D5U')
  const onRemoveSaved = vi.fn()
  render(<ReferralCodeCard busy={false} error="" notice="" onSubmit={vi.fn()} onSkip={vi.fn()} onRemoveSaved={onRemoveSaved} />)
  fireEvent.click(screen.getByRole('button', { name: 'Remove this code' }))
  expect(onRemoveSaved).toHaveBeenCalledTimes(1)
  expect(window.localStorage.getItem('lets-be-friends-referral-code')).toBeNull()
  expect(screen.getByLabelText(/Referral code/)).toBeTruthy()
})
