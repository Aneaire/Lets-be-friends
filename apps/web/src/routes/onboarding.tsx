import { SignInButton, useAuth } from '@clerk/react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, Check } from 'lucide-react'
import {
  hasCurrentUnifiedAcceptance,
  normalizeUsername,
  usernameValidationError,
} from '@lets-be-friends/shared'
import { api } from '../../convex/_generated/api'
import { Button } from '../design-system/atoms/Button'
import { Input, Textarea } from '../design-system/atoms/Field'
import { InlineNotice } from '../design-system/molecules/FeedbackState'
import { FormField } from '../design-system/molecules/FormField'
import { ApproximateLocationMap } from '../design-system/organisms/ApproximateLocationMap'
import { roundCoordinates, type Coordinates } from '../lib/geo'
import { currentTermsVersion, deviceLocationErrorMessage, isRoundedCoordinate, onboardingDestination, type OnboardingGoal } from '../lib/onboarding'
import { useIdentityVerification } from '../features/identity/IdentityVerificationFlow'
import { CompanionProfileFields } from '../features/companion-application/CompanionProfileFields'
import {
  buildCompanionProfilePayload,
  companionProfileDefaults,
  validateCompanionProfile,
  type CompanionProfileMode,
  type CompanionProfileValues,
} from '../features/companion-application/companionProfileForm'
import { AcceptanceCheckboxes, AlreadyAcceptedNotice, unifiedPolicyVersion } from '../features/policy/PolicySummaries'
import { identityEntitlementStatus, memberVerificationPresentation } from '../lib/memberVerification';
import { describeConvexError } from '../lib/convexErrors'

export const Route = createFileRoute('/onboarding')({ component: OnboardingPage })

const termsVersion = currentTermsVersion
const policyVersion = unifiedPolicyVersion

const memberJourney = [
  ['Complete identity verification', 'Securely submit a government ID and take a current camera selfie.'],
  ['Receive safety-team approval', 'Every completed identity submission is reviewed before booking access is unlocked.'],
  ['Discover an approved Companion', 'Compare Strengths, interests, availability, boundaries, and reviews before choosing.'],
  ['Send a booking request', 'Choose a category, mode, and time for the Companion to accept or decline.'],
  ['Have the experience and leave a review', 'Messages support safe coordination, and afterward you can share feedback.'],
] as const

const companionJourney = [
  ['Set up your Companion profile', 'Describe the work or skills you can offer, your session format, activities, and rate.'],
  ['Complete identity and safety review', 'Identity is the only review step. Your profile stays hidden until it is approved.'],
  ['Receive approval for public discovery', 'Approval makes your Companion profile visible to members.'],
  ['Help, earn, and connect', 'Accept or decline booking requests, coordinate safely, and earn from completed experiences. You can still book other Companions.'],
] as const

