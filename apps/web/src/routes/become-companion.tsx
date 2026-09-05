import { Link, createFileRoute } from '@tanstack/react-router'
import { SignInButton, useAuth } from '@clerk/react'
import { useMutation, useQuery } from 'convex/react'
import { useEffect, useRef, useState } from 'react'
import type React from 'react'
import {
  activityCategories,
  maximumCompanionActivityCategories,
} from '@lets-be-friends/shared'
import { api } from '../../convex/_generated/api'
import { OpenableImage } from '../design-system/molecules/OpenableImage'
import { ApproximateLocationMap } from '../design-system/organisms/ApproximateLocationMap'
import { ActivityCategoryPicker } from '../features/companion-application/ActivityCategoryPicker'
import {
  clearCompanionApplicationDraft,
  companionLocationReady,
  readCompanionApplicationDraft,
  restoreCompanionEditorStep,
  writeCompanionApplicationDraft,
} from '../features/companion-application/companionApplicationDraft'
import { useIdentityVerification } from '../features/identity/IdentityVerificationFlow'
import { identityEntitlementStatus, memberVerificationPresentation, type MemberVerificationPresentation } from '../lib/memberVerification'
import { geolocationErrorMessage, roundCoordinates, type Coordinates } from '../lib/geo'
import { currentTermsVersion } from '../lib/onboarding'

export const Route = createFileRoute('/become-companion')({ component: BecomeCompanionPage })

const companionEditorSteps = [
  { id: 1, label: 'What you offer' },
  { id: 2, label: 'Activities' },
  { id: 3, label: 'Location' },
] as const

function BecomeCompanionPage() {
  const { isSignedIn } = useAuth()

  return (
    <main className="marketing-page-wide companion-page" data-editor={isSignedIn ? 'true' : 'false'}>
      {isSignedIn ? (
        <header className="companion-editor-intro">
          <div>
            <p className="eyebrow">Companion profile</p>
            <h1 className="text-display">Share what you can offer. Earn on your terms.</h1>
            <p className="text-body muted">Three focused steps. Your existing details stay in place until you save and send changes for review.</p>
          </div>
          <a href="#companion-profile-editor" className="btn btn-self">Open profile editor</a>
        </header>
      ) : (
        <>
          <header className="companion-hero">
            <div className="companion-hero-copy">
              <h1 className="text-display mt-4">What you enjoy doing can help someone and help you earn.</h1>
            </div>
            <div className="companion-hero-visual">
              <figure className="marketing-photo companion-hero-photo">
                <OpenableImage
                  src="/images/marketing/photography-walk.webp"
                  alt="Two friends sharing a photography walk beside a colorful public mural"
                  loading="eager"
                  decoding="async"
                />
              </figure>
              <div className="companion-definition">
                <span className="companion-definition-label">What is a Companion?</span>
                <p>A verified member who offers everyday help, platonic conversation, or shared activities online or in person. Every Companion chooses their availability and rate.</p>
              </div>
            </div>
          </header>

          <section className="companion-benefit-grid" aria-label="What you control">
            <article><span>01</span><h2>Offer what you already enjoy</h2><p>Choose the everyday help and activities that feel natural to you.</p></article>
            <article><span>02</span><h2>Choose how you meet</h2><p>Decide between online and in-person sessions, then set your rate.</p></article>
            <article><span>03</span><h2>Get reviewed before going live</h2><p>Identity and profile review happen before members can find you or send a booking request.</p></article>
          </section>
          <section className="companion-ideas" aria-labelledby="companion-ideas-title">
            <div>
              <p className="eyebrow">You do not need to be an expert</p>
              <h2 id="companion-ideas-title" className="text-display section-display">What feels ordinary to you may be valuable to someone else.</h2>
            </div>
            <div className="companion-idea-list">
              <span>Lead a photo walk</span>
              <span>Practice a language</span>
              <span>Co-work for an afternoon</span>
              <span>Help with shopping or errands</span>
              <span>Play a favorite game</span>
              <span>Offer technology help</span>
            </div>
          </section>
        </>
      )}
      <CompanionAuthPanel />
    </main>
  )
}

