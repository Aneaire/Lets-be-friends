import { SignInButton, useAuth } from '@clerk/react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { useEffect, useState } from 'react'
import { Check } from 'lucide-react'
import {
  activityCategoryOptions,
  maximumActivityCategoryLength,
  maximumOnboardingActivityCategories,
  normalizeUsername,
  usernameValidationError,
  validateActivityCategories,
} from '@lets-be-friends/shared'
import { api } from '../../convex/_generated/api'
import { ApproximateLocationMap } from '../design-system/organisms/ApproximateLocationMap'
import { roundCoordinates, type Coordinates } from '../lib/geo'
import { deviceLocationErrorMessage, goalForSkip, onboardingDestination, type OnboardingGoal } from '../lib/onboarding'
import { useIdentityVerification } from '../features/identity/IdentityVerificationFlow'
import { OnboardingCompanionApplicationStep } from '../features/companion-application/OnboardingCompanionApplicationStep'
import { companionApplicationSkipDestination } from '../features/companion-application/onboardingCompanionApplication'
import { identityEntitlementStatus, memberVerificationPresentation } from '../lib/memberVerification'

export const Route = createFileRoute('/onboarding')({ component: OnboardingPage })

const termsVersion = '2026-08-13'

const memberJourney = [
  ['Complete identity verification', 'Securely submit a government ID and take a current camera selfie.'],
  ['Receive safety-team approval', 'Every completed identity submission is reviewed before booking access is unlocked.'],
  ['Discover an approved Companion', 'Compare Strengths, interests, availability, boundaries, and reviews before choosing.'],
  ['Send a booking request', 'Choose a category, mode, and time for the Companion to accept or decline.'],
  ['Have the experience and leave a review', 'Messages support safe coordination, and afterward you can share feedback.'],
] as const

const companionJourney = [
  ['Complete your Companion profile', 'Describe the everyday help, Strengths, session formats, and boundaries you can offer.'],
  ['Complete identity and safety review', 'Your application is reviewed before it can appear publicly.'],
  ['Receive approval for public discovery', 'Approval makes your Companion profile visible to members.'],
  ['Help, earn, and connect', 'Accept or decline booking requests, coordinate safely, and earn from completed experiences. You can still book other Companions.'],
] as const

