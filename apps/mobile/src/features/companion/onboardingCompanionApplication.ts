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

export function onboardingTotalSteps(_goal: OnboardingGoal): number {
  return 6
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
  const rawStatus = application?.status ?? 'approved'
  const status: CompanionApplicationStatus =
    rawStatus in companionApplicationStatusCopy
      ? (rawStatus as CompanionApplicationStatus)
      : 'approved'
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
    return 'Changes were requested on your Companion profile. Finish the welcome guide if you prefer, then update the profile from the Companion screen and save it again.'
  }
  return 'Your Companion profile is saved. Only identity verification is reviewed. Finish the welcome guide, then continue identity verification on web from the Companion screen.'
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
  'Saving happens only in the final step after acceptance. Your profile stays hidden from discovery until identity verification is approved. Only identity is reviewed.'

export const onboardingCompanionIdentityFollowupCopy =
  'Identity verification happens on web after onboarding. Open the Companion screen to continue there.'

// Explicit earning expectation for the final review step: approval is what
// flips a saved profile into a public, earning one.
export const onboardingCompanionEarningCopy =
  'After the safety team approves your identity check, your Companion profile becomes visible to members and you can start earning from completed experiences.'

export const onboardingCompanionHeroTitle = 'Share your profile.'

export const onboardingCompanionHeroCopy =
  'Prepare your Companion profile. It saves only in the final step after acceptance. Only identity verification is reviewed.'

export const onboardingMemberPrepareTitle = 'Get ready to meet.'

export const onboardingMemberPrepareCopy =
  'Identity review comes first, then discovery, booking, and reviews. Your details save only in the final step after acceptance.'

// Journey explainers mirrored from the web welcome guide. Step 4 shows the
// matching list for the chosen goal before the final review step.
export const onboardingMemberJourney: Array<[string, string]> = [
  ['Complete identity verification', 'Securely submit a government ID and take a current camera selfie.'],
  ['Receive safety-team approval', 'Every completed identity submission is reviewed before booking access is unlocked.'],
  ['Discover an approved Companion', 'Compare Strengths, interests, availability, boundaries, and reviews before choosing.'],
  ['Send a booking request', 'Choose a category, mode, and time for the Companion to accept or decline.'],
  ['Have the experience and leave a review', 'Messages support safe coordination, and afterward you can share feedback.'],
]

export const onboardingCompanionJourney: Array<[string, string]> = [
  ['Set up your Companion profile', 'Describe the work or skills you can offer, your session format, activities, and rate.'],
  ['Complete identity and safety review', 'Identity is the only review step. Your profile stays hidden until it is approved.'],
  ['Receive approval for public discovery', 'Approval makes your Companion profile visible to members.'],
  ['Help, earn, and connect', 'Accept or decline booking requests, coordinate safely, and earn from completed experiences. You can still book other Companions.'],
]
