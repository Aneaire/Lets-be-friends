// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PollCard, type PollView } from '../../src/features/social/PollCard'

afterEach(cleanup)

const poll: PollView = {
  question: 'Do you watch the agent while it works?',
  options: [
    { id: 'option-1', label: 'Usually', voteCount: 25, percentage: 17 },
    { id: 'option-2', label: 'Occasionally', voteCount: 70, percentage: 47 },
    { id: 'option-3', label: 'Almost never', voteCount: 39, percentage: 26 },
  ],
  totalVotes: 148,
  closed: false,
}

describe('PollCard', () => {
  it('always shows live results and disables Vote until an option is selected', () => {
    render(<PollCard poll={poll} onVote={vi.fn()} />)

    expect(screen.getByText('Do you watch the agent while it works?')).toBeTruthy()
    expect(screen.getByText('148 votes')).toBeTruthy()
    expect(screen.getByText('17% (25)')).toBeTruthy()
    expect(screen.getByText('47% (70)')).toBeTruthy()

    const vote = screen.getByRole('button', { name: 'Vote' }) as HTMLButtonElement
    expect(vote.disabled).toBe(true)
    fireEvent.click(screen.getByRole('radio', { name: /Occasionally/ }))
    expect(vote.disabled).toBe(false)
  })

  it('casts the selected option and reports a rejected vote', async () => {
    const onVote = vi.fn().mockRejectedValue(new Error('This poll is closed'))
    render(<PollCard poll={poll} onVote={onVote} />)

    fireEvent.click(screen.getByRole('radio', { name: /Occasionally/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Vote' }))

    await waitFor(() => expect(onVote).toHaveBeenCalledWith('option-2'))
    await screen.findByRole('alert')
    expect(screen.getByRole('alert').textContent).toContain('This poll is closed')
  })

  it('marks the viewer vote and removes the Vote action once voted', () => {
    render(<PollCard poll={{ ...poll, votedOptionId: 'option-2' }} onVote={vi.fn()} />)

    expect(screen.queryByRole('button', { name: 'Vote' })).toBeNull()
    expect(screen.getByRole('status').textContent).toContain('Your vote is in')
    const voted = screen.getByRole('radio', { name: /Occasionally/ })
    expect(voted.getAttribute('aria-checked')).toBe('true')
    expect(voted.getAttribute('data-voted')).toBe('true')
  })

  it('locks voting on a closed poll and when the viewer cannot vote', () => {
    const { rerender } = render(<PollCard poll={{ ...poll, closed: true }} onVote={vi.fn()} />)
    expect(screen.queryByRole('button', { name: 'Vote' })).toBeNull()
    expect(screen.getByText('Closed')).toBeTruthy()
    expect(screen.getByRole('status').textContent).toContain('This poll is closed')

    rerender(<PollCard poll={poll} disabled onVote={vi.fn()} />)
    expect((screen.getByRole('radio', { name: /Usually/ }) as HTMLButtonElement).disabled).toBe(true)
  })
})