function CompanionAuthPanel() {
  const { isSignedIn, userId } = useAuth()
  const formRef = useRef<HTMLFormElement>(null)
  const hydratedDraftKeyRef = useRef<string | null>(null)
  const viewer = useQuery(api.users.viewer)
  const application = useQuery(api.companions.myApplication)
  const latestIdentityVerification = useQuery(api.users.latestMemberVerification, viewer ? {} : 'skip')
  const submit = useMutation(api.companions.submitApplication)
  const saveLocation = useMutation(api.users.saveOnboardingLocationAndConsent)
  const identityFlow = useIdentityVerification('companion_application')
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [currentStep, setCurrentStep] = useState(1)
  const [stepError, setStepError] = useState('')
  const [mode, setMode] = useState<'online' | 'in_person' | 'both'>('both')
  const [city, setCity] = useState('')
  const [hourlyRatePesos, setHourlyRatePesos] = useState('500')
  const [intro, setIntro] = useState('')
  const [bio, setBio] = useState('')
  const [earningMotivation, setEarningMotivation] = useState('')
  const [approximateLocation, setApproximateLocation] = useState<Coordinates | null>(null)
  const [locationConfirmed, setLocationConfirmed] = useState(false)
  const [locationConsent, setLocationConsent] = useState(false)
  const [locationStatus, setLocationStatus] = useState('')
  const [savingLocation, setSavingLocation] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!userId || viewer === undefined || application === undefined) return
    if (hydratedDraftKeyRef.current === userId) return

    if (application) {
      setMode(application.mode)
      setCity(application.city)
      setHourlyRatePesos(String((application.hourlyRateCentavos ?? 50_000) / 100))
      setIntro(application.intro)
      setBio(application.bio ?? viewer?.bio ?? '')
      setEarningMotivation(application.earningMotivation ?? '')
      setSelectedCategories(application.categories)
    } else {
      if (viewer?.bio) setBio(viewer.bio)
      if (viewer?.onboardingCategories?.length) setSelectedCategories(viewer.onboardingCategories)
    }
    if (typeof viewer?.approximateLatitude === 'number' && typeof viewer?.approximateLongitude === 'number') {
      setApproximateLocation({ latitude: viewer.approximateLatitude, longitude: viewer.approximateLongitude })
    }

    const draft = readCompanionApplicationDraft(window.localStorage, userId)
    if (draft) {
      setCurrentStep(restoreCompanionEditorStep(draft.currentStep, draft.editorStepCount, companionEditorSteps.length))
      setMode(draft.mode)
      setCity(draft.city)
      setHourlyRatePesos(draft.hourlyRatePesos)
      setIntro(draft.intro)
      setBio(draft.bio)
      setEarningMotivation(draft.earningMotivation)
      setSelectedCategories(draft.selectedCategories)
      setApproximateLocation(draft.approximateLocation ?? null)
      setLocationConfirmed(draft.locationConfirmed ?? false)
      setLocationConsent(draft.locationConsent ?? false)
    }
    hydratedDraftKeyRef.current = userId
  }, [application, userId, viewer])

  useEffect(() => {
    if (!userId || hydratedDraftKeyRef.current !== userId || saved) return
    writeCompanionApplicationDraft(window.localStorage, userId, {
      currentStep,
      editorStepCount: companionEditorSteps.length,
      mode,
      city,
      hourlyRatePesos,
      intro,
      bio,
      earningMotivation,
      selectedCategories,
      approximateLocation,
      locationConfirmed,
      locationConsent,
    })
  }, [approximateLocation, bio, city, currentStep, earningMotivation, hourlyRatePesos, intro, locationConfirmed, locationConsent, mode, saved, selectedCategories, userId])

  if (!isSignedIn) {
    return (
      <div className="companion-signin">
        <div>
          <h2 className="text-h1 mt-2">Create your Companion profile.</h2>
        </div>
        <SignInButton mode="modal">
          <button className="btn btn-self btn-lg">Sign in to start</button>
        </SignInButton>
      </div>
    )
  }

  if (viewer === undefined || application === undefined || latestIdentityVerification === undefined) {
    return <div className="empty-state">Loading Companion profile...</div>
  }

  const status = application?.status
  const verification = memberVerificationPresentation(
    identityEntitlementStatus(viewer?.verificationStatus ?? 'not_started', viewer?.identityEligible ?? false),
    latestIdentityVerification,
  )

  const changeStep = (nextStep: number) => {
    setCurrentStep(Math.max(1, Math.min(companionEditorSteps.length, nextStep)))
    setStepError('')
    requestAnimationFrame(() => {
      document.getElementById('companion-profile-editor')?.scrollIntoView({ block: 'start' })
    })
  }

  const validateCurrentStep = () => {
    const activeSection = formRef.current?.querySelector<HTMLElement>(`[data-companion-step="${currentStep}"]`)
    const invalidField = activeSection?.querySelector<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(':invalid')
    if (invalidField) {
      invalidField.reportValidity()
      invalidField.focus()
      return false
    }
    if (currentStep === 2 && selectedCategories.length === 0) {
      setStepError('Choose at least one activity before continuing.')
      return false
    }
    if (currentStep === 3 && !companionLocationReady(approximateLocation, locationConfirmed, locationConsent)) {
      setStepError('Use your current location and confirm the location consent before continuing.')
      return false
    }
    setStepError('')
    return true
  }

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      setLocationStatus('Location is not available in this browser. Use a browser or device with location access.')
      return
    }
    setLocationConfirmed(false)
    setLocationStatus('Waiting for location permission...')
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setApproximateLocation(roundCoordinates({ latitude: position.coords.latitude, longitude: position.coords.longitude }))
        setLocationConfirmed(true)
        setLocationStatus('Current location found. Review the approximate point and confirm the consent below.')
        setStepError('')
      },
      (locationError) => {
        setLocationConfirmed(false)
        setLocationStatus(geolocationErrorMessage(locationError.code).replace(' You can also place a pin on the map.', ''))
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 0 },
    )
  }

  return (
    <div className="drawer-companion" id="companion-profile-editor">
      <form
        ref={formRef}
        className="companion-editor-form"
        onSubmit={async (event) => {
          event.preventDefault()
          if (currentStep !== companionEditorSteps.length || !validateCurrentStep() || !approximateLocation) return
          setSaving(true)
          setSavingLocation(true)
          setSaved(false)
          setError('')
          try {
            await saveLocation({
              latitude: approximateLocation.latitude,
              longitude: approximateLocation.longitude,
              locationConsent: true,
              termsAccepted: Boolean(viewer?.termsAcceptedAt && viewer.termsVersion === currentTermsVersion),
              termsVersion: currentTermsVersion,
            })
            await submit({
              intro: intro.trim(),
              city: city.trim(),
              strengths: [],
              categories: selectedCategories,
              boundaries: [],
              mode,
              hourlyRateCentavos: Math.round(Number(hourlyRatePesos) * 100),
              applicationNote: undefined,
              bio: bio.trim() || undefined,
              earningMotivation: earningMotivation.trim(),
            })
            if (userId) clearCompanionApplicationDraft(window.localStorage, userId)
            setSaved(true)
          } catch (submitError) {
            setError(submitError instanceof Error ? submitError.message : 'Your Companion profile could not be saved.')
          } finally {
            setSaving(false)
            setSavingLocation(false)
          }
        }}
      >
        <header className="companion-editor-header">
          <div>
            <div className="companion-editor-heading-line">
              <p className="eyebrow">{status ? 'Manage profile' : 'Create profile'}</p>
              {status && <span className="status-pill" data-tone={statusTone(status)}>{companionStatusLabel(status, verification.state === 'approved')}</span>}
            </div>
            <h2 className="text-h1">{status ? 'Your Companion profile' : 'Create your Companion profile'}</h2>
            <p className="text-meta">Only the final step saves your changes and sends the profile for review.</p>
          </div>
          {application?.status === 'approved' && (
            <Link to="/companion-profile" search={{ companionProfileId: application._id }} className="btn btn-neutral btn-sm">
              View live profile
            </Link>
          )}
        </header>

        <div className="companion-editor-progress" aria-live="polite">
          <span>Step {currentStep} of {companionEditorSteps.length}</span>
          <strong>{companionEditorSteps[currentStep - 1].label}</strong>
          <progress max={companionEditorSteps.length} value={currentStep} aria-label={`Step ${currentStep} of ${companionEditorSteps.length}`} />
        </div>

        {saved && (
          <div className="notice notice-success" role="status">
            <span className="notice-icon">✓</span>
            <span>
              Profile sent for review. Identity and the Companion profile are reviewed separately.
            </span>
          </div>
        )}
        {identityFlow.message && (
          <div className="notice notice-success" role="status" aria-live="polite">
            <span className="notice-icon">✓</span>
            <span>{identityFlow.message}</span>
          </div>
        )}
        {(error || identityFlow.error) && (
          <div className="notice notice-danger" role="alert">
            <span className="notice-icon">!</span>
            <span>{identityFlow.error || error}</span>
          </div>
        )}
        {stepError && <p className="companion-step-error" role="alert">{stepError}</p>}

        <NumberedSection
          n={1}
          active={currentStep === 1}
          title="What you offer"
          rationale="Choose how you want to meet, describe how you can help, and set the amount you receive."
        >
          <fieldset className="companion-mode-fieldset">
            <legend className="label">Session format</legend>
            <div className="companion-mode-options">
              {([
                ['both', 'Online and in-person'],
                ['online', 'Online only'],
                ['in_person', 'In-person only'],
              ] as const).map(([value, label]) => (
                <button key={value} type="button" aria-pressed={mode === value} onClick={() => setMode(value)}>{label}</button>
              ))}
            </div>
          </fieldset>
          <label className="field-row">
            <span className="label">Listed hourly rate <span className="label-aux">PHP</span></span>
            <input
              type="number"
              min="100"
              max="10000"
              step="0.01"
              required
              value={hourlyRatePesos}
              onChange={(event) => setHourlyRatePesos(event.currentTarget.value)}
              className="field"
            />
            <span className="field-row-help">You receive {formatPhpFromPesos(hourlyRatePesos)} for each completed hour. The member's final booking total includes the service fee.</span>
          </label>
          <label className="field-row">
            <span className="label">How would you like to spend time with members? <span className="label-aux">40 to 500 characters</span></span>
            <textarea
              required
              minLength={40}
              maxLength={500}
              value={intro}
              onChange={(event) => setIntro(event.currentTarget.value)}
              className="field min-h-28"
              placeholder="For example: I can help with a shopping trip, explain everyday technology, share local knowledge, or offer an unhurried conversation."
              aria-describedby="companion-intro-help companion-intro-count"
            />
            <span className="companion-field-help-row">
              <span id="companion-intro-help" className="field-row-help">Keep it specific. Avoid romantic, dating, or transactional framing.</span>
              <span id="companion-intro-count" className="field-row-help tabular">{intro.length}/500</span>
            </span>
          </label>
          <label className="field-row">
            <span className="label">Tell me about yourself <span className="label-aux">optional, up to 500 characters</span></span>
            <textarea
              maxLength={500}
              value={bio}
              onChange={(event) => setBio(event.currentTarget.value)}
              className="field min-h-24"
              placeholder="Something personal about your hobbies, family, or work."
              aria-describedby="companion-bio-help companion-bio-count"
            />
            <span className="companion-field-help-row">
              <span id="companion-bio-help" className="field-row-help">This updates your member profile bio and appears on your public profile.</span>
              <span id="companion-bio-count" className="field-row-help tabular">{bio.length}/500</span>
            </span>
          </label>
          <label className="field-row">
            <span className="label">Why do you want to earn with Let&apos;s Be Friends? <span className="label-aux">private, at least 20 characters</span></span>
            <textarea
              required
              minLength={20}
              maxLength={1000}
              value={earningMotivation}
              onChange={(event) => setEarningMotivation(event.currentTarget.value)}
              className="field min-h-24"
              placeholder="Share why you want to earn as a Companion. Only the review team reads this."
            />
          </label>
        </NumberedSection>

        <NumberedSection
          n={2}
          active={currentStep === 2}
          title="Everyday help and activities"
          rationale="Choose what you feel comfortable offering. Every category is reviewed before it appears on your profile."
        >
          <ActivityCategoryPicker
            values={activityCategories}
            selected={selectedCategories}
            setSelected={setSelectedCategories}
            maximum={maximumCompanionActivityCategories}
          />
        </NumberedSection>

        <NumberedSection
          n={3}
          active={currentStep === 3}
          title="Where you are available"
          rationale="Confirm your current location for nearby discovery. The map shows the rounded approximate point that will be saved."
        >
          <label className="field-row">
            <span className="label">{mode === 'online' ? 'Timezone or broad region' : 'City'} <span className="label-aux">{mode === 'online' ? 'optional' : 'required'}</span></span>
            <input
              required={mode !== 'online'}
              value={city}
              onChange={(event) => setCity(event.currentTarget.value)}
              className="field"
              placeholder={mode === 'online' ? 'For example, Philippines, GMT+8' : 'For example, Bacolor'}
            />
          </label>

          <div className="companion-location-capture">
            <div className="companion-location-action">
              <div>
                <strong>Current location required</strong>
                <span>Your browser will ask for permission. We immediately round the result to two decimal places before saving it.</span>
              </div>
              <button type="button" className="btn btn-self" onClick={useCurrentLocation}>
                {locationConfirmed ? 'Refresh my location' : 'Use my current location'}
              </button>
            </div>
            <ApproximateLocationMap
              location={approximateLocation}
              title={locationConfirmed ? 'Your approximate discovery location' : 'Location preview'}
              description={locationConfirmed ? 'This rounded point is what members will see for nearby discovery.' : 'Use your current location to place your approximate point on the map.'}
            />
            {locationStatus && <p className="text-meta" role="status" aria-live="polite">{locationStatus}</p>}
            <label className="identity-consent-row">
              <input type="checkbox" checked={locationConsent} disabled={!locationConfirmed} onChange={(event) => setLocationConsent(event.currentTarget.checked)} />
              <span><strong>Confirm approximate location use</strong><small>I consent to storing and using this rounded location for nearby discovery. My exact address is not saved.</small></span>
            </label>
          </div>
        </NumberedSection>

        <div className="companion-editor-actions">
          {currentStep > 1 ? (
            <button type="button" className="btn btn-neutral" onClick={() => changeStep(currentStep - 1)}>Back</button>
          ) : <span />}
          {currentStep < companionEditorSteps.length ? (
            <button
              type="button"
              className="btn btn-self"
              onClick={() => {
                if (validateCurrentStep()) changeStep(currentStep + 1)
              }}
              disabled={savingLocation}
            >
              {savingLocation ? 'Saving location...' : 'Save and continue'}
            </button>
          ) : (
            <button type="submit" className="btn btn-self" disabled={saving || !companionLocationReady(approximateLocation, locationConfirmed, locationConsent)}>
              {saving ? 'Sending...' : status ? 'Save and send for review' : 'Send profile for review'}
            </button>
          )}
        </div>
      </form>

      <div className="companion-editor-aside">
        <CompanionProfilePreview
          displayName={application?.displayName ?? viewer?.displayName}
          profileImageUrl={application?.profileImageUrl}
          mode={mode}
          city={city}
          intro={intro}
          hourlyRatePesos={hourlyRatePesos}
          categories={selectedCategories}
        />
        <ReviewStatusPanel
          status={status}
          verification={verification}
          canStartIdentity={Boolean(application)}
          identityBusy={identityFlow.busy}
          onStartIdentity={() => void identityFlow.begin()}
        />
      </div>
    </div>
  )
}

