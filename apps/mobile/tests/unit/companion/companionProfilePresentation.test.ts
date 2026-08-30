import {
  companionContentTabHeader,
  companionContentTabs,
  companionProfileTypography,
  companionRatePresentation,
  defaultCompanionContentTab,
} from '@/features/companion/companionProfilePresentation'

describe('companion profile content tab presentation', () => {
  it('defaults to the Posts tab and lists both tabs in order', () => {
    expect(defaultCompanionContentTab()).toBe('posts')
    expect(companionContentTabs.map((tab) => tab.label)).toEqual(['Posts', 'Reviews'])
  })

  it('shows only the Posts header with no aggregate tally', () => {
    expect(companionContentTabHeader('posts', { rating: 4.9, reviewCount: 18 })).toEqual({
      title: 'Posts',
      description: 'Recent updates shared by this Companion.',
      ratingSummary: null,
    })
  })

  it('surfaces the aggregate rating and count on the Reviews header', () => {
    expect(companionContentTabHeader('reviews', { rating: 4.9, reviewCount: 18 })).toEqual({
      title: 'Reviews',
      description: 'Ratings from members after completed plans.',
      ratingSummary: '4.9 ★\n18 reviews',
    })
  })

  it('singularizes the review count and omits the summary when unknown', () => {
    expect(companionContentTabHeader('reviews', { rating: 5, reviewCount: 1 }).ratingSummary).toBe('5.0 ★\n1 review')
    expect(companionContentTabHeader('reviews', { rating: 4.9 }).ratingSummary).toBeNull()
    expect(companionContentTabHeader('reviews', { rating: undefined, reviewCount: 0 }).ratingSummary).toBeNull()
  })

  it('keeps identity copy compact and separates the rate cadence', () => {
    expect(companionProfileTypography.name.fontSize).toBe(24)
    expect(companionProfileTypography.intro.fontSize).toBe(18)
    expect(companionProfileTypography.bio.fontSize).toBe(15)
    expect(companionRatePresentation('₱500.00 / hour')).toEqual({
      amount: '₱500.00',
      cadence: 'per hour',
    })
  })
})
