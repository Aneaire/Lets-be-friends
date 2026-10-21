// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  review: undefined as unknown,
  mutation: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('convex/react', () => ({
  useQuery: () => mocks.review,
  useMutation: () => mocks.mutation,
}))

vi.mock('@tanstack/react-router', () => ({
  Link: ({ to, search: _search, children, ...props }: { to: string; search?: unknown; children: ReactNode }) => (
    <a href={to} {...props}>{children}</a>
  ),
}))

import { SubmittedReviewPage } from '../../src/features/review/SubmittedReviewPage'

const review = {
  _id: 'review-1',
  reviewerId: 'user-1',
  reviewerDisplayName: 'Gelo Santiago',
  reviewerProfileImageUrl: null,
  createdAt: new Date('2026-10-21T04:13:00Z').getTime(),
  rating: 5,
  body: 'This guy is awesome, will book again next time.',
  imageUrl: 'https://example.com/review-photo.png',
  imageUrls: ['https://example.com/review-photo.png'],
  companionDisplayName: 'Angelo Santiago',
  likeCount: 1,
  liked: false,
  saved: false,
  commentCount: 1,
  comments: [
    {
      _id: 'comment-1',
      body: 'Glad it went well.',
      authorDisplayName: 'Rina',
      authorProfileImageUrl: null,
      ownComment: false,
    },
  ],
}

afterEach(() => {
  cleanup()
  mocks.review = undefined
  mocks.mutation.mockClear()
})

describe('SubmittedReviewPage', () => {
  it('renders the submitted review as a focused media and details page', () => {
    mocks.review = review

    render(<SubmittedReviewPage reviewId="review-1" />)

    expect(screen.getByText('Gelo Santiago')).toBeTruthy()
    expect(screen.getByText('This guy is awesome, will book again next time.')).toBeTruthy()
    expect(screen.getByText('Experience with Angelo Santiago')).toBeTruthy()
    expect(screen.getByText('Glad it went well.')).toBeTruthy()
    expect(screen.getByText('Review submitted')).toBeTruthy()
    expect(screen.getByRole('img', { name: 'Photo shared with your review' })).toBeTruthy()
    expect(screen.getByRole('link', { name: /Back to bookings/ }).getAttribute('href')).toBe('/app')
  })

  it('posts a comment on the review page', async () => {
    mocks.review = { ...review, comments: [], commentCount: 0 }

    render(<SubmittedReviewPage reviewId="review-1" />)

    const input = screen.getByLabelText('Write a comment on your review')
    fireEvent.change(input, { target: { value: '  Thanks for writing this.  ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Post' }))

    expect(mocks.mutation).toHaveBeenCalledWith({ reviewId: 'review-1', body: 'Thanks for writing this.' })
  })

  it('explains when the review cannot be opened', () => {
    mocks.review = null

    render(<SubmittedReviewPage reviewId="review-1" />)

    expect(screen.getByText('This review is not available.')).toBeTruthy()
    expect(screen.getAllByRole('link', { name: 'Back to bookings' }).every((link) => link.getAttribute('href') === '/app')).toBe(true)
  })
})
