import { SignInButton, useAuth } from '@clerk/react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { useEffect, useState } from 'react'
import { Check } from 'lucide-react'
import {
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
import { currentTermsVersion, deviceLocationErrorMessage, goalForSkip, onboardingDestination, type OnboardingGoal } from '../lib/onboarding'
import { useIdentityVerification } from '../features/identity/IdentityVerificationFlow'
import { CompanionProfileFields } from '../features/companion-application/CompanionProfileFields'
import {
  buildCompanionProfilePayload,
  companionProfileDefaults,
  validateCompanionProfile,
  type CompanionProfileMode,
  type CompanionProfileValues,
} from '../features/companion-application/companionProfileForm'
import { identityEntitlementStatus, memberVerificationPresentation } from '../lib/memberVerification'

export const Route = createFileRoute('/onboarding')({ component: OnboardingPage })

const termsVersion = currentTermsVersion

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
  const [locationConsent, setLocationConsent] = useState(false)
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [locationStatus, setLocationStatus] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const normalizedUsername = normalizeUsername(username)
  const localUsernameError = usernameValidationError(username)
  const usernameAvailability = useQuery(
    api.users.usernameAvailability,
    isSignedIn && viewer && !viewer.username && !localUsernameError ? { username: normalizedUsername } : 'skip',
  )

  useEffect(() => {
    if (!viewer) return
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
    setLocationConsent((current) => current || Boolean(viewer.approximateLocationConsentedAt))
    setTermsAccepted((current) => current || Boolean(viewer.termsAcceptedAt && viewer.termsVersion === termsVersion))
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

  const saveUsernameAndContinue = async () => {
    if (submitting) return
    if (!approxLocation) {
      setError('Use your device location before continuing.')
      return
    }
    if (!locationConsent || !termsAccepted) {
      setError('Consent to approximate location use and agreement to the Terms and Conditions are required.')
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

    setSubmitting(true)
    setError('')
    try {
      if (!viewer.username) {
        const savedUsername = await claimUsername({ username: normalizedUsername })
        setUsername(savedUsername)
      }
      await saveOnboardingLocationAndConsent({
        ...roundCoordinates(approxLocation),
        locationConsent,
        termsAccepted,
        termsVersion,
      })
      setStep(2)
    } catch (usernameError) {
      setError(usernameError instanceof Error ? usernameError.message : 'Your username could not be saved.')
    } finally {
      setSubmitting(false)
    }
  }

  const finish = async (nextGoal: OnboardingGoal) => {
    if (submitting) return
    setSubmitting(true)
    setError('')
    try {
      await completeOnboarding({ goal: nextGoal })
      await navigate({ to: onboardingDestination(nextGoal) })
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Your welcome guide could not be completed.')
      setSubmitting(false)
    }
  }

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
      setError(profileError instanceof Error ? profileError.message : 'Your profile could not be updated.')
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
    setSubmitting(true)
    setError('')
    try {
      await completeOnboarding({ goal: 'member' })
      if (verification.state === 'approved' || verification.action === 'none') {
        await navigate({ to: '/app' })
        return
      }
      const result = await identityFlow.begin()
      if (result?.mode !== 'launch') await navigate({ to: '/app' })
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Identity verification could not be started.')
    } finally {
      setSubmitting(false)
    }
  }

  const identityActionLabel = verification.state === 'approved'
    ? 'Open bookings'
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
    setSubmitting(true)
    setError('')
    try {
      await submitCompanionProfile(buildCompanionProfilePayload(companionValues, selectedCategories))
      await completeOnboarding({ goal: 'companion' })
      if (verification.state === 'approved' || verification.action === 'none') {
        await navigate({ to: onboardingDestination('companion') })
        return
      }
      const result = await companionIdentityFlow.begin()
      if (result?.mode !== 'launch') await navigate({ to: onboardingDestination('companion') })
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Your welcome guide could not be completed. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const companionIdentityActionLabel = verification.state === 'approved' || verification.action === 'none'
    ? 'Save Companion profile'
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
                <p className="label">Required approximate location</p>
                <p className="text-meta mt-1">Your rounded location is used continuously for discovery. If you become an approved Companion, your profile is always shown on the nearby map at this approximate location, including for online sessions. Ordinary member profiles are never placed on the map.</p>
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
                        setLocationStatus('Device location applied. Only the two-decimal rounded result is saved.')
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
                  description="Use your device location above. Only coordinates rounded to two decimals are saved."
                />
              </div>
              {locationStatus && <p className="text-meta mt-2" role="status" aria-live="polite">{locationStatus}</p>}
              <div className="onboarding-consent-list mt-4">
                <label>
                  <input type="checkbox" checked={locationConsent} onChange={(event) => setLocationConsent(event.currentTarget.checked)} />
                  <span>I consent to Let&apos;s Be Friends storing and using my rounded approximate location for always-on discovery as described above.</span>
                </label>
                <label>
                  <input type="checkbox" checked={termsAccepted} onChange={(event) => setTermsAccepted(event.currentTarget.checked)} />
                  <span>I agree to the displayed Terms and Conditions.</span>
                </label>
              </div>
              <details className="onboarding-terms mt-3">
                <summary>Terms and Conditions</summary>
                <div>
                  <p>You must provide accurate account information, use discovery and messaging safely, respect boundaries, and follow applicable laws and platform safety rules.</p>
                  <p>Your approximate location is stored at two decimal places and used for discovery. Approved Companions with a saved coordinate pair are shown in nearby discovery. Exact addresses and raw device precision are not stored through onboarding.</p>
                  <p>Version {termsVersion}. You may stop using the service at any time, but required account and safety records may be retained as permitted by law.</p>
                </div>
              </details>
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
              <h2 className="text-h1 mt-2">You&apos;re ready for the next step.</h2>
              <p className="lede mt-3">
                {verification.state === 'approved'
                  ? 'Your identity check and safety review are approved. Continue to Bookings when you are ready.'
                  : verification.action === 'none'
                    ? `${verification.guidance} Continue to Bookings to follow its status, or skip for now and explore.`
                    : 'Complete a private government ID check and current selfie capture now. Every submission is reviewed by the safety team before booking unlocks.'}
              </p>
              {viewer.onboardingCompletedAt && <p className="onboarding-complete-note mt-4">Your welcome guide is already complete. Finishing again keeps your account setup intact.</p>}
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
                Choose how you meet, set your amount, and describe the work or skills you can share. Your details save right away, and identity verification is the only review step.
              </p>
              {viewer.onboardingCompletedAt && <p className="onboarding-complete-note mt-4">Your welcome guide is already complete. Finishing again keeps your account setup intact.</p>}
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
                    ? 'Your identity check is approved. Continue to your Companion profile when you are ready.'
                    : 'Complete a private government ID check and current selfie capture now. Every submission is reviewed by the safety team.'}
                </p>
              </div>
            </div>
          </div>
        )}

        {identityFlow.message && <div className="mt-6"><InlineNotice tone="success">{identityFlow.message}</InlineNotice></div>}
        {(error || identityFlow.error || companionIdentityFlow.error) && <div className="mt-6"><InlineNotice tone="danger">{companionIdentityFlow.error || identityFlow.error || error}</InlineNotice></div>}

        <footer className="onboarding-actions">
          {step > 1
            ? <Button intent="ghost" disabled={submitting} onClick={() => void finish(goalForSkip(goal))}>
                {submitting ? 'Saving…' : 'Skip for now'}
              </Button>
            : <span />}
          <div className="flex items-center gap-2">
            {step > 1 && <Button intent="neutral" disabled={submitting} onClick={() => { setError(''); setStep((current) => current - 1) }}>Back</Button>}
            {step === 1 && <Button intent="self" disabled={submitting || !approxLocation || !locationConsent || !termsAccepted || (!viewer.username && (Boolean(localUsernameError) || usernameAvailability === undefined || !usernameAvailability.available))} onClick={() => void saveUsernameAndContinue()}>{submitting ? 'Saving...' : viewer.username ? 'Save and continue' : 'Save setup and continue'}</Button>}
            {step === 2 && <Button intent="self" onClick={() => setStep(3)}>Continue</Button>}
            {step === 3 && <Button intent="self" disabled={submitting} onClick={() => void saveProfileAndContinue()}>{submitting ? 'Saving…' : 'Save and continue'}</Button>}
            {step === 4 && <Button intent="self" onClick={() => setStep(5)}>Continue</Button>}
            {step === 5 && selectedGoal === 'companion' && (
              <Button
                intent="self"
                disabled={submitting || companionIdentityFlow.busy}
                onClick={() => void finishCompanionWithIdentityReview()}
              >
                {submitting || companionIdentityFlow.busy ? 'Opening identity check...' : companionIdentityActionLabel}
              </Button>
            )}
            {step === 5 && selectedGoal === 'member' && (
              <Button intent="self" disabled={submitting || identityFlow.busy} onClick={() => void finishWithIdentityReview()}>
                {submitting || identityFlow.busy ? 'Opening identity check...' : identityActionLabel}
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