function OnboardingPage() {
  const { isSignedIn } = useAuth()
  const viewer = useQuery(api.users.viewer, isSignedIn ? {} : 'skip')
  const latestIdentityVerification = useQuery(api.users.latestMemberVerification, viewer ? {} : 'skip')
  const updateProfile = useMutation(api.users.updateProfile)
  const claimUsername = useMutation(api.users.claimUsername)
  const saveOnboardingLocationAndConsent = useMutation(api.users.saveOnboardingLocationAndConsent)
  const completeOnboarding = useMutation(api.users.completeOnboarding)
  const identityFlow = useIdentityVerification('member')
  const companionIdentityFlow = useIdentityVerification('companion_application')
  const companionApplication = useQuery(api.companions.myApplication, isSignedIn && viewer ? {} : 'skip')
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [username, setUsername] = useState('')
  const [goal, setGoal] = useState<OnboardingGoal | undefined>()
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [customCategory, setCustomCategory] = useState('')
  const [categoryError, setCategoryError] = useState('')
  const [bio, setBio] = useState('')
  const [approxLocation, setApproxLocation] = useState<Coordinates | null>(null)
  const [pendingDeviceLocation, setPendingDeviceLocation] = useState<Coordinates | null>(null)
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
            <button className="btn btn-self btn-lg mt-6">Sign in to continue</button>
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
    if (selectedGoal === 'companion' && selectedCategories.length === 0) {
      setError('Choose at least one category you would like to offer.')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      await updateProfile({
        displayName: `${cleanFirstName} ${cleanLastName}`,
        firstName: cleanFirstName,
        lastName: cleanLastName,
        bio: bio.trim() || undefined,
        onboardingCategories: selectedGoal === 'companion' ? selectedCategories : undefined,
      })
      setStep(4)
    } catch (profileError) {
      setError(profileError instanceof Error ? profileError.message : 'Your profile could not be updated.')
    } finally {
      setSubmitting(false)
    }
  }

  const addCustomCategory = () => {
    const result = validateActivityCategories(
      [...selectedCategories, customCategory],
      maximumOnboardingActivityCategories,
    )
    if (!result.ok) {
      setCategoryError(result.message)
      return
    }
    setSelectedCategories(result.value)
    setCustomCategory('')
    setCategoryError('')
  }

  const verification = memberVerificationPresentation(
    identityEntitlementStatus(viewer.verificationStatus, viewer.identityEligible),
    latestIdentityVerification,
    viewer.identityTestBypassActive,
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

  const hasCompanionApplication = Boolean(companionApplication)

  const finishCompanionWithIdentityReview = async () => {
    if (submitting || companionIdentityFlow.busy || !hasCompanionApplication) return
    setSubmitting(true)
    setError('')
    try {
      await completeOnboarding({ goal: 'companion' })
      if (verification.state === 'approved' || verification.action === 'none') {
        await navigate({ to: onboardingDestination('companion') })
        return
      }
      const result = await companionIdentityFlow.begin()
      if (result?.mode !== 'launch') await navigate({ to: onboardingDestination('companion') })
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Identity verification could not be started.')
    } finally {
      setSubmitting(false)
    }
  }

  const companionIdentityActionLabel = verification.state === 'approved'
    ? 'Open Companion profile'
    : verification.action === 'none'
      ? 'View verification status'
      : verification.action === 'continue'
        ? 'Continue identity check'
        : verification.action === 'retry'
          ? 'Start a new identity check'
          : 'Verify identity'

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
                <button
                  type="button"
                  className="btn btn-self btn-sm"
                  onClick={() => {
                    if (!navigator.geolocation) {
                      setLocationStatus('Location is not available in this browser. Try another browser or device.')
                      return
                    }
                    setLocationStatus('Asking for your device location...')
                    navigator.geolocation.getCurrentPosition(
                      (position) => {
                        setPendingDeviceLocation({ latitude: position.coords.latitude, longitude: position.coords.longitude })
                        setLocationStatus('Device locations can be exact. Review the warning before applying the rounded result.')
                      },
                      (locationError) => setLocationStatus(deviceLocationErrorMessage(locationError.code)),
                      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 },
                    )
                  }}
                >
                  Use device location
                </button>
              </div>
              {pendingDeviceLocation && (
                <div className="notice notice-warning mt-3" role="alert">
                  <span className="notice-icon">!</span>
                  <span>
                    <strong>Your device location may be exact.</strong> Only the two-decimal rounded result will be saved.
                    <span className="flex gap-2 flex-wrap mt-2">
                      <button type="button" className="btn btn-self btn-sm" onClick={() => {
                        setApproxLocation(roundCoordinates(pendingDeviceLocation))
                        setPendingDeviceLocation(null)
                        setLocationStatus('Rounded device location applied.')
                      }}>Apply rounded location</button>
                      <button type="button" className="btn btn-neutral btn-sm" onClick={() => setPendingDeviceLocation(null)}>Do not apply</button>
                    </span>
                  </span>
                </div>
              )}
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
            <h2 className="text-h1 mt-2">Confirm your public profile.</h2>
            <p className="text-body muted mt-2">Add the name and short introduction you want members to see. A profile photo can be added later from Profile.</p>
            <div className="onboarding-fields mt-6">
              <div className="onboarding-name-fields">
                <label className="field-row">
                  <span className="label">First name</span>
                  <input className="field" autoComplete="given-name" value={firstName} maxLength={40} onChange={(event) => setFirstName(event.currentTarget.value)} />
                </label>
                <label className="field-row">
                  <span className="label">Last name</span>
                  <input className="field" autoComplete="family-name" value={lastName} maxLength={40} onChange={(event) => setLastName(event.currentTarget.value)} />
                </label>
              </div>
              <label className="field-row">
                <span className="label">Bio <span className="label-aux">optional</span></span>
                <textarea className="field min-h-28" value={bio} maxLength={500} onChange={(event) => setBio(event.currentTarget.value)} placeholder="I can join you for your grocery trip and make it more fun." />
              </label>
              {selectedGoal === 'companion' && (
                <fieldset className="onboarding-category-field">
                  <legend className="label">What would you like to offer? <span className="label-aux">choose up to 6</span></legend>
                  <p className="field-row-help">Choose the everyday help and activities you feel comfortable offering. You can refine these before submitting your Companion profile.</p>
                  <div className="onboarding-category-grid mt-3">
                    {activityCategoryOptions(selectedCategories).map((category) => {
                      const selected = selectedCategories.includes(category)
                      return (
                        <label key={category} data-selected={selected}>
                          <input
                            type="checkbox"
                            checked={selected}
                            disabled={!selected && selectedCategories.length >= maximumOnboardingActivityCategories}
                            onChange={() => setSelectedCategories((current) => selected
                              ? current.filter((value) => value !== category)
                              : [...current, category])}
                          />
                          <span>{category}</span>
                        </label>
                      )
                    })}
                  </div>
                  <div className="category-custom-entry mt-3">
                    <label className="field-row">
                      <span className="label">Add your own category</span>
                      <input
                        className="field"
                        value={customCategory}
                        maxLength={maximumActivityCategoryLength}
                        disabled={selectedCategories.length >= maximumOnboardingActivityCategories}
                        onChange={(event) => {
                          setCustomCategory(event.currentTarget.value)
                          setCategoryError('')
                        }}
                        onKeyDown={(event) => {
                          if (event.key !== 'Enter') return
                          event.preventDefault()
                          addCustomCategory()
                        }}
                        placeholder="For example, museum visits"
                      />
                    </label>
                    <button
                      type="button"
                      className="btn btn-self btn-sm"
                      disabled={selectedCategories.length >= maximumOnboardingActivityCategories}
                      onClick={addCustomCategory}
                    >
                      Add category
                    </button>
                  </div>
                  {categoryError && <p className="field-row-help category-custom-error" role="alert">{categoryError}</p>}
                </fieldset>
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
              <h2 className="text-h1 mt-2">Submit your Companion application.</h2>
              <p className="lede mt-3">
                Complete and submit your Companion profile below. Applying starts review, and it does not guarantee approval. After submitting, continue to identity verification.
              </p>
              {viewer.onboardingCompletedAt && <p className="onboarding-complete-note mt-4">Your welcome guide is already complete. Finishing again keeps your account setup intact.</p>}
              <OnboardingCompanionApplicationStep
                application={companionApplication === undefined
                  ? undefined
                  : companionApplication === null
                    ? null
                    : { status: companionApplication.status, updatedAt: companionApplication.updatedAt }}
                viewerBio={viewer.bio}
                viewerCategories={viewer.onboardingCategories}
                onSubmitted={() => setError('')}
              />
              {hasCompanionApplication && (
                <div className="onboarding-identity-after-application mt-6">
                  <h3 className="text-h3">Next: identity verification</h3>
                  <p className="text-body muted mt-2">
                    {verification.state === 'approved'
                      ? 'Your identity check is approved. Continue to your Companion profile when you are ready.'
                      : 'Complete a private government ID check and current selfie capture now. Every submission is reviewed by the safety team.'}
                  </p>
                </div>
              )}
              {!hasCompanionApplication && companionApplication !== undefined && (
                <p className="text-meta mt-4">
                  Prefer to apply later? Use Skip for now to finish setup. You can submit your application from {companionApplicationSkipDestination()} at any time.
                </p>
              )}
            </div>
          </div>
        )}

        {identityFlow.message && <div className="notice notice-success mt-6" role="status"><span className="notice-icon">✓</span><span>{identityFlow.message}</span></div>}
        {(error || identityFlow.error || companionIdentityFlow.error) && <div className="notice notice-danger mt-6"><span className="notice-icon">!</span><span>{companionIdentityFlow.error || identityFlow.error || error}</span></div>}

        <footer className="onboarding-actions">
          {step > 1
            ? <button type="button" className="btn btn-ghost" disabled={submitting} onClick={() => void finish(goalForSkip(goal))}>
                {submitting ? 'Saving…' : 'Skip for now'}
              </button>
            : <span />}
          <div className="flex items-center gap-2">
            {step > 1 && <button type="button" className="btn btn-neutral" disabled={submitting} onClick={() => { setError(''); setStep((current) => current - 1) }}>Back</button>}
            {step === 1 && <button type="button" className="btn btn-self" disabled={submitting || !approxLocation || !locationConsent || !termsAccepted || (!viewer.username && (Boolean(localUsernameError) || usernameAvailability === undefined || !usernameAvailability.available))} onClick={() => void saveUsernameAndContinue()}>{submitting ? 'Saving...' : viewer.username ? 'Save and continue' : 'Save setup and continue'}</button>}
            {step === 2 && <button type="button" className="btn btn-self" onClick={() => setStep(3)}>Continue</button>}
            {step === 3 && <button type="button" className="btn btn-self" disabled={submitting} onClick={() => void saveProfileAndContinue()}>{submitting ? 'Saving…' : 'Save and continue'}</button>}
            {step === 4 && <button type="button" className="btn btn-self" onClick={() => setStep(5)}>Continue</button>}
            {step === 5 && selectedGoal === 'companion' && (
              <button
                type="button"
                className="btn btn-self"
                disabled={submitting || companionIdentityFlow.busy || !hasCompanionApplication}
                title={hasCompanionApplication ? undefined : 'Submit your Companion application above before continuing.'}
                onClick={() => void finishCompanionWithIdentityReview()}
              >
                {submitting || companionIdentityFlow.busy ? 'Opening identity check...' : companionIdentityActionLabel}
              </button>
            )}
            {step === 5 && selectedGoal === 'member' && (
              <button type="button" className="btn btn-self" disabled={submitting || identityFlow.busy} onClick={() => void finishWithIdentityReview()}>
                {submitting || identityFlow.busy ? 'Opening identity check...' : identityActionLabel}
              </button>
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