export function OnboardingPage() {
  const { isSignedIn } = useAuth()
  const viewer = useQuery(api.users.viewer, isSignedIn ? {} : 'skip')
  const latestIdentityVerification = useQuery(api.users.latestMemberVerification, viewer ? {} : 'skip')
  const updateProfile = useMutation(api.users.updateProfile)
  const claimUsername = useMutation(api.users.claimUsername)
  const saveOnboardingLocationAndConsent = useMutation(api.users.saveOnboardingLocationAndConsent)
  const submitCompanionProfile = useMutation(api.companions.submitApplication)
  const completeOnboarding = useMutation(api.users.completeOnboarding)
  const identityFlow = useIdentityVerification('member')
  const companionIdentityFlow = useIdentityVerification('companion_application')
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [username, setUsername] = useState('')
  const [goal, setGoal] = useState<OnboardingGoal | undefined>()
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [bio, setBio] = useState('')
  const [companionMode, setCompanionMode] = useState<CompanionProfileMode>('both')
  const [companionRate, setCompanionRate] = useState<string>(companionProfileDefaults.defaultRatePesos)
  const [companionCity, setCompanionCity] = useState('')
  const [companionIntro, setCompanionIntro] = useState('')
  const [approxLocation, setApproxLocation] = useState<Coordinates | null>(null)
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [privacyAccepted, setPrivacyAccepted] = useState(false)
  const [locationStatus, setLocationStatus] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const accountKeyRef = useRef<string | null>(null)
  const normalizedUsername = normalizeUsername(username)
  const localUsernameError = usernameValidationError(username)
  const usernameAvailability = useQuery(
    api.users.usernameAvailability,
    isSignedIn && viewer && !viewer.username && !localUsernameError ? { username: normalizedUsername } : 'skip',
  )

  useEffect(() => {
    if (!viewer) return
    // Stable per-account key: never displayName. Every per-account form
    // field resets when this changes, so a new account never inherits the
    // prior account's draft, location, step, or checkbox state.
    const account = viewer as unknown as { _id?: unknown; clerkUserId?: unknown }
    const accountKey = String(account._id ?? account.clerkUserId ?? '')
    if (accountKeyRef.current !== accountKey) {
      accountKeyRef.current = accountKey
      const fallbackName = splitExistingName(viewer.displayName)
      setUsername(viewer.username || '')
      setGoal(viewer.onboardingGoal)
      setFirstName(viewer.firstName || fallbackName.firstName)
      setLastName(viewer.lastName || fallbackName.lastName)
      setSelectedCategories(viewer.onboardingCategories ?? [])
      setBio(viewer.bio || '')
      setApproxLocation(
        typeof viewer.approximateLatitude === 'number' && typeof viewer.approximateLongitude === 'number'
          ? { latitude: viewer.approximateLatitude, longitude: viewer.approximateLongitude }
          : null,
      )
      setCompanionMode('both')
      setCompanionRate(companionProfileDefaults.defaultRatePesos)
      setCompanionCity('')
      setCompanionIntro('')
      setTermsAccepted(false)
      setPrivacyAccepted(false)
      setLocationStatus('')
      setError('')
      // Completed legacy accounts routed here for one-time reacceptance land
      // directly on the final review with their saved name and location.
      setStep(
        viewer.onboardingCompletedAt
        && !hasCurrentUnifiedAcceptance(viewer)
        && viewer.username
        && isRoundedCoordinate(viewer.approximateLatitude)
        && isRoundedCoordinate(viewer.approximateLongitude)
          ? 5
          : 1,
      )
      return
    }
    // Same account refetch: merge server data without touching local edits
    // or unchecking either box.
    setUsername((current) => current || viewer.username || '')
    setGoal((current) => current ?? viewer.onboardingGoal)
    const fallbackName = splitExistingName(viewer.displayName)
    setFirstName((current) => current || viewer.firstName || fallbackName.firstName)
    setLastName((current) => current || viewer.lastName || fallbackName.lastName)
    setSelectedCategories((current) => current.length > 0 ? current : viewer.onboardingCategories ?? [])
    setBio((current) => current || viewer.bio || '')
    if (typeof viewer.approximateLatitude === 'number' && typeof viewer.approximateLongitude === 'number') {
      setApproxLocation((current) => current ?? { latitude: viewer.approximateLatitude!, longitude: viewer.approximateLongitude! })
    }
  }, [viewer])

  if (!isSignedIn) {
    return (
      <main className="onboarding-page">
        <div className="onboarding-intro">
          <h1 className="text-display mt-4">What would you like to do together?</h1>
          <SignInButton mode="modal">
            <Button intent="self" size="large" className="mt-6">Sign in to continue</Button>
          </SignInButton>
        </div>
      </main>
    )
  }

  if (!viewer) return <main className="gate-state"><div className="gate-state-inner">Loading your welcome guide…</div></main>

  const selectedGoal = goal ?? 'member'
  const journey = selectedGoal === 'companion' ? companionJourney : memberJourney
  // An account with current persisted acceptance shows a read-only notice and
  // no checkboxes. New or legacy accounts must check both Step 5 boxes, and
  // both checkbox states gate their finishing actions.
  const alreadyAccepted = hasCurrentUnifiedAcceptance(viewer)
  const acceptanceSatisfied = alreadyAccepted || (termsAccepted && privacyAccepted)

  const saveUsernameAndContinue = async () => {
    if (submitting) return
    if (!approxLocation) {
      setError('Use your device location before continuing.')
      return
    }
    if (localUsernameError && !viewer.username) {
      setError(localUsernameError)
      return
    }
    if (!viewer.username && usernameAvailability === undefined) {
      setError('Wait while we check that username.')
      return
    }
    if (!viewer.username && !usernameAvailability?.available) {
      setError(usernameAvailability?.validationError || 'That username is already taken.')
      return
    }

    // Step 1 keeps the username choice and rounded location preview in local
    // state only. The rounded location and Companion details are saved only
    // after the unified Step 5 acceptance. Profile name and bio save as you go.
    setError('')
    setStep(2)
  }

  const persistUnifiedAcceptance = async () => {
    if (!approxLocation) throw new Error('Use your device location before continuing.')
    if (!acceptanceSatisfied) {
      throw new Error(acceptanceError)
    }
    if (!viewer.username) {
      const savedUsername = await claimUsername({ username: normalizedUsername })
      setUsername(savedUsername)
    }
    await saveOnboardingLocationAndConsent({
      ...roundCoordinates(approxLocation),
      locationConsent: true,
      termsAccepted: true,
      termsVersion: policyVersion,
      privacyAccepted: true,
      privacyVersion: policyVersion,
      identityAccepted: true,
      identityVersion: policyVersion,
    })
  }

  const acceptanceError = 'Agree to both the Terms and Conditions and the Privacy Policy in Step 5 before continuing.'

  const saveProfileAndContinue = async () => {
    if (submitting) return
    const cleanFirstName = firstName.trim()
    const cleanLastName = lastName.trim()
    if (!cleanFirstName || !cleanLastName) {
      setError('Enter your first and last name.')
      return
    }
    if (selectedGoal !== 'companion' && !bio.trim()) {
      setError('Add a short bio about the skills, talents, or everyday help you can share.')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      await updateProfile({
        displayName: `${cleanFirstName} ${cleanLastName}`,
        firstName: cleanFirstName,
        lastName: cleanLastName,
        bio: bio.trim(),
        onboardingCategories: selectedGoal === 'companion' ? selectedCategories : undefined,
      })
      setStep(4)
    } catch (profileError) {
      setError(profileError instanceof Error ? describeConvexError(profileError) : 'Your profile could not be updated.')
    } finally {
      setSubmitting(false)
    }
  }

  const verification = memberVerificationPresentation(
    identityEntitlementStatus(viewer.verificationStatus, viewer.identityEligible),
    latestIdentityVerification,
  )

  const finishWithIdentityReview = async () => {
    if (submitting || identityFlow.busy) return
    if (!acceptanceSatisfied) {
      setError(acceptanceError)
      return
    }
    setSubmitting(true)
    setError('')
    try {
      await persistUnifiedAcceptance()
      await completeOnboarding({ goal: 'member' })
      if (verification.state === 'approved' || verification.action === 'none') {
        await navigate({ to: '/app' })
        return
      }
      const result = await identityFlow.begin()
      if (result?.mode !== 'launch') await navigate({ to: '/app' })
    } catch (submitError) {
      setError(submitError instanceof Error ? describeConvexError(submitError) : 'Identity verification could not be started.')
    } finally {
      setSubmitting(false)
    }
  }

  const isApprovedFinal = verification.state === 'approved' || verification.action === 'none'
  const memberLoadingLabel = isApprovedFinal ? 'Finishing setup…' : 'Opening identity check...'
  const companionLoadingLabel = isApprovedFinal ? 'Saving…' : 'Opening identity check...'
  const identityActionLabel = verification.state === 'approved'
    ? 'Finish setup'
    : verification.action === 'none'
      ? 'View verification status'
      : verification.action === 'continue'
        ? 'Continue identity check'
        : verification.action === 'retry'
          ? 'Start a new identity check'
          : 'Verify identity'

  const companionValues: CompanionProfileValues = {
    mode: companionMode,
    hourlyRatePesos: companionRate,
    city: companionCity,
    bio,
    intro: companionIntro,
  }
  const updateCompanionValues = (patch: Partial<CompanionProfileValues>) => {
    if (patch.mode !== undefined) setCompanionMode(patch.mode)
    if (patch.hourlyRatePesos !== undefined) setCompanionRate(patch.hourlyRatePesos)
    if (patch.city !== undefined) setCompanionCity(patch.city)
    if (patch.bio !== undefined) setBio(patch.bio)
    if (patch.intro !== undefined) setCompanionIntro(patch.intro)
  }

  const finishCompanionWithIdentityReview = async () => {
    if (submitting || companionIdentityFlow.busy) return
    const validation = validateCompanionProfile(companionValues, selectedCategories)
    if (!validation.ok) {
      setError(validation.message)
      return
    }
    if (!acceptanceSatisfied) {
      setError(acceptanceError)
      return
    }
    setSubmitting(true)
    setError('')
    try {
      await persistUnifiedAcceptance()
      await submitCompanionProfile(buildCompanionProfilePayload(companionValues, selectedCategories))
      await completeOnboarding({ goal: 'companion' })
      if (verification.state === 'approved' || verification.action === 'none') {
        await navigate({ to: onboardingDestination('companion') })
        return
      }
      const result = await companionIdentityFlow.begin()
      if (result?.mode !== 'launch') await navigate({ to: onboardingDestination('companion') })
    } catch (submitError) {
      setError(submitError instanceof Error ? describeConvexError(submitError) : 'Your welcome guide could not be completed. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  // Returning Companion users reaccepting policies only: save acceptance and
  // complete without touching the existing Companion profile.
  const finishAcceptOnly = async (nextGoal: OnboardingGoal) => {
    if (submitting) return
    if (!acceptanceSatisfied) {
      setError(acceptanceError)
      return
    }
    setSubmitting(true)
    setError('')
    try {
      await persistUnifiedAcceptance()
      await completeOnboarding({ goal: nextGoal })
      await navigate({ to: onboardingDestination(nextGoal) })
    } catch (submitError) {
      setError(submitError instanceof Error ? describeConvexError(submitError) : 'Your acceptance could not be saved. Please try again.')
      setSubmitting(false)
    }
  }

  // Returning users reaccepting policies keep their existing Companion
  // profile untouched: acceptance plus completion only, no profile rewrite.
  const isReacceptance = Boolean(viewer.onboardingCompletedAt)

  const companionIdentityActionLabel = verification.state === 'approved' || verification.action === 'none'
    ? 'Save Companion profile and finish'
    : 'Save and verify identity'

  return (
    <main className="onboarding-page">
      <header className="onboarding-intro">
        <h1 className="text-h1 mt-3">Let’s start with what brings you here.</h1>
      </header>

      <ol className="onboarding-progress" aria-label="Onboarding progress">
        {['Username', 'Your goal', 'Your profile', 'How it works', 'Ready'].map((label, index) => {
          const number = index + 1
          return (
            <li key={label} data-active={number === step} data-complete={number < step}>
              <button
                type="button"
                disabled={number > step}
                onClick={() => setStep(number)}
                aria-current={number === step ? 'step' : undefined}
              >
                <span>{number}</span>
                <strong>{label}</strong>
              </button>
            </li>
          )
        })}
      </ol>

      <section className="onboarding-stage" data-step={step} aria-live="polite">
        {step === 1 && (
          <div>
            <p className="eyebrow">Step 1</p>
            <h2 className="text-h1 mt-2">Choose your unique username.</h2>
            <p className="text-body muted mt-2">People can use it to find the right profile directly. Your username is public, unique, and permanent once saved.</p>
            <div className="onboarding-username-card mt-6">
              {viewer.username ? (
                <div className="onboarding-username-locked" aria-label={`Your permanent username is @${viewer.username}`}>
                  <span className="label">Your username</span>
                  <strong>@{viewer.username}</strong>
                  <p>This username is set and cannot be changed.</p>
                </div>
              ) : (
                <>
                  <label className="field-row" htmlFor="onboarding-username">
                    <span className="label">Username</span>
                    <span className="onboarding-username-field" data-invalid={Boolean(username && localUsernameError)}>
                      <span aria-hidden="true">@</span>
                      <input
                        id="onboarding-username"
                        value={username}
                        minLength={3}
                        maxLength={24}
                        autoComplete="username"
                        autoCapitalize="none"
                        spellCheck={false}
                        aria-describedby="onboarding-username-status onboarding-username-rules"
                        aria-invalid={Boolean(username && (localUsernameError || usernameAvailability?.available === false))}
                        placeholder="your_username"
                        onChange={(event) => {
                          setUsername(event.currentTarget.value.replace(/^@+/, '').toLowerCase())
                          setError('')
                        }}
                      />
                    </span>
                  </label>
                  <p id="onboarding-username-rules" className="field-row-help">Use 3 to 24 letters, numbers, or underscores. Start and end with a letter or number.</p>
                  <p
                    id="onboarding-username-status"
                    className="onboarding-username-status"
                    data-tone={username && localUsernameError
                      ? 'danger'
                      : usernameAvailability?.available === false
                        ? 'danger'
                        : usernameAvailability?.available
                          ? 'success'
                          : 'neutral'}
                    role="status"
                  >
                    {!username
                      ? 'Enter the username people should search for.'
                      : localUsernameError
                        ? localUsernameError
                        : usernameAvailability === undefined
                          ? 'Checking availability…'
                          : usernameAvailability.available
                            ? `@${normalizedUsername} is available.`
                            : usernameAvailability.validationError || `@${normalizedUsername} is already taken.`}
                  </p>
                </>
              )}
            </div>

            <div className="onboarding-location-card mt-6">
              <div>
                <p className="label">Your approximate location</p>
                <p className="text-meta mt-1">Add your device location to preview your rounded discovery area. Nothing is saved until Step 5.</p>
              </div>
              <div className="flex gap-2 flex-wrap">
                <Button
                  intent="self"
                  size="small"
                  onClick={() => {
                    if (!navigator.geolocation) {
                      setLocationStatus('Location is not available in this browser. Try another browser or device.')
                      return
                    }
                    setLocationStatus('Asking for your device location...')
                    navigator.geolocation.getCurrentPosition(
                      (position) => {
                        setApproxLocation(roundCoordinates({ latitude: position.coords.latitude, longitude: position.coords.longitude }))
                        setLocationStatus('Device location applied to this preview. Only the two-decimal rounded result will be saved in Step 5.')
                      },
                      (locationError) => setLocationStatus(deviceLocationErrorMessage(locationError.code)),
                      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 },
                    )
                  }}
                >
                  Use device location
                </Button>
              </div>
              <div>
                <ApproximateLocationMap
                  location={approxLocation}
                  title={approxLocation ? 'Your approximate discovery area' : 'Your location preview'}
                  description="Use your device location above. Only coordinates rounded to two decimals will be saved in Step 5."
                />
              </div>
              {locationStatus && <p className="text-meta mt-2" role="status" aria-live="polite">{locationStatus}</p>}
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <p className="eyebrow">Step 2</p>
            <h2 className="text-h1 mt-2">What would you like to do here?</h2>
            <p className="text-body muted mt-2">Start by finding help or offering the everyday Strengths you already use. You can choose the other path anytime.</p>
            <fieldset className="onboarding-choice-group mt-6">
              <legend>How would you like to take part?</legend>
              <div className="onboarding-choice-list">
                <label data-selected={selectedGoal === 'member'}>
                  <input
                    className="onboarding-choice-input"
                    type="radio"
                    name="onboarding-goal"
                    value="member"
                    checked={selectedGoal === 'member'}
                    onChange={() => setGoal('member')}
                  />
                  <span className="onboarding-choice-marker" aria-hidden="true">01</span>
                  <span><strong>Find a Companion</strong><small>Find everyday help, friendly company, or someone for an online or nearby plan.</small></span>
                </label>
                <label data-selected={selectedGoal === 'companion'}>
                  <input
                    className="onboarding-choice-input"
                    type="radio"
                    name="onboarding-goal"
                    value="companion"
                    checked={selectedGoal === 'companion'}
                    onChange={() => setGoal('companion')}
                  />
                  <span className="onboarding-choice-marker" aria-hidden="true">02</span>
                  <span><strong>Become a Companion</strong><small>Share your Strengths, choose what you offer, and earn on your terms.</small></span>
                </label>
              </div>
            </fieldset>
          </div>
        )}

        {step === 3 && (
          <div>
            <p className="eyebrow">Step 3</p>
            <h2 className="text-h1 mt-2">{selectedGoal === 'companion' ? 'Confirm your name.' : 'Confirm your public profile.'}</h2>
            <p className="text-body muted mt-2">{selectedGoal === 'companion'
              ? 'Add the name members will see. You will add your introduction and activities in the Companion profile step.'
              : 'Add the name and short introduction you want members to see. A profile photo can be added later from Profile.'}</p>
            <div className="onboarding-fields mt-6">
              <div className="onboarding-name-fields">
                <FormField label="First name">
                  <Input autoComplete="given-name" value={firstName} maxLength={40} onChange={(event) => setFirstName(event.currentTarget.value)} />
                </FormField>
                <FormField label="Last name">
                  <Input autoComplete="family-name" value={lastName} maxLength={40} onChange={(event) => setLastName(event.currentTarget.value)} />
                </FormField>
              </div>
              {selectedGoal !== 'companion' && (
              <label className="field-row">
                <span className="label">Bio <span className="label-aux">required</span></span>
                <Textarea required className="min-h-28" value={bio} maxLength={500} onChange={(event) => setBio(event.currentTarget.value)} placeholder="For example: I can help you practice a new language, and I make everyday errands more fun." />
              </label>
              )}
            </div>
          </div>
        )}

        {step === 4 && (
          <div>
            <p className="eyebrow">Step 4</p>
            <h2 className="text-h1 mt-2">{selectedGoal === 'companion' ? 'How helping and earning works.' : 'What happens before you meet.'}</h2>
            <ol className="onboarding-journey mt-6">
              {journey.map(([title, copy], index) => (
                <li key={title}>
                  <span>{index + 1}</span>
                  <div><strong>{title}</strong><p>{copy}</p></div>
                </li>
              ))}
            </ol>
          </div>
        )}

        {step === 5 && selectedGoal === 'member' && (
          <div className="onboarding-complete">
            <span className="onboarding-complete-mark" aria-hidden="true"><Check size={22} strokeWidth={2.25} /></span>
            <div>
              <p className="eyebrow">Step 5</p>
              <h2 className="text-h1 mt-2">Review and accept to finish.</h2>
              <p className="lede mt-3">
                {alreadyAccepted
                  ? 'Your acceptance is already recorded. Continue below when you are ready.'
                  : verification.state === 'approved'
                    ? 'Your identity check and safety review are approved. Agree to both documents below, then continue to Bookings when you are ready.'
                    : verification.action === 'none'
                      ? `${verification.guidance} Agree to both documents below, then continue to Bookings to follow its status, or explore after acceptance.`
                      : 'Agree to both documents below, then complete a private government ID check and current selfie capture. Every submission is reviewed by the safety team before booking unlocks.'}
              </p>
              {viewer.onboardingCompletedAt && <p className="onboarding-complete-note mt-4">Your welcome guide is already complete. Finishing again keeps your account setup intact.</p>}
              {alreadyAccepted ? (
                <AlreadyAcceptedNotice />
              ) : (
                <AcceptanceCheckboxes
                  termsChecked={termsAccepted}
                  privacyChecked={privacyAccepted}
                  onTermsChange={setTermsAccepted}
                  onPrivacyChange={setPrivacyAccepted}
                  disabled={submitting}
                />
              )}
            </div>
          </div>
        )}

        {step === 5 && selectedGoal === 'companion' && (
          <div className="onboarding-complete">
            <span className="onboarding-complete-mark" aria-hidden="true"><Check size={22} strokeWidth={2.25} /></span>
            <div>
              <p className="eyebrow">Step 5</p>
              <h2 className="text-h1 mt-2">Set up your Companion profile.</h2>
              <p className="lede mt-3">
                {isReacceptance
                  ? 'Agree to both documents below to finish. Your existing Companion profile stays exactly as it is.'
                  : 'Choose how you meet, set your amount, and describe the work or skills you can share. Your Companion details are saved only after you accept below, and identity verification is the only review step.'}
              </p>
              {viewer.onboardingCompletedAt && <p className="onboarding-complete-note mt-4">Your welcome guide is already complete. Finishing again keeps your account setup intact.</p>}
              {!isReacceptance && (
                <>
                  <div className="onboarding-fields mt-6">
                    <CompanionProfileFields
                      values={companionValues}
                      onChange={updateCompanionValues}
                      selectedCategories={selectedCategories}
                      onCategoriesChange={setSelectedCategories}
                    />
                  </div>
                  <div className="onboarding-identity-after-application mt-6">
                    <h3 className="text-h3">Next: identity verification</h3>
                    <p className="text-body muted mt-2">
                      {verification.state === 'approved'
                        ? 'Your identity check is approved. Accept below, then continue to your Companion profile when you are ready.'
                        : 'After acceptance, complete a private government ID check and current selfie capture. Every submission is reviewed by the safety team.'}
                    </p>
                  </div>
                </>
              )}
              {alreadyAccepted ? (
                <AlreadyAcceptedNotice />
              ) : (
                <AcceptanceCheckboxes
                  termsChecked={termsAccepted}
                  privacyChecked={privacyAccepted}
                  onTermsChange={setTermsAccepted}
                  onPrivacyChange={setPrivacyAccepted}
                  disabled={submitting}
                />
              )}
            </div>
          </div>
        )}

        {identityFlow.message && <div className="mt-6"><InlineNotice tone="success">{identityFlow.message}</InlineNotice></div>}
        {(error || identityFlow.error || companionIdentityFlow.error) && <div className="mt-6"><InlineNotice tone="danger">{companionIdentityFlow.error || identityFlow.error || error}</InlineNotice></div>}

        <footer className="onboarding-actions">
          <div className="onboarding-actions-row">
            {step > 1 && (
              <Button
                intent="neutral"
                className="onboarding-back"
                aria-label="Back to the previous step"
                title="Back"
                disabled={submitting}
                onClick={() => { setError(''); setStep((current) => current - 1) }}
              >
                <ArrowLeft size={18} aria-hidden="true" />
              </Button>
            )}
            {step === 1 && <Button intent="self" disabled={submitting || !approxLocation || (!viewer.username && (Boolean(localUsernameError) || usernameAvailability === undefined || !usernameAvailability.available))} onClick={() => void saveUsernameAndContinue()}>Continue</Button>}
            {step === 2 && <Button intent="self" onClick={() => setStep(3)}>Continue</Button>}
            {step === 3 && <Button intent="self" disabled={submitting} onClick={() => void saveProfileAndContinue()}>{submitting ? 'Saving…' : 'Save and continue'}</Button>}
            {step === 4 && <Button intent="self" onClick={() => setStep(5)}>Continue</Button>}
            {step === 5 && selectedGoal === 'companion' && !isReacceptance && (
              <Button
                intent="self"
                disabled={submitting || companionIdentityFlow.busy || !acceptanceSatisfied}
                onClick={() => void finishCompanionWithIdentityReview()}
              >
                {submitting || companionIdentityFlow.busy ? companionLoadingLabel : companionIdentityActionLabel}
              </Button>
            )}
            {step === 5 && selectedGoal === 'companion' && isReacceptance && (
              <Button
                intent="self"
                disabled={submitting || !acceptanceSatisfied}
                onClick={() => void finishAcceptOnly('companion')}
              >
                {submitting ? 'Saving…' : 'Accept and continue'}
              </Button>
            )}
            {step === 5 && selectedGoal === 'member' && (
              <Button intent="self" disabled={submitting || identityFlow.busy || !acceptanceSatisfied} onClick={() => void finishWithIdentityReview()}>
                {submitting || identityFlow.busy ? memberLoadingLabel : identityActionLabel}
              </Button>
            )}
          </div>
        </footer>
      </section>
    </main>
  )
}

function splitExistingName(displayName: string) {
  const name = displayName.trim()
  if (name.includes(',')) {
    const [lastName, ...firstParts] = name.split(',')
    return { firstName: firstParts.join(',').trim(), lastName: lastName.trim() }
  }
  const parts = name.split(/\s+/)
  if (parts.length < 2) return { firstName: name, lastName: '' }
  return { firstName: parts.slice(0, -1).join(' '), lastName: parts.at(-1) ?? '' }
}