function ReviewStatusPanel({
  status,
  verification,
  canStartIdentity,
  identityBusy,
  onStartIdentity,
}: {
  status?: string
  verification: MemberVerificationPresentation
  canStartIdentity: boolean
  identityBusy: boolean
  onStartIdentity: () => void
}) {
  const identityApproved = verification.state === 'approved'
  const statusGuidance = status === 'approved' && identityApproved
    ? 'Your profile is live in Explore. Saving changes sends the updated profile back to review.'
    : status === 'approved'
      ? 'Your profile is approved. Complete identity verification before it can appear in Explore.'
      : status === 'pending_review'
        ? 'Your profile is with the review team. Identity verification is tracked separately.'
        : status === 'rejected'
          ? 'The review team needs changes before this profile can appear in Explore.'
          : 'Complete the five steps and send your profile to begin review.'
  const steps = [
    { id: 'submit', label: 'Application submitted', done: !!status },
    { id: 'identity', label: 'Identity and safety review', done: identityApproved, active: !!status && !identityApproved },
    { id: 'review', label: 'Companion profile review', done: status === 'approved' || status === 'rejected', active: status === 'pending_review' && identityApproved },
    { id: 'live', label: 'Visible in discovery', done: status === 'approved' && identityApproved },
  ]

  return (
    <aside className="drawer">
      <div className="drawer-header">
        <h2 className="text-h3">Review status</h2>
        {status && <span className="status-pill" data-tone={statusTone(status)}>{companionStatusLabel(status, identityApproved)}</span>}
      </div>
      <div className="drawer-body">
        <p className="text-meta companion-status-guidance">{statusGuidance}</p>
        <ol className="companion-review-steps">
          {steps.map((step, index) => (
            <li key={step.id} data-state={step.done ? 'done' : step.active ? 'active' : 'upcoming'}>
              <span className="companion-review-step-marker" aria-hidden="true">
                {step.done ? '✓' : index + 1}
              </span>
              <span className={step.done ? 'text-body' : 'text-body muted'}>{step.label}</span>
            </li>
          ))}
        </ol>
        {canStartIdentity && verification.action !== 'none' && (
          <button type="button" className="btn btn-self btn-sm" disabled={identityBusy} onClick={onStartIdentity}>
            {identityBusy
              ? 'Opening identity check...'
              : verification.action === 'continue'
                ? 'Continue identity check'
                : verification.action === 'retry'
                  ? 'Start a new identity check'
                  : 'Verify identity'}
          </button>
        )}
        <p className="text-meta">{verification.guidance}</p>
        <hr className="divider" />
        <p className="text-meta">
          Need a refresher on what reviewers check?
          <Link to="/safety" className="ml-1 underline underline-offset-2">Read the safety model</Link>.
        </p>
      </div>
    </aside>
  )
}

