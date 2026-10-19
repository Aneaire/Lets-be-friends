// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('convex/react', () => ({
  useQuery: () => ({ displayName: 'Robin Lee', profileImageUrl: null }),
  useMutation: () => vi.fn(),
}))

vi.mock('../../convex/_generated/api', () => ({
  api: {
    reviews: {
      generateImageUploadUrl: 'reviews.generateImageUploadUrl',
      registerImageUpload: 'reviews.registerImageUpload',
      discardImageUpload: 'reviews.discardImageUpload',
    },
    users: { viewer: 'users.viewer' },
  },
}))

import { ReviewForm } from '../../src/features/profile/ReviewForm'

afterEach(cleanup)

describe('ReviewForm', () => {
  it('offers one entry point that opens the composer dialog', () => {
    render(<ReviewForm onReview={vi.fn()} />)

    expect(screen.queryByRole('dialog')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Leave a review' }))
    expect(screen.getByRole('dialog', { name: 'Leave a review' })).toBeTruthy()
  })

  it('previews the feed card only where the review can reach the feed', () => {
    render(<ReviewForm onReview={vi.fn()} preview={{ companionName: 'Jordan Companion' }} />)
    fireEvent.click(screen.getByRole('button', { name: 'Leave a review' }))

    expect(screen.getByRole('article', { name: 'Review preview' })).toBeTruthy()
    expect(screen.getByText(/Shared an experience with Jordan Companion/)).toBeTruthy()
    expect(screen.getByText(/A rating on its own stays on Jordan Companion's profile/)).toBeTruthy()
  })

  it('sends the rating and note to the booking review handler', async () => {
    const onReview = vi.fn().mockResolvedValue(undefined)
    render(<ReviewForm onReview={onReview} />)
    fireEvent.click(screen.getByRole('button', { name: 'Leave a review' }))
    fireEvent.click(screen.getByRole('radio', { name: '4 stars' }))
    fireEvent.change(screen.getByPlaceholderText('What stood out about the experience?'), {
      target: { value: 'Great session.' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Publish review' }))

    expect(onReview).toHaveBeenCalledWith(4, 'Great session.', [])
  })
})
