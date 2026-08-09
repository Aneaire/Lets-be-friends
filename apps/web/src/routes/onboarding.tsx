import { SignInButton, useAuth } from '@clerk/react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { useEffect, useState } from 'react'
import { Check } from 'lucide-react'
import { activityCategories, normalizeUsername, usernameValidationError } from '@lets-be-friends/shared'
import { api } from '../../convex/_generated/api'
import { goalForSkip, onboardingDestination, type OnboardingGoal } from '../lib/onboarding'
import { useIdentityVerification } from '../components/IdentityVerificationFlow'
import { identityEntitlementStatus, memberVerificationPresentation } from '../lib/memberVerification'

export const Route = createFileRoute('/onboarding')({ component: OnboardingPage })

const memberJourney = [
  ['Complete identity verification', 'Securely submit a government ID and take a current camera selfie.'],
  ['Receive safety-team approval', 'Every completed identity submission is reviewed before booking access is unlocked.'],
  ['Discover an approved Friend Host', 'Compare strengths, modes, boundaries, and reviews before choosing.'],
  ['Send a booking request', 'Choose a category, mode, and time for the Friend Host to accept or decline.'],
  ['Have the experience and leave a review', 'Messages support safe coordination, and afterward you can share feedback.'],
] as const

const hostJourney = [
  ['Complete your host profile', 'Describe your strengths, modes, location area, categories, and boundaries.'],
  ['Complete identity and safety review', 'Your application is reviewed before it can appear publicly.'],
  ['Receive approval for public discovery', 'Approval makes your Friend Host profile visible to members.'],
  ['Manage incoming requests', 'Accept or decline requests and use messages for safe coordination. You can still book other Friend Hosts.'],
] as const

