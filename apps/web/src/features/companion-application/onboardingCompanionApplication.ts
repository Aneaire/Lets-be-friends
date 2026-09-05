import {
  activityCategoryOptions,
  maximumActivityCategoryLength,
  maximumCompanionActivityCategories,
  normalizeActivityCategory,
  validateActivityCategories,
} from '@lets-be-friends/shared'

export type OnboardingApplicationMode = 'online' | 'in_person' | 'both'

export interface OnboardingApplicationValues {
  intro: string
  city: string
  categories: string[]
  mode: OnboardingApplicationMode
  hourlyRatePesos: string
  bio: string
  earningMotivation: string
}

export interface OnboardingApplicationPayload {
  intro: string
  city: string
  strengths: string[]
  categories: string[]
  boundaries: string[]
  mode: OnboardingApplicationMode
  hourlyRateCentavos: number
  bio?: string
  earningMotivation: string
}

export const onboardingApplicationDefaults = {
  introMinLength: 40,
  introMaxLength: 500,
  bioMaxLength: 500,
  earningMotivationMinLength: 20,
  earningMotivationMaxLength: 1000,
  rateMinPesos: 100,
  rateMaxPesos: 10000,
  defaultRatePesos: '500',
} as const

export function defaultOnboardingApplicationValues(
  viewerBio?: string | null,
  viewerCategories?: string[] | null,
): OnboardingApplicationValues {
  return {
    intro: '',
    city: '',
    categories: [...(viewerCategories ?? [])],
    mode: 'both',
    hourlyRatePesos: onboardingApplicationDefaults.defaultRatePesos,
    bio: viewerBio ?? '',
    earningMotivation: '',
  }
}

export function validateOnboardingApplication(
  values: OnboardingApplicationValues,
): { ok: true } | { ok: false; message: string } {
  const intro = values.intro.trim()
  if (intro.length < onboardingApplicationDefaults.introMinLength) {
    return { ok: false, message: `Describe how you can help in at least ${onboardingApplicationDefaults.introMinLength} characters.` }
  }
  if (intro.length > onboardingApplicationDefaults.introMaxLength) {
    return { ok: false, message: `Keep your introduction to ${onboardingApplicationDefaults.introMaxLength} characters or fewer.` }
  }
  if (values.mode !== 'online' && !values.city.trim()) {
    return { ok: false, message: 'Add the city where you can meet in person.' }
  }
  if (values.categories.length === 0) {
    return { ok: false, message: 'Choose at least one activity before submitting.' }
  }
  const categoryResult = validateActivityCategories(values.categories, maximumCompanionActivityCategories)
  if (!categoryResult.ok) return { ok: false, message: categoryResult.message }
  const rate = Number(values.hourlyRatePesos)
  if (
    !Number.isFinite(rate)
    || rate < onboardingApplicationDefaults.rateMinPesos
    || rate > onboardingApplicationDefaults.rateMaxPesos
  ) {
    return {
      ok: false,
      message: `Set an hourly rate between ${onboardingApplicationDefaults.rateMinPesos} and ${onboardingApplicationDefaults.rateMaxPesos} PHP.`,
    }
  }
  const bio = values.bio.trim()
  if (bio.length > onboardingApplicationDefaults.bioMaxLength) {
    return { ok: false, message: `Keep your personal note to ${onboardingApplicationDefaults.bioMaxLength} characters or fewer.` }
  }
  const earningMotivation = values.earningMotivation.trim()
  if (earningMotivation.length < onboardingApplicationDefaults.earningMotivationMinLength) {
    return {
      ok: false,
      message: `Tell the review team why you want to earn (at least ${onboardingApplicationDefaults.earningMotivationMinLength} characters).`,
    }
  }
  if (earningMotivation.length > onboardingApplicationDefaults.earningMotivationMaxLength) {
    return {
      ok: false,
      message: `Keep your motivation note to ${onboardingApplicationDefaults.earningMotivationMaxLength} characters or fewer.`,
    }
  }
  return { ok: true }
}

export function buildOnboardingApplicationPayload(
  values: OnboardingApplicationValues,
): OnboardingApplicationPayload {
  const validation = validateOnboardingApplication(values)
  if (!validation.ok) throw new Error(validation.message)
  const categoryResult = validateActivityCategories(values.categories, maximumCompanionActivityCategories)
  if (!categoryResult.ok) throw new Error(categoryResult.message)
  const bio = values.bio.trim()
  return {
    intro: values.intro.trim(),
    city: values.city.trim(),
    strengths: [],
    categories: categoryResult.value,
    boundaries: [],
    mode: values.mode,
    hourlyRateCentavos: Math.round(Number(values.hourlyRatePesos) * 100),
    ...(bio ? { bio } : {}),
    earningMotivation: values.earningMotivation.trim(),
  }
}

export function hasSubmittedApplication(status: string | null | undefined): boolean {
  return typeof status === 'string' && status.length > 0
}

export function onboardingApplicationStatusLabel(status: string): string {
  if (status === 'approved') return 'Profile approved'
  if (status === 'pending_review') return 'In review'
  if (status === 'rejected') return 'Changes requested'
  if (status === 'suspended') return 'Suspended'
  if (status === 'draft') return 'Draft'
  return status.replaceAll('_', ' ')
}

export function onboardingApplicationStatusGuidance(status: string): string {
  if (status === 'pending_review') {
    return 'Your Companion profile is with the review team. You can continue to identity verification now. Approval stays with the review team.'
  }
  if (status === 'approved') {
    return 'Your Companion profile is approved. Continue to identity verification if it is still pending.'
  }
  if (status === 'rejected') {
    return 'The review team requested changes. Update your profile from the Companion page, then return here to continue.'
  }
  return 'Your Companion profile was saved. Continue to identity verification when you are ready.'
}

export function companionApplicationSkipDestination(): '/become-companion' {
  return '/become-companion'
}

export { activityCategoryOptions, maximumActivityCategoryLength, normalizeActivityCategory }
