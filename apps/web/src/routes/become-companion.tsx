import { Link, createFileRoute } from '@tanstack/react-router'
import { SignInButton, useAuth } from '@clerk/react'
import { useMutation, useQuery } from 'convex/react'
import { useEffect, useRef, useState } from 'react'
import type React from 'react'
import { activityCategories, friendStrengths } from '@lets-be-friends/shared'
import { api } from '../../convex/_generated/api'
import { useIdentityVerification } from '../components/IdentityVerificationFlow'
import { identityEntitlementStatus, memberVerificationPresentation, type MemberVerificationPresentation } from '../lib/memberVerification'

export const Route = createFileRoute('/become-companion')({ component: BecomeCompanionPage })

const companionEditorSteps = [
  { id: 1, label: 'Your invitation' },
  { id: 2, label: 'Strengths' },
  { id: 3, label: 'Activities' },
  { id: 4, label: 'Location' },
  { id: 5, label: 'Boundaries and review' },
] as const

function BecomeCompanionPage() {
  const { isSignedIn } = useAuth()

  return (
    <main className="marketing-page-wide companion-page" data-editor={isSignedIn ? 'true' : 'false'}>
      {isSignedIn ? (
        <header className="companion-editor-intro">
          <div>
            <p className="eyebrow">Companion profile</p>
            <h1 className="text-display">Shape a clear invitation around what you enjoy.</h1>
            <p className="text-body muted">Five focused steps. Your existing details stay in place until you save and send changes for review.</p>
          </div>
          <a href="#companion-profile-editor" className="btn btn-self">Open profile editor</a>
        </header>
      ) : (
        <>
          <header className="companion-hero">
            <div className="companion-hero-copy">
              <h1 className="text-display mt-4">Make time for something you love. Invite someone along.</h1>
            </div>
            <div className="companion-hero-visual">
              <figure className="marketing-photo companion-hero-photo">
                <img
                  src="/images/marketing/photography-walk.webp"
                  alt="Two friends sharing a photography walk beside a colorful public mural"
                  loading="eager"
                  decoding="async"
                />
              </figure>
              <div className="companion-definition">
                <span className="companion-definition-label">What is a Companion?</span>
                <p>A verified member who offers platonic conversation, shared activities, and friendly company, online or in person. Every Companion chooses their own availability and boundaries.</p>
              </div>
            </div>
          </header>

          <section className="companion-benefit-grid" aria-label="What you control">
            <article><span>01</span><h2>Start with your interests</h2><p>Choose the activities and Strengths that feel natural to you.</p></article>
            <article><span>02</span><h2>Set the boundaries</h2><p>Decide online or in-person, your rate, and what you do not offer.</p></article>
            <article><span>03</span><h2>Get reviewed before going live</h2><p>Identity and profile review happen before members can find you or send a booking request.</p></article>
          </section>
          <section className="companion-ideas" aria-labelledby="companion-ideas-title">
            <div>
              <p className="eyebrow">Your invitation can be simple</p>
              <h2 id="companion-ideas-title" className="text-display section-display">Share the part you already enjoy.</h2>
            </div>
            <div className="companion-idea-list">
              <span>Lead a photo walk</span>
              <span>Practice a language</span>
              <span>Co-work for an afternoon</span>
              <span>Show someone around</span>
              <span>Play a favorite game</span>
              <span>Talk over coffee</span>
            </div>
          </section>
        </>
      )}
      <CompanionAuthPanel />
    </main>
  )
}