function statusTone(status: string): 'self' | 'success' | 'warning' | 'danger' {
  if (status === 'approved') return 'success'
  if (status === 'rejected') return 'danger'
  if (status === 'pending_review') return 'warning'
  return 'self'
}

function companionStatusLabel(status: string, identityApproved: boolean) {
  if (status === 'approved' && identityApproved) return 'Live in Explore'
  if (status === 'approved') return 'Profile approved'
  if (status === 'pending_review') return 'In review'
  if (status === 'rejected') return 'Changes requested'
  return status.replaceAll('_', ' ')
}

function formatModeLabel(mode: 'online' | 'in_person' | 'both') {
  if (mode === 'online') return 'Online'
  if (mode === 'in_person') return 'In-person'
  return 'Online and in-person'
}

function formatPhpFromPesos(value: string) {
  const amount = Number(value)
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 2,
  }).format(Number.isFinite(amount) ? amount : 0)
}

function CompanionProfilePreview({
  displayName,
  profileImageUrl,
  mode,
  city,
  intro,
  hourlyRatePesos,
  categories,
}: {
  displayName?: string | null
  profileImageUrl?: string | null
  mode: 'online' | 'in_person' | 'both'
  city: string
  intro: string
  hourlyRatePesos: string
  categories: string[]
}) {
  const name = displayName?.trim() || 'Your profile'
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()

  return (
    <aside className="companion-profile-preview" aria-label="Member profile preview">
      <div className="companion-preview-label"><span>Member preview</span><span>Updates as you type</span></div>
      <div className="companion-preview-person">
        {profileImageUrl ? (
          <OpenableImage
            src={profileImageUrl}
            alt={`${name} profile photo preview`}
            className="companion-preview-avatar"
          />
        ) : (
          <span className="companion-preview-avatar companion-preview-initials" aria-hidden="true">{initials}</span>
        )}
        <div>
          <h3 className="text-h3">{name}</h3>
          <p className="text-meta">{formatModeLabel(mode)}{city.trim() ? ` · ${city.trim()}` : ''}</p>
        </div>
      </div>
      <p className="companion-preview-intro">{intro.trim() || 'Your invitation will appear here as you write it.'}</p>
      {categories.length > 0 && (
        <div className="companion-preview-chips" aria-label="Selected profile details">
          {categories.slice(0, 4).map((value) => <span key={`category-${value}`}>{value}</span>)}
        </div>
      )}
      <div className="companion-preview-rate">
        <span>You receive</span>
        <strong>{formatPhpFromPesos(hourlyRatePesos)} <small>per hour</small></strong>
      </div>
    </aside>
  )
}

function NumberedSection({
  n,
  active,
  title,
  rationale,
  children,
}: {
  n: number
  active: boolean
  title: string
  rationale: string
  children: React.ReactNode
}) {
  return (
    <section className="numbered-section companion-editor-step" data-companion-step={n} hidden={!active}>
      <span className="numbered-section-marker tabular">{n}</span>
      <div className="numbered-section-body">
        <header>
          <h2 className="text-h2">{title}</h2>
          <p className="numbered-section-rationale mt-1">{rationale}</p>
        </header>
        {children}
      </div>
    </section>
  )
}
