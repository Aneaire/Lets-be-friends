import {
  maximumOnboardingActivityCategories,
  roundApproximateCoordinates,
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
  | 'profile'
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

export function onboardingLocationPreview(location: { latitude: number; longitude: number }) {
  return roundApproximateCoordinates(location)
}

// Name step validation shared by the welcome guide screen (early feedback on
// the name step) and the finalizer (last defense before persistence). Mirrors
// the web profile step: first and last name for every new account, plus a
// short bio for members. Companions keep their introduction in the
// application form instead.
export type OnboardingProfileValidation =
  | { ok: true; cleanFirstName: string; cleanLastName: string; cleanBio: string }
  | { ok: false; message: string }

export function validateOnboardingProfile(input: {
  goal: OnboardingGoal
  firstName: string
  lastName: string
  bio?: string
}): OnboardingProfileValidation {
  const cleanFirstName = input.firstName.trim()
  const cleanLastName = input.lastName.trim()
  if (!cleanFirstName || !cleanLastName) {
    return { ok: false, message: 'Enter your first and last name.' }
  }
  const cleanBio = input.bio?.trim() ?? ''
  if (input.goal !== 'companion' && !cleanBio) {
    return {
      ok: false,
      message: 'Add a short bio about the skills, talents, or everyday help you can share.',
    }
  }
  return { ok: true, cleanFirstName, cleanLastName, cleanBio }
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
  firstName: string
  lastName: string
  // Public member introduction collected in the name step. Companions keep
  // their introduction inside the Companion application instead.
  bio?: string
  categories: string[]
  applicationForm: CompanionApplicationForm
  hasApplication: boolean
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
    firstName: string
    lastName: string
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

  // Name step validation mirrors the web welcome guide. Policy-only
  // reacceptance never touches the profile, so it skips this validation.
  let savedProfile: OnboardingProfileValidation | null = null
  if (!deps.policyOnly) {
    const validation = validateOnboardingProfile({
      goal: deps.goal,
      firstName: deps.firstName,
      lastName: deps.lastName,
      bio: deps.bio,
    })
    if (!validation.ok) throw new FinalizeError('profile', validation.message)
    savedProfile = validation
  }

  const wantsSubmit = normalizedIntent === 'submit-profile' && deps.goal === 'companion' && !deps.hasApplication && !deps.policyOnly
  const mergedForm = wantsSubmit ? mergeOnboardingCategoriesIntoForm(deps.applicationForm, deps.categories) : deps.applicationForm
  const validatedApplication = wantsSubmit ? validateCompanionApplication(mergedForm) : null
  if (validatedApplication && !validatedApplication.ok) {
    throw new FinalizeError('application', validatedApplication.message)
  }

  // The raw device fix goes to the server, which applies its own jitter
  // before storing. Rounding here would only quantize the fix without
  // hiding it, so the preview rounds for display while the save stays raw.
  const rawFix = {
    latitude: deps.location.latitude,
    longitude: deps.location.longitude,
  }
  try {
    if (!deps.viewerUsername) await deps.claimUsername({ username: deps.normalizedUsername })
    await deps.saveOnboardingLocationAndConsent({
      ...rawFix,
      locationConsent: true,
      termsAccepted: true,
      termsVersion: deps.policyVersion,
      privacyAccepted: true,
      privacyVersion: deps.policyVersion,
      identityAccepted: true,
      identityVersion: deps.policyVersion,
    })
    // Every non-policy-only save composes the public display name from the
    // confirmed name step, mirroring the web profile step. Members also save
    // their bio here; Companions keep theirs in the application payload.
    if (!deps.policyOnly && savedProfile && savedProfile.ok) {
      await deps.updateProfile({
        displayName: `${savedProfile.cleanFirstName} ${savedProfile.cleanLastName}`,
        firstName: savedProfile.cleanFirstName,
        lastName: savedProfile.cleanLastName,
        ...(deps.goal === 'member' ? { bio: deps.bio?.trim() } : {}),
        ...(categoryResult?.ok ? { onboardingCategories: categoryResult.value } : {}),
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