function OnboardingPage() {
  const { isSignedIn } = useAuth()
  const viewer = useQuery(api.users.viewer, isSignedIn ? {} : 'skip')
  const latestIdentityVerification = useQuery(api.users.latestMemberVerification, viewer ? {} : 'skip')
  const updateProfile = useMutation(api.users.updateProfile)
  const claimUsername = useMutation(api.users.claimUsername)
  const completeOnboarding = useMutation(api.users.completeOnboarding)
  const identityFlow = useIdentityVerification('member')
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [username, setUsername] = useState('')
  const [goal, setGoal] = useState<OnboardingGoal | undefined>()
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [bio, setBio] = useState('')
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
  const journey = selectedGoal === 'friend_host' ? hostJourney : memberJourney

  const saveUsernameAndContinue = async () => {
    if (submitting) return
    if (viewer?.username) {
      setStep(2)
      return
    }
    if (localUsernameError) {
      setError(localUsernameError)
      return
    }
    if (usernameAvailability === undefined) {
      setError('Wait while we check that username.')
      return
    }
    if (!usernameAvailability.available) {
      setError(usernameAvailability.validationError || 'That username is already taken.')
      return
    }

    setSubmitting(true)
    setError('')
    try {
      const savedUsername = await claimUsername({ username: normalizedUsername })
      setUsername(savedUsername)
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
    if (selectedGoal === 'friend_host' && selectedCategories.length === 0) {
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
        onboardingCategories: selectedGoal === 'friend_host' ? selectedCategories : undefined,
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

  return (
    <main className="onboarding-page">
      {identityFlow.dialog}
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
          </div>
        )}

        {step === 2 && (
          <div>
            <p className="eyebrow">Step 2</p>
            <h2 className="text-h1 mt-2">What would you like to do here?</h2>
            <p className="text-body muted mt-2">Pick what fits you best. You can grow into the other side anytime, and every member still goes through a friendly safety review.</p>
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
                  <span><strong>I need a friends</strong><small>Meet friendly, verified people for fun online or nearby plans together.</small></span>
                </label>
                <label data-selected={selectedGoal === 'friend_host'}>
                  <input
                    className="onboarding-choice-input"
                    type="radio"
                    name="onboarding-goal"
                    value="friend_host"
                    checked={selectedGoal === 'friend_host'}
                    onChange={() => setGoal('friend_host')}
                  />
                  <span className="onboarding-choice-marker" aria-hidden="true">02</span>
                  <span><strong>Be a friend</strong><small>Open a friendly hosting profile with your interests and schedule.</small></span>
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
              {selectedGoal === 'friend_host' && (
                <fieldset className="onboarding-category-field">
                  <legend className="label">What would you like to offer? <span className="label-aux">choose up to 6</span></legend>
                  <p className="field-row-help">Choose the experiences that best describe the time you want to share. You can refine these before submitting your Friend Host profile.</p>
                  <div className="onboarding-category-grid mt-3">
                    {activityCategories.map((category) => {
                      const selected = selectedCategories.includes(category)
                      return (
                        <label key={category} data-selected={selected}>
                          <input
                            type="checkbox"
                            checked={selected}
                            disabled={!selected && selectedCategories.length >= 6}
                            onChange={() => setSelectedCategories((current) => selected
                              ? current.filter((value) => value !== category)
                              : [...current, category])}
                          />
                          <span>{category}</span>
                        </label>
                      )
                    })}
                  </div>
                </fieldset>
              )}
            </div>
          </div>
        )}

        {step === 4 && (
          <div>
            <p className="eyebrow">Step 4</p>
            <h2 className="text-h1 mt-2">{selectedGoal === 'friend_host' ? 'How sharing an experience works.' : 'What happens before you meet.'}</h2>
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

        {step === 5 && (
          <div className="onboarding-complete">
            <span className="onboarding-complete-mark" aria-hidden="true"><Check size={22} strokeWidth={2.25} /></span>
            <div>
              <p className="eyebrow">Step 5</p>
              <h2 className="text-h1 mt-2">You&apos;re ready for the next step.</h2>
              <p className="lede mt-3">
                {selectedGoal === 'friend_host'
                  ? 'Continue to your Friend Host profile. Applying starts review; it does not guarantee approval.'
                  : verification.state === 'approved'
                    ? 'Your identity check and safety review are approved. Continue to Bookings when you are ready.'
                    : verification.action === 'none'
                      ? `${verification.guidance} Continue to Bookings to follow its status, or skip for now and explore.`
                      : 'Complete a private government ID check and current selfie capture now. Every submission is reviewed by the safety team before booking unlocks.'}
              </p>
              {viewer.onboardingCompletedAt && <p className="onboarding-complete-note mt-4">Your welcome guide is already complete. Finishing again keeps your account setup intact.</p>}
            </div>
          </div>
        )}

        {identityFlow.message && <div className="notice notice-success mt-6" role="status"><span className="notice-icon">✓</span><span>{identityFlow.message}</span></div>}
        {(error || identityFlow.error) && <div className="notice notice-danger mt-6"><span className="notice-icon">!</span><span>{identityFlow.error || error}</span></div>}

        <footer className="onboarding-actions">
          {step > 1
            ? <button type="button" className="btn btn-ghost" disabled={submitting} onClick={() => void finish(goalForSkip(goal))}>
                {submitting ? 'Saving…' : 'Skip for now'}
              </button>
            : <span />}
          <div className="flex items-center gap-2">
            {step > 1 && <button type="button" className="btn btn-neutral" disabled={submitting} onClick={() => { setError(''); setStep((current) => current - 1) }}>Back</button>}
            {step === 1 && <button type="button" className="btn btn-self" disabled={!viewer.username && (submitting || Boolean(localUsernameError) || usernameAvailability === undefined || !usernameAvailability.available)} onClick={() => void saveUsernameAndContinue()}>{viewer.username ? 'Continue' : submitting ? 'Saving…' : 'Save username'}</button>}
            {step === 2 && <button type="button" className="btn btn-self" onClick={() => setStep(3)}>Continue</button>}
            {step === 3 && <button type="button" className="btn btn-self" disabled={submitting} onClick={() => void saveProfileAndContinue()}>{submitting ? 'Saving…' : 'Save and continue'}</button>}
            {step === 4 && <button type="button" className="btn btn-self" onClick={() => setStep(5)}>Continue</button>}
            {step === 5 && selectedGoal === 'friend_host' && (
              <button type="button" className="btn btn-self" disabled={submitting} onClick={() => void finish(selectedGoal)}>
                {submitting ? 'Saving…' : 'Create hosting profile'}
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
