import { SignInButton, useAuth } from '@clerk/react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { useEffect, useState } from 'react'
import { api } from '../../convex/_generated/api'
import { goalForSkip, onboardingDestination, type OnboardingGoal } from '../lib/onboarding'

export const Route = createFileRoute('/onboarding')({ component: OnboardingPage })

const memberJourney = [
  ['Discover an approved Friend Host', 'Compare strengths, modes, boundaries, and reviews before choosing.'],
  ['Request a category, mode, and time', 'Share the activity you want and the timing that works for you.'],
  ['Complete identity review if needed', 'A request may pause for a safety check before it reaches the host.'],
  ['Wait for the host decision and messages', 'The host can accept or decline, and messages support safe coordination.'],
  ['Have the experience and leave a review', 'Afterward, share feedback that helps the community make informed choices.'],
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
  const updateProfile = useMutation(api.users.updateProfile)
  const completeOnboarding = useMutation(api.users.completeOnboarding)
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [goal, setGoal] = useState<OnboardingGoal | undefined>()
  const [displayName, setDisplayName] = useState('')
  const [bio, setBio] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!viewer) return
    setGoal((current) => current ?? viewer.onboardingGoal)
    setDisplayName((current) => current || viewer.displayName)
    setBio((current) => current || viewer.bio || '')
  }, [viewer])

  if (!isSignedIn) {
    return (
      <main className="onboarding-page">
        <div className="onboarding-intro">
          <p className="eyebrow">Welcome guide</p>
          <h1 className="text-display mt-4">Start with a clear, safer path.</h1>
          <p className="lede mt-4">Sign in to choose what you want to do, confirm your profile, and review how requests move.</p>
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
    const name = displayName.trim()
    if (!name) {
      setError('Enter the name you want people to see.')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      await updateProfile({ displayName: name, bio: bio.trim() || undefined })
      setStep(3)
    } catch (profileError) {
      setError(profileError instanceof Error ? profileError.message : 'Your profile could not be updated.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="onboarding-page">
      <header className="onboarding-intro">
        <p className="eyebrow">Welcome guide</p>
        <h1 className="text-h1 mt-3">A trust-first start to Let&apos;s Be Friends.</h1>
        <p className="lede mt-2">Four short steps explain the path before you discover or host.</p>
      </header>

      <ol className="onboarding-progress" aria-label="Onboarding progress">
        {['Your goal', 'Your profile', 'How it works', 'Ready'].map((label, index) => {
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

      <section className="onboarding-stage" aria-live="polite">
        {step === 1 && (
          <div>
            <p className="eyebrow">Step 1</p>
            <h2 className="text-h1 mt-2">What brings you here?</h2>
            <p className="text-body muted mt-2">This choice guides your setup. It does not grant Friend Host approval or skip safety review.</p>
            <fieldset className="onboarding-choice-group mt-6">
              <legend>Choose your onboarding goal</legend>
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
                  <span><strong>Find a Friend Host</strong><small>Discover approved people for online or local shared activities.</small></span>
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
                  <span><strong>Become a Friend Host</strong><small>Prepare a profile for identity, safety, and approval review.</small></span>
                </label>
              </div>
            </fieldset>
          </div>
        )}

        {step === 2 && (
          <div>
            <p className="eyebrow">Step 2</p>
            <h2 className="text-h1 mt-2">Confirm your public profile.</h2>
            <p className="text-body muted mt-2">Use the name and short introduction you want members to see. A profile photo can be added later from Profile.</p>
            <div className="onboarding-fields mt-6">
              <label className="field-row">
                <span className="label">Display name</span>
                <input className="field" value={displayName} maxLength={80} onChange={(event) => setDisplayName(event.currentTarget.value)} />
              </label>
              <label className="field-row">
                <span className="label">Bio <span className="label-aux">optional</span></span>
                <textarea className="field min-h-28" value={bio} maxLength={500} onChange={(event) => setBio(event.currentTarget.value)} placeholder="A few words about your interests and what feels comfortable." />
              </label>
            </div>
          </div>
        )}

        {step === 3 && (
          <div>
            <p className="eyebrow">Step 3</p>
            <h2 className="text-h1 mt-2">{selectedGoal === 'friend_host' ? 'How becoming a Friend Host works.' : 'How a booking moves.'}</h2>
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

        {step === 4 && (
          <div>
            <p className="eyebrow">Step 4</p>
            <h2 className="text-h1 mt-2">You&apos;re ready for the next step.</h2>
            <p className="lede mt-3">
              {selectedGoal === 'friend_host'
                ? 'Continue to your Friend Host profile. Applying starts review; it does not guarantee approval.'
                : 'Continue to discovery and compare approved Friend Hosts before requesting a booking.'}
            </p>
            {viewer.onboardingCompletedAt && <p className="text-meta mt-4">Your welcome guide is already complete. Finishing again keeps your account setup intact.</p>}
          </div>
        )}

        {error && <div className="notice notice-danger mt-6"><span className="notice-icon">!</span><span>{error}</span></div>}

        <footer className="onboarding-actions">
          <button type="button" className="btn btn-ghost" disabled={submitting} onClick={() => void finish(goalForSkip(goal))}>
            {submitting ? 'Saving…' : 'Skip for now'}
          </button>
          <div className="flex items-center gap-2">
            {step > 1 && <button type="button" className="btn btn-neutral" disabled={submitting} onClick={() => { setError(''); setStep((current) => current - 1) }}>Back</button>}
            {step === 1 && <button type="button" className="btn btn-self" onClick={() => setStep(2)}>Continue</button>}
            {step === 2 && <button type="button" className="btn btn-self" disabled={submitting} onClick={() => void saveProfileAndContinue()}>{submitting ? 'Saving…' : 'Save and continue'}</button>}
            {step === 3 && <button type="button" className="btn btn-self" onClick={() => setStep(4)}>Continue</button>}
            {step === 4 && <button type="button" className={`btn ${selectedGoal === 'friend_host' ? 'btn-self' : 'btn-social'}`} disabled={submitting} onClick={() => void finish(selectedGoal)}>{submitting ? 'Saving…' : selectedGoal === 'friend_host' ? 'Set up host profile' : 'Discover Friend Hosts'}</button>}
          </div>
        </footer>
      </section>
    </main>
  )
}
