// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { ReviewContent } from '../../src/features/social/ReviewContent'

afterEach(cleanup)

describe('ReviewContent', () => {
  it('renders five stars, the detailed value, body, and review photo', () => {
    render(
      <ReviewContent
        rating={4.9}
        showRatingValue
        body="A comfortable and easy session."
        imageUrl="https://example.com/review.jpg"
        reviewerDisplayName="Robin Lee"
      />,
    )

    const stars = screen.getByRole('img', { name: '4.9 out of 5 stars' })
    expect(stars.querySelectorAll('.profile-review-star')).toHaveLength(5)
    expect(stars.querySelector('strong')?.textContent).toBe('4.9')
    expect(screen.getByText('A comfortable and easy session.')).toBeTruthy()
    expect(screen.getByAltText("Photo shared with Robin Lee's review")).toBeTruthy()
  })

  it('omits the value, body, and photo when they are not present', () => {
    render(<ReviewContent rating={3} reviewerDisplayName="Robin Lee" />)

    expect(screen.getByLabelText('3 out of 5 stars')).toBeTruthy()
    expect(screen.getByLabelText('3 out of 5 stars').querySelector('strong')).toBeNull()
    expect(screen.queryByAltText("Photo shared with Robin Lee's review")).toBeNull()
  })

  it('applies caller class names to the body and photo wrapper', () => {
    const { container } = render(
      <ReviewContent
        rating={5}
        body="Shared review body."
        imageUrl="https://example.com/review.jpg"
        reviewerDisplayName="Robin Lee"
        bodyClassName="social-shared-embed-body"
        imageWrapperClassName="social-shared-embed-image"
      />,
    )

    expect(container.querySelector('p.social-shared-embed-body')?.textContent).toBe('Shared review body.')
    expect(container.querySelector('.social-shared-embed-image img')).toBeTruthy()
  })
})