function CompanionAuthPanel() {
  const { isSignedIn } = useAuth()
  const formRef = useRef<HTMLFormElement>(null)
  const viewer = useQuery(api.users.viewer)
  const application = useQuery(api.companions.myApplication)
  const latestIdentityVerification = useQuery(api.users.latestMemberVerification, viewer ? {} : 'skip')
  const submit = useMutation(api.companions.submitApplication)
  const setIdentityTestBypass = useMutation(api.users.setIdentityTestBypass)
  const identityFlow = useIdentityVerification('companion_application')
  const [selectedStrengths, setSelectedStrengths] = useState<string[]>(['Good listener'])
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [currentStep, setCurrentStep] = useState(1)
  const [stepError, setStepError] = useState('')
  const [mode, setMode] = useState<'online' | 'in_person' | 'both'>('both')
  const [city, setCity] = useState('')
  const [hourlyRatePesos, setHourlyRatePesos] = useState('500')
  const [intro, setIntro] = useState('')
  const [boundaries, setBoundaries] = useState('Public places only\nNo dating or romantic expectations')
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [testBypassSaving, setTestBypassSaving] = useState(false)
  const [testBypassError, setTestBypassError] = useState('')

  useEffect(() => {
    if (!application) {
      if (viewer?.onboardingCategories?.length) setSelectedCategories(viewer.onboardingCategories)
      return
    }
    setMode(application.mode)
    setCity(application.city)
    setHourlyRatePesos(String((application.hourlyRateCentavos ?? 50_000) / 100))
    setIntro(application.intro)
    setBoundaries(application.boundaries?.join('\n') ?? 'Public places only\nNo dating or romantic expectations')
    setSelectedStrengths(application.strengths.length > 0 ? application.strengths : ['Good listener'])
    setSelectedCategories(application.categories)
  }, [application?._id, application?.updatedAt, viewer?.onboardingCategories])

  if (!isSignedIn) {
    return (
      <div className="companion-signin">
        <div>
          <h2 className="text-h1 mt-2">Create your companion profile.</h2>
        </div>
        <SignInButton mode="modal">
          <button className="btn btn-self btn-lg">Sign in to start</button>
        </SignInButton>
      </div>
    )
  }

  if (viewer === undefined || application === undefined || latestIdentityVerification === undefined) {
    return <div className="empty-state">Loading companion profile...</div>
  }

  const status = application?.status
  const verification = memberVerificationPresentation(
    identityEntitlementStatus(viewer?.verificationStatus ?? 'not_started', viewer?.identityEligible ?? false),
    latestIdentityVerification,
    viewer?.identityTestBypassActive ?? false,
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
    if (currentStep === 2 && selectedStrengths.length === 0) {
      setStepError('Choose at least one Strength before continuing.')
      return false
    }
    if (currentStep === 3 && selectedCategories.length === 0) {
      setStepError('Choose at least one activity before continuing.')
      return false
    }
    setStepError('')
    return true
  }

  return (
    <div className="drawer-companion" id="companion-profile-editor">
      <form
        ref={formRef}
        className="companion-editor-form"
        onSubmit={async (event) => {
          event.preventDefault()
          if (currentStep !== companionEditorSteps.length || !validateCurrentStep()) return
          setSaving(true)
          setSaved(false)
          setError('')
          try {
            const form = new FormData(event.currentTarget)
            await submit({
              intro: intro.trim(),
              city: city.trim(),
              strengths: selectedStrengths,
              categories: selectedCategories,
              boundaries: boundaries.split('\n').map((item) => item.trim()).filter(Boolean),
              mode,
              hourlyRateCentavos: Math.round(Number(hourlyRatePesos) * 100),
              applicationNote: String(form.get('applicationNote') || '') || undefined,
            })
            setSaved(true)
          } catch (submitError) {
            setError(submitError instanceof Error ? submitError.message : 'Your Companion profile could not be saved.')
          } finally {
            setSaving(false)
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
          title="Your invitation"
          rationale="Choose how you want to meet, describe the experience, and set the amount you receive."
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
            <span className="label">How would you spend the time? <span className="label-aux">40 to 500 characters</span></span>
            <textarea
              required
              minLength={40}
              maxLength={500}
              value={intro}
              onChange={(event) => setIntro(event.currentTarget.value)}
              className="field min-h-28"
              placeholder="For example: Join me for an easy coffee, a walk through local history, or an unhurried online conversation."
              aria-describedby="companion-intro-help companion-intro-count"
            />
            <span className="companion-field-help-row">
              <span id="companion-intro-help" className="field-row-help">Keep it specific. Avoid romantic, dating, or transactional framing.</span>
              <span id="companion-intro-count" className="field-row-help tabular">{intro.length}/500</span>
            </span>
          </label>
        </NumberedSection>

        <NumberedSection
          n={2}
          active={currentStep === 2}
          title="Strengths you bring"
          rationale="Choose the qualities you genuinely want to bring to a shared experience."
        >
          <ChipGroup label="Strengths" values={friendStrengths} selected={selectedStrengths} setSelected={setSelectedStrengths} />
        </NumberedSection>

        <NumberedSection
          n={3}
          active={currentStep === 3}
          title="Things you can do together"
          rationale="Choose the activities you feel comfortable companion. Every category is reviewed before it is offered."
        >
          <ChipGroup label="Activities" values={activityCategories} selected={selectedCategories} setSelected={setSelectedCategories} />
        </NumberedSection>

        <NumberedSection
          n={4}
          active={currentStep === 4}
          title="Where you are available"
          rationale="Share a city, timezone, or broad region for context. Your approved Companion profile uses the rounded approximate location saved during onboarding for always-on nearby discovery."
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

          <div className="notice text-meta"><span className="notice-icon">i</span><span>Location is not edited here. Approved Companions are always shown in nearby discovery using the two-decimal approximate location saved during onboarding, including online-only profiles.</span></div>
        </NumberedSection>

        <NumberedSection
          n={5}
          active={currentStep === 5}
          title="Boundaries and review"
          rationale="Tell members what keeps the experience comfortable, then review the profile before sending it."
        >
          <label className="field-row">
            <span className="label">Boundaries <span className="label-aux">one per line</span></span>
            <textarea
              value={boundaries}
              onChange={(event) => setBoundaries(event.currentTarget.value)}
              className="field min-h-24"
            />
          </label>
          <label className="field-row">
            <span className="label">Reviewer note <span className="label-aux">internal only</span></span>
            <textarea
              name="applicationNote"
              defaultValue={application?.applicationNote}
              className="field min-h-20"
              placeholder="Anything trust and safety should know."
            />
          </label>
          <div className="companion-review-summary">
            <div><span>Format</span><strong>{formatModeLabel(mode)}</strong></div>
            <div><span>You receive</span><strong>{formatPhpFromPesos(hourlyRatePesos)} per hour</strong></div>
            <div><span>Strengths</span><strong>{selectedStrengths.length}</strong></div>
            <div><span>Activities</span><strong>{selectedCategories.length}</strong></div>
          </div>
          <div className="companion-mobile-preview">
            <CompanionProfilePreview
              displayName={application?.displayName ?? viewer?.displayName}
              profileImageUrl={application?.profileImageUrl}
              mode={mode}
              city={city}
              intro={intro}
              hourlyRatePesos={hourlyRatePesos}
              strengths={selectedStrengths}
              categories={selectedCategories}
            />
          </div>
          <div className="notice notice-warning text-meta">
            <span className="notice-icon">i</span>
            <span>{status
              ? 'Saving sends the profile back to review. It may not appear in Explore again until the updated version is approved.'
              : 'Sending starts profile review. Identity approval and profile approval are separate steps.'}</span>
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
            >
              Save and continue
            </button>
          ) : (
            <button type="submit" className="btn btn-self" disabled={saving}>
              {saving ? 'Sending…' : status ? 'Save and send for review' : 'Send profile for review'}
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
          strengths={selectedStrengths}
          categories={selectedCategories}
        />
        <ReviewStatusPanel
          status={status}
          verification={verification}
          canStartIdentity={Boolean(application)}
          identityBusy={identityFlow.busy}
          onStartIdentity={() => void identityFlow.begin()}
          testBypassAvailable={viewer?.identityTestBypassAvailable ?? false}
          testBypassActive={viewer?.identityTestBypassActive ?? false}
          testBypassSaving={testBypassSaving}
          testBypassError={testBypassError}
          onTestBypassChange={async (enabled) => {
            if (testBypassSaving) return
            setTestBypassSaving(true)
            setTestBypassError('')
            try {
              await setIdentityTestBypass({ enabled })
            } catch (bypassError) {
              setTestBypassError(bypassError instanceof Error ? bypassError.message : 'Test bypass could not be updated.')
            } finally {
              setTestBypassSaving(false)
            }
          }}
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
  testBypassAvailable,
  testBypassActive,
  testBypassSaving,
  testBypassError,
  onTestBypassChange,
}: {
  status?: string
  verification: MemberVerificationPresentation
  canStartIdentity: boolean
  identityBusy: boolean
  onStartIdentity: () => void
  testBypassAvailable: boolean
  testBypassActive: boolean
  testBypassSaving: boolean
  testBypassError: string
  onTestBypassChange: (enabled: boolean) => void
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
    { id: 'identity', label: testBypassActive ? 'Identity check bypassed for testing' : 'Identity and safety review', done: identityApproved, active: !!status && !identityApproved },
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
        {testBypassAvailable && (
          <div className="identity-test-bypass">
            <span>
              <strong>Testing only</strong>
              <small>Skip identity verification for this account. This does not create a real approval.</small>
            </span>
            <button
              type="button"
              role="switch"
              aria-label="Bypass identity verification for testing"
              aria-checked={testBypassActive}
              className="account-menu-switch"
              data-checked={testBypassActive}
              disabled={testBypassSaving}
              onClick={() => onTestBypassChange(!testBypassActive)}
            >
              <span aria-hidden="true" />
              <strong>{testBypassSaving ? 'Saving' : testBypassActive ? 'On' : 'Off'}</strong>
            </button>
            {testBypassError && <p className="text-meta" role="alert">{testBypassError}</p>}
          </div>
        )}
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
  strengths,
  categories,
}: {
  displayName?: string | null
  profileImageUrl?: string | null
  mode: 'online' | 'in_person' | 'both'
  city: string
  intro: string
  hourlyRatePesos: string
  strengths: string[]
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
          <img src={profileImageUrl} alt="" className="companion-preview-avatar" />
        ) : (
          <span className="companion-preview-avatar companion-preview-initials" aria-hidden="true">{initials}</span>
        )}
        <div>
          <h3 className="text-h3">{name}</h3>
          <p className="text-meta">{formatModeLabel(mode)}{city.trim() ? ` · ${city.trim()}` : ''}</p>
        </div>
      </div>
      <p className="companion-preview-intro">{intro.trim() || 'Your invitation will appear here as you write it.'}</p>
      {(strengths.length > 0 || categories.length > 0) && (
        <div className="companion-preview-chips" aria-label="Selected profile details">
          {strengths.slice(0, 2).map((value) => <span key={`strength-${value}`}>{value}</span>)}
          {categories.slice(0, 2).map((value) => <span key={`category-${value}`}>{value}</span>)}
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

function ChipGroup({
  label,
  values,
  selected,
  setSelected,
}: {
  label: string
  values: readonly string[]
  selected: string[]
  setSelected: (next: string[]) => void
}) {
  return (
    <fieldset className="companion-chip-group">
      <legend className="sr-only">{label}</legend>
      <div className="companion-chip-heading">
        <span>{label}</span>
        <span className="text-meta tabular">{selected.length} selected</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {values.map((value) => {
          const isSelected = selected.includes(value)
          return (
            <button
              type="button"
              key={value}
              data-selected={isSelected}
              aria-pressed={isSelected}
              onClick={() =>
                setSelected(isSelected ? selected.filter((item) => item !== value) : [...selected, value])
              }
              className="chip"
            >
              {value}
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}
