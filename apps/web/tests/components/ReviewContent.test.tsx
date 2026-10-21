// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
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

  it('sizes a single review photo fluidly from its natural ratio within a 4:5 cap', () => {
    const { container } = render(
      <ReviewContent
        rating={5}
        imageUrl="https://example.com/review-portrait.jpg"
        reviewerDisplayName="Robin Lee"
      />,
    )

    const image = screen.getByAltText("Photo shared with Robin Lee's review")
    Object.defineProperties(image, {
      naturalWidth: { configurable: true, value: 720 },
      naturalHeight: { configurable: true, value: 1200 },
    })
    fireEvent.load(image)

    const frame = container.querySelector<HTMLElement>('.social-review-image-single')
    expect(frame?.style.getPropertyValue('--social-review-aspect')).toBe('0.8')
  })

  it('keeps a single landscape review photo at its natural ratio', () => {
    const { container } = render(
      <ReviewContent
        rating={5}
        imageUrl="https://example.com/review-landscape.jpg"
        reviewerDisplayName="Robin Lee"
      />,
    )

    const image = screen.getByAltText("Photo shared with Robin Lee's review")
    Object.defineProperties(image, {
      naturalWidth: { configurable: true, value: 1600 },
      naturalHeight: { configurable: true, value: 1000 },
    })
    fireEvent.load(image)

    const frame = container.querySelector<HTMLElement>('.social-review-image-single')
    expect(frame?.style.getPropertyValue('--social-review-aspect')).toBe('1.6')
  })

  it('lays out three review photos as a large photo beside two stacked photos', () => {
    const { container } = render(
      <ReviewContent
        rating={5}
        imageUrls={['https://example.com/one.jpg', 'https://example.com/two.jpg', 'https://example.com/three.jpg']}
        reviewerDisplayName="Robin Lee"
      />,
    )

    const grid = container.querySelector<HTMLElement>('.social-review-image-grid')
    expect(grid?.dataset.count).toBe('3')
    expect(grid?.querySelectorAll('img')).toHaveLength(3)
  })
})
