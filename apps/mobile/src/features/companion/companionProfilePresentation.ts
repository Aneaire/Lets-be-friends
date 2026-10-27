import { typography } from '@/theme/tokens'

export type CompanionContentTab = 'posts' | 'reviews'

export const companionProfileTypography = {
  name: typography.title,
  intro: typography.heading,
  bio: typography.body,
  rate: { fontSize: 22, lineHeight: 27, fontWeight: '800' as const },
} as const

export function companionRatePresentation(rateLabel: string) {
  const [amount, cadence] = rateLabel.split(/\s*\/\s*/, 2)
  return {
    amount: amount.trim(),
    cadence: cadence ? `per ${cadence.trim()}` : '',
  }
}

export const companionContentTabs: ReadonlyArray<{ value: CompanionContentTab; label: string }> = [
  { value: 'posts', label: 'Posts' },
  { value: 'reviews', label: 'Reviews' },
]

export function defaultCompanionContentTab(): CompanionContentTab {
  return 'posts'
}

export type CompanionTabHeader = {
  title: string
  description: string
  ratingSummary: string | null
}

export function companionContentTabHeader(
  tab: CompanionContentTab,
  context: { rating?: number; reviewCount?: number },
): CompanionTabHeader {
  if (tab === 'posts') {
    return {
      title: 'Posts',
      description: 'Recent updates shared by this Companion.',
      ratingSummary: null,
    }
  }
  const hasAggregate = typeof context.rating === 'number' && (context.reviewCount ?? 0) > 0
  return {
    title: 'Reviews',
    description: 'Ratings from members after completed plans.',
    ratingSummary: hasAggregate
      ? `${context.rating!.toFixed(1)} ★\n${context.reviewCount} ${context.reviewCount === 1 ? 'review' : 'reviews'}`
      : null,
  }
}
