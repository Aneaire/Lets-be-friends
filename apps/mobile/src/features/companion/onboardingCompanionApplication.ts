import type { CompanionApplicationStatus } from '@lets-be-friends/shared'

import {
  companionApplicationStatusCopy,
  initialCompanionApplicationForm,
  type CompanionApplicationForm,
} from '@/data/companionTools'

export type OnboardingGoal = 'member' | 'companion'

export type OnboardingCompanionApplicationRecord = {
  status: string
} | null | undefined

export function onboardingTotalSteps(goal: OnboardingGoal): number {
  return goal === 'companion' ? 5 : 4
}

export function onboardingMaxStep(goal: OnboardingGoal): number {
  return onboardingTotalSteps(goal) - 1
}

export function clampOnboardingStep(step: number, goal: OnboardingGoal): number {
  return Math.max(0, Math.min(step, onboardingMaxStep(goal)))
}

export function hasSubmittedCompanionApplication(
  application: OnboardingCompanionApplicationRecord,
  justSubmitted: boolean,
): boolean {
  return justSubmitted || (application !== null && application !== undefined)
}

export type OnboardingCompanionStatusPresentation = {
  label: string
  detail: string
  guidance: string
}

export function onboardingCompanionStatusPresentation(
  application: OnboardingCompanionApplicationRecord,
  justSubmitted: boolean,
): OnboardingCompanionStatusPresentation {
  const rawStatus = application?.status ?? (justSubmitted ? 'pending_review' : 'pending_review')
  const status: CompanionApplicationStatus =
    rawStatus in companionApplicationStatusCopy
      ? (rawStatus as CompanionApplicationStatus)
      : 'pending_review'
  const copy = companionApplicationStatusCopy[status]
  return {
    label: copy.label,
    detail: copy.detail,
    guidance: onboardingCompanionStatusGuidance(status),
  }
}

function onboardingCompanionStatusGuidance(status: CompanionApplicationStatus): string {
  if (status === 'approved') {
    return 'Your Companion profile is approved. Finish the welcome guide, then continue identity verification on web from the Companion screen if it is still pending.'
  }
  if (status === 'rejected') {
    return 'The review team requested changes. Finish the welcome guide if you prefer, then update the profile from the Companion screen and send it again.'
  }
  return 'Your Companion profile is with the review team. Approval stays with the review team. Finish the welcome guide, then continue identity verification on web from the Companion screen.'
}

export function defaultOnboardingCompanionForm(input: {
  bio?: string | null
  categories?: string[] | null
}): CompanionApplicationForm {
  const form = initialCompanionApplicationForm()
  const bio = (input.bio ?? '').trim()
  return {
    ...form,
    bio,
    categories: [...(input.categories ?? [])],
  }
}

export function mergeOnboardingCategoriesIntoForm(
  form: CompanionApplicationForm,
  categories: string[],
): CompanionApplicationForm {
  if (form.categories.length > 0) return form
  return { ...form, categories: [...categories] }
}

export const onboardingCompanionReviewNotice =
  'Sending starts profile review. It does not guarantee approval. Admin review stays required before a profile can appear publicly.'

export const onboardingCompanionSkipCopy =
  'Prefer to apply later? Complete the welcome guide now and submit your profile from the Companion screen at any time.'

export const onboardingCompanionIdentityFollowupCopy =
  'Identity verification happens on web after onboarding. Open the Companion screen to continue there.'

export const onboardingCompanionHeroTitle = 'Share your profile.'

export const onboardingCompanionHeroCopy =
  'Send your Companion profile for review. Approval stays with the review team.'
