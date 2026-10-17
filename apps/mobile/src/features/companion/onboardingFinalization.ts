import {
  maximumOnboardingActivityCategories,
  validateActivityCategories,
} from '@lets-be-friends/shared'

import {
  validateCompanionApplication,
  type CompanionApplicationForm,
} from '@/data/companionTools'
import { mergeOnboardingCategoriesIntoForm } from '@/features/companion/onboardingCompanionApplication'

export type OnboardingGoal = 'member' | 'companion'
export type FinalizeIntent = 'submit-profile' | 'complete'
export type FinalizeErrorCode =
  | 'username'
  | 'location'
  | 'acceptance'
  | 'categories'
  | 'persistence'
  | 'application'
  | 'completion'

export class FinalizeError extends Error {
  code: FinalizeErrorCode
  constructor(code: FinalizeErrorCode, message: string) {
    super(message)
    this.code = code
  }
}

export type FinalizeDeps = {
  viewerUsername?: string
  usernameReady: boolean
  normalizedUsername: string
  location: { latitude: number; longitude: number } | null
  termsAccepted: boolean
  privacyAccepted: boolean
  alreadyAccepted: boolean
  // Explicit policy-only reacceptance for previously completed accounts:
  // save policies and complete only, never validate or touch the profile.
  policyOnly: boolean
  goal: OnboardingGoal
  categories: string[]
  applicationForm: CompanionApplicationForm
  hasApplication: boolean
  displayName: string
  viewerBio?: string
  claimUsername: (args: { username: string }) => Promise<unknown>
  saveOnboardingLocationAndConsent: (args: {
    latitude: number
    longitude: number
    locationConsent: boolean
    termsAccepted: boolean
    termsVersion: string
    privacyAccepted: boolean
    privacyVersion: string
    identityAccepted: boolean
    identityVersion: string
  }) => Promise<unknown>
  updateProfile: (args: {
    displayName: string
    bio?: string
    onboardingCategories?: string[]
  }) => Promise<unknown>
  submitApplication: (args: unknown) => Promise<unknown>
  completeOnboarding: (args: { goal: OnboardingGoal }) => Promise<unknown>
  policyVersion: string
}

// Production finalization flow for the mobile welcome guide. Both the Terms
// and Privacy acceptances are required; a single box is never enough.
// Validation runs before any persistence, Companion submission runs before
// completion, and a failed submission never completes onboarding, so no work
// is silently lost. Policy-only reacceptance for an existing Companion
// profile skips category validation and profile writes entirely.
export async function finalizeOnboarding(
  intent: FinalizeIntent,
  deps: FinalizeDeps,
): Promise<{ submittedApplication: boolean }> {
  // Legacy callers may still pass 'later'. Treat it as completion, except a
  // new Companion must always submit a profile first.
  const normalizedIntent = ((intent as string) === 'later' ? 'complete' : intent) as FinalizeIntent
  if (!deps.usernameReady) throw new FinalizeError('username', 'Choose an available username before finishing.')
  if (!deps.location) throw new FinalizeError('location', 'Add your approximate location before finishing.')
  const acceptanceSatisfied = deps.alreadyAccepted || (deps.termsAccepted && deps.privacyAccepted)
  if (!acceptanceSatisfied) {
    throw new FinalizeError('acceptance', 'Agree to both the Terms and Conditions and the Privacy Policy in the final step before continuing.')
  }

  // An existing Companion profile means policy-only reacceptance: never
  // validate categories, never touch the profile, never submit silently.
  // Previously completed accounts pass policyOnly explicitly, so reacceptance
  // never depends on category data or profile existence.
  const needsProfileWork = deps.goal === 'companion' && !deps.hasApplication && !deps.policyOnly
  if (needsProfileWork && normalizedIntent !== 'submit-profile') {
    throw new FinalizeError('application', 'Save your Companion profile to finish. Your profile is required before completion.')
  }
  const categoryResult = needsProfileWork
    ? validateActivityCategories(deps.categories, maximumOnboardingActivityCategories)
    : null
  if (categoryResult && (!categoryResult.ok || categoryResult.value.length === 0)) {
    throw new FinalizeError(
      'categories',
      categoryResult.ok ? 'Choose at least one category you would like to offer.' : categoryResult.message,
    )
  }

  const wantsSubmit = normalizedIntent === 'submit-profile' && deps.goal === 'companion' && !deps.hasApplication && !deps.policyOnly
  const mergedForm = wantsSubmit ? mergeOnboardingCategoriesIntoForm(deps.applicationForm, deps.categories) : deps.applicationForm
  const validatedApplication = wantsSubmit ? validateCompanionApplication(mergedForm) : null
  if (validatedApplication && !validatedApplication.ok) {
    throw new FinalizeError('application', validatedApplication.message)
  }

  const rounded = {
    latitude: Math.round(deps.location.latitude * 100) / 100,
    longitude: Math.round(deps.location.longitude * 100) / 100,
  }
  try {
    if (!deps.viewerUsername) await deps.claimUsername({ username: deps.normalizedUsername })
    await deps.saveOnboardingLocationAndConsent({
      ...rounded,
      locationConsent: true,
      termsAccepted: true,
      termsVersion: deps.policyVersion,
      privacyAccepted: true,
      privacyVersion: deps.policyVersion,
      identityAccepted: true,
      identityVersion: deps.policyVersion,
    })
    if (categoryResult?.ok) {
      await deps.updateProfile({
        displayName: deps.displayName,
        ...(deps.viewerBio !== undefined ? { bio: deps.viewerBio } : {}),
        onboardingCategories: categoryResult.value,
      })
    }
  } catch (error) {
    if (error instanceof FinalizeError) throw error
    throw new FinalizeError('persistence', 'Your welcome guide could not be saved. Please review your choices and try again.')
  }

  let submittedApplication = false
  if (validatedApplication?.ok) {
    try {
      await deps.submitApplication(validatedApplication.value)
      submittedApplication = true
    } catch {
      throw new FinalizeError(
        'application',
        'Your Companion profile could not be saved. Review the details and try again.',
      )
    }
  }

  try {
    await deps.completeOnboarding({ goal: deps.goal })
  } catch {
    throw new FinalizeError('completion', 'Your welcome guide could not be completed. Please try again.')
  }
  return { submittedApplication }
}
