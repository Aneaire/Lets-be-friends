// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ProfileContentPanel } from '../../src/features/profile/ProfileContentPanel'

afterEach(cleanup)

const posts = [{
  _id: 'post-1',
  body: 'A quiet creative session can be social too.',
  createdAt: Date.UTC(2026, 7, 23, 8, 13),
  media: [],
}]

const reviews = [{
  _id: 'review-1',
  body: 'The photo walk was comfortable and easy to follow.',
  createdAt: Date.UTC(2026, 7, 19, 14, 13),
  rating: 5,
  reviewerDisplayName: 'Angelo Santiago',
  reviewerProfileImageUrl: '/angelo.jpg',
  likeCount: 2,
  liked: false,
  commentCount: 1,
  comments: [{
    _id: 'comment-1',
    body: 'This sounds like a thoughtful plan.',
    createdAt: Date.UTC(2026, 7, 20, 14, 13),
    authorDisplayName: 'Mara Reyes',
  }],
  saved: false,
}]

describe('ProfileContentPanel', () => {
  it('shows reviewer identity, five stars, and working social actions', async () => {
    const onSave = vi.fn()
    const onLike = vi.fn().mockResolvedValue(true)
    const onComment = vi.fn().mockResolvedValue('comment-2')
    render(
      <ProfileContentPanel
        ownerName="Mara"
        posts={posts}
        reviews={reviews}
        rating={4.9}
        reviewCount={21}
        postsDescription="Posts visible from Mara's member profile."
        onLikeReview={onLike}
        onCommentReview={onComment}
        reviewAction={(review) => (
          <button type="button" onClick={() => onSave(review._id)}>Save rating</button>
        )}
      />,
    )

    expect(screen.getByRole('tablist', { name: 'Mara profile content' })).toBeTruthy()
    expect(screen.getByRole('tab', { name: 'Posts' }).getAttribute('aria-selected')).toBe('true')
    expect(screen.getByText('A quiet creative session can be social too.')).toBeTruthy()

    fireEvent.click(screen.getByRole('tab', { name: 'Reviews' }))

    expect(screen.getByRole('tab', { name: 'Reviews' }).getAttribute('aria-selected')).toBe('true')
    expect(screen.getByLabelText('4.9 out of 5 from 21 reviews')).toBeTruthy()
    expect(screen.getByText('Angelo Santiago')).toBeTruthy()
    expect(document.querySelector('.profile-review-author-row .ds-avatar img')?.getAttribute('src')).toBe('/angelo.jpg')
    expect(screen.getByLabelText('5 out of 5 stars').querySelectorAll('.profile-review-star')).toHaveLength(5)
    fireEvent.click(screen.getByRole('button', { name: 'Save rating' }))
    expect(onSave).toHaveBeenCalledWith('review-1')
    fireEvent.click(screen.getByRole('button', { name: 'Like 2' }))
    await waitFor(() => expect(onLike).toHaveBeenCalledWith(reviews[0]))
    fireEvent.click(screen.getByRole('button', { name: 'Comment 1' }))
    expect(screen.getByText('This sounds like a thoughtful plan.')).toBeTruthy()
    fireEvent.change(screen.getByRole('textbox', { name: "Comment on Angelo Santiago's review" }), { target: { value: 'I agree.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Post' }))
    await waitFor(() => expect(onComment).toHaveBeenCalledWith(reviews[0], 'I agree.'))
  })

  it('supports arrow, Home, and End navigation between tabs', () => {
    render(
      <ProfileContentPanel
        ownerName="Mara"
        posts={posts}
        reviews={reviews}
        postsDescription="Posts visible from Mara's member profile."
      />,
    )

    const postsTab = screen.getByRole('tab', { name: 'Posts' })
    fireEvent.keyDown(postsTab, { key: 'End' })
    expect(document.activeElement).toBe(screen.getByRole('tab', { name: 'Reviews' }))

    fireEvent.keyDown(screen.getByRole('tab', { name: 'Reviews' }), { key: 'Home' })
    expect(document.activeElement).toBe(postsTab)
    expect(postsTab.getAttribute('aria-selected')).toBe('true')
  })

  it('explains when reviews do not apply to a member profile', () => {
    render(
      <ProfileContentPanel
        ownerName="Alex"
        posts={[]}
        reviews={null}
        postsDescription="Posts visible from Alex's member profile."
        unavailableReviewsTitle="Reviews are not available for this member profile."
        unavailableReviewsDescription="Reviews appear when a member has an approved Companion profile."
      />,
    )

    expect(screen.getByText('No posts yet.')).toBeTruthy()
    fireEvent.click(screen.getByRole('tab', { name: 'Reviews' }))
    expect(screen.getByText('Reviews are not available for this member profile.')).toBeTruthy()
    expect(screen.getByText('Reviews appear when a member has an approved Companion profile.')).toBeTruthy()
  })
})
