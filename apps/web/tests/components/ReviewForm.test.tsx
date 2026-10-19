// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('convex/react', () => ({
  useQuery: () => ({ displayName: 'Robin Lee', profileImageUrl: null }),
  useMutation: () => vi.fn(),
}))

import { ReviewForm } from '../../src/features/profile/ReviewForm'

afterEach(cleanup)

describe('ReviewForm', () => {
  it('publishes the rating and note the reviewer typed', async () => {
    const onReview = vi.fn().mockResolvedValue(undefined)
    render(<ReviewForm onReview={onReview} />)

    fireEvent.change(screen.getByLabelText('Review rating'), { target: { value: '3' } })
    fireEvent.change(screen.getByPlaceholderText('Write about the experience'), {
      target: { value: '  A calm, well-planned session.  ' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Leave review' }))

    expect(onReview).toHaveBeenCalledWith(3, 'A calm, well-planned session.', undefined)
  })

  it('opens the feed preview with the draft when the reviewer asks for it', () => {
    render(<ReviewForm onReview={vi.fn()} preview={{ companionName: 'Jordan Companion' }} />)

    fireEvent.change(screen.getByPlaceholderText('Write about the experience'), {
      target: { value: 'We planned the route in chat.' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Preview' }))

    const dialog = screen.getByRole('dialog', { name: 'How your review will look' })
    expect(dialog).toBeTruthy()
    expect(screen.getByRole('article', { name: 'Review preview' })).toBeTruthy()
    expect(screen.getByText('We planned the route in chat.')).toBeTruthy()
    expect(screen.getByText(/Shared an experience with Jordan Companion/)).toBeTruthy()
  })

  it('keeps the preview hidden when the review does not reach the feed', () => {
    render(<ReviewForm onReview={vi.fn()} />)

    expect(screen.queryByRole('button', { name: 'Preview' })).toBeNull()
  })
})
