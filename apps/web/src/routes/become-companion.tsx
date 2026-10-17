import { Link, createFileRoute } from '@tanstack/react-router'
import { SignInButton, useAuth } from '@clerk/react'
import { useMutation, useQuery } from 'convex/react'
import { ShieldCheck } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type React from 'react'
import { api } from '../../convex/_generated/api'
import { Button } from '../design-system/atoms/Button'
import { EmptyState, InlineNotice } from '../design-system/molecules/FeedbackState'
import { OpenableImage } from '../design-system/molecules/OpenableImage'
import { CompanionProfileFields } from '../features/companion-application/CompanionProfileFields'
import {
  clearCompanionApplicationDraft,
  readCompanionApplicationDraft,
  writeCompanionApplicationDraft,
} from '../features/companion-application/companionApplicationDraft'
import {
  buildCompanionProfilePayload,
  defaultCompanionProfileValues,
  formatPhpFromPesos,
  validateCompanionProfile,
  type CompanionProfileValues,
} from '../features/companion-application/companionProfileForm'
import { useIdentityVerification } from '../features/identity/IdentityVerificationFlow'
import { WeeklyAvailabilityEditor } from '../features/scheduling/WeeklyAvailabilityEditor'
import { identityEntitlementStatus, memberVerificationPresentation, canOpenCompanionProfile, type MemberVerificationPresentation } from '../lib/memberVerification';
import { describeConvexError } from '../lib/convexErrors'

export const Route = createFileRoute('/become-companion')({
  component: BecomeCompanionPage,
})

export function BecomeCompanionPage() {
  const { isSignedIn } = useAuth()
  const [submitted, setSubmitted] = useState(false)
  const viewer = useQuery(api.users.viewer, isSignedIn ? {} : 'skip')
  const latestIdentityVerification = useQuery(api.users.latestMemberVerification, viewer ? {} : 'skip')
  // Gate the signed-in intro on the same identity eligibility as the editor.
  // While eligibility is loading the gate stays closed so the editor anchor
  // never points at a hidden editor.
  const companionUnlocked = viewer
    ? canOpenCompanionProfile(viewer.identityEligible ?? false, latestIdentityVerification ?? null)
    : false

  return (
    <main className="marketing-page-wide companion-page" data-editor={isSignedIn ? 'true' : 'false'}>
      {isSignedIn && !submitted && companionUnlocked ? (
        <header className="companion-editor-intro">
          <div>
            <p className="eyebrow">Companion profile</p>
            <h1 className="text-display">Share what you can offer. Earn on your terms.</h1>
            <p className="text-body muted">One focused form. Your existing details stay in place until you save changes.</p>
          </div>
          <a href="#companion-profile-editor" className="btn btn-self">Open profile editor</a>
        </header>
      ) : !isSignedIn ? (
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
            <article><span>03</span><h2>Verify your identity once</h2><p>Identity and safety review is the only review step, and members only find you after it is approved.</p></article>
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
      ) : null}
      <CompanionAuthPanel onSubmitted={() => setSubmitted(true)} />
    </main>
  )
}

function CompanionAuthPanel({ onSubmitted }: { onSubmitted: () => void }) {
  const { isSignedIn, userId } = useAuth()
  const hydratedDraftKeyRef = useRef<string | null>(null)
  const viewer = useQuery(api.users.viewer)
  const application = useQuery(api.companions.myApplication)
  const latestIdentityVerification = useQuery(api.users.latestMemberVerification, viewer ? {} : 'skip')
  const sendApplication = useMutation(api.companions.submitApplication)
  const updateAvailability = useMutation(api.companions.updateAvailability)
  const identityFlow = useIdentityVerification('companion_application')
  const [values, setValues] = useState<CompanionProfileValues>(() => defaultCompanionProfileValues())
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!userId || viewer === undefined || application === undefined) return
    if (hydratedDraftKeyRef.current === userId) return

    if (application) {
      setValues(defaultCompanionProfileValues({
        mode: application.mode,
        city: application.city,
        hourlyRatePesos: String((application.hourlyRateCentavos ?? 50_000) / 100),
        bio: application.bio ?? viewer?.bio ?? '',
        intro: application.intro,
      }))
      setSelectedCategories(application.categories)
    } else {
      setValues(defaultCompanionProfileValues({ bio: viewer?.bio ?? '' }))
      if (viewer?.onboardingCategories?.length) setSelectedCategories(viewer.onboardingCategories)
    }

    const draft = readCompanionApplicationDraft(window.localStorage, userId)
    if (draft) {
      setValues(defaultCompanionProfileValues({
        mode: draft.mode,
        city: draft.city,
        hourlyRatePesos: draft.hourlyRatePesos,
        bio: draft.bio,
        intro: draft.intro,
      }))
      setSelectedCategories(draft.selectedCategories)
    }
    hydratedDraftKeyRef.current = userId
  }, [application, userId, viewer])

  useEffect(() => {
    if (!userId || hydratedDraftKeyRef.current !== userId || saved) return
    writeCompanionApplicationDraft(window.localStorage, userId, {
      mode: values.mode,
      city: values.city,
      hourlyRatePesos: values.hourlyRatePesos,
      bio: values.bio,
      intro: values.intro,
      selectedCategories,
    })
  }, [saved, selectedCategories, userId, values])

  const updateValues = (patch: Partial<CompanionProfileValues>) =>
    setValues((current) => ({ ...current, ...patch }))

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
    return <EmptyState title="Loading Companion profile..." />
  }

  const status = application?.status
  const verification = memberVerificationPresentation(
    identityEntitlementStatus(viewer?.verificationStatus ?? 'not_started', viewer?.identityEligible ?? false),
    latestIdentityVerification,
  )

  if (saved) {
    const identityApproved = verification.state === 'approved'
    const pendingSafetyReview = verification.state === 'admin_pending' || verification.state === 'provider_declined'
    return (
      <section className="companion-submission-card" aria-labelledby="companion-submission-title">
        <div className="companion-submission-mark" aria-hidden="true">✓</div>
        <p className="eyebrow">Profile saved</p>
        <h2 id="companion-submission-title" className="text-h1">Your Companion profile is saved</h2>
        {identityApproved ? (
          <p className="text-body muted">
            Your details are saved. Set your availability so members can request a session.
          </p>
        ) : (
          <p className="text-body muted">
            Your details save right away. Your profile stays hidden from discovery until your identity check is approved.
          </p>
        )}
        {!identityApproved && (
          <div className="companion-submission-next">
            <strong>{pendingSafetyReview ? 'Next: safety review' : 'Next: identity verification'}</strong>
            <span>{pendingSafetyReview ? verification.guidance : 'Identity and safety review is the only review step.'}</span>
          </div>
        )}
        <div className="companion-submission-actions">
          {!identityApproved && (
            <Link to="/get-verified" className="btn btn-self btn-lg">View verification status</Link>
          )}
          <Link to="/companion" hash="availability" className={identityApproved ? 'btn btn-self btn-lg' : 'btn btn-neutral btn-lg'}>Set your availability</Link>
          <Link to="/" className="btn btn-neutral btn-lg">Go to home</Link>
        </div>
      </section>
    )
  }

  const companionUnlocked = canOpenCompanionProfile(viewer?.identityEligible ?? false, latestIdentityVerification ?? null)

  if (!companionUnlocked) {
    const needsIdentityAction = verification.action !== 'none'
    return (
      <section className="companion-locked-card" aria-labelledby="companion-locked-title">
        <div className="companion-submission-mark" aria-hidden="true"><ShieldCheck size={28} aria-hidden="true" /></div>
        <p className="eyebrow">Identity check required</p>
        <h2 id="companion-locked-title" className="text-h1">Complete your identity check first</h2>
        <p className="text-body muted">
          Submit your government ID and selfie for safety review before creating a Companion profile. Identity is step 1 and your Companion profile is step 2.
        </p>
        <p className="text-meta companion-locked-guidance">{verification.guidance}</p>
        <p className="text-meta companion-locked-draft-note">Any Companion details you already typed on this device stay saved as a local draft.</p>
        <div className="companion-locked-actions">
          {needsIdentityAction ? (
            <Link
              to="/verify-identity"
              search={{ intent: 'companion_application', returnTo: '/become-companion' }}
              className="btn btn-self btn-lg"
            >
              Verify identity
            </Link>
          ) : (
            <Link to="/get-verified" className="btn btn-self btn-lg">Check identity status</Link>
          )}
          <Link to="/" className="btn btn-neutral btn-lg">Go to home</Link>
        </div>
      </section>
    )
  }

  return (
    <div className="drawer-companion" id="companion-profile-editor">
      <div className="companion-editor-primary">
        <form
          className="companion-editor-form"
          onSubmit={async (event) => {
            event.preventDefault()
            if (saving) return
            const validation = validateCompanionProfile(values, selectedCategories)
            if (!validation.ok) {
              setError(validation.message)
              return
            }
            setSaving(true)
            setSaved(false)
            setError('')
            try {
              await sendApplication(buildCompanionProfilePayload(values, selectedCategories))
              if (userId) clearCompanionApplicationDraft(window.localStorage, userId)
              setSaved(true)
              onSubmitted()
            } catch (submitError) {
              setError(submitError instanceof Error ? describeConvexError(submitError) : 'Your Companion profile could not be saved.')
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
              <p className="text-meta">Your details save right away. Identity and safety review is the only review step.</p>
            </div>
            {application?.status === 'approved' && (
              <Link to="/companion-profile" search={{ companionProfileId: application._id }} className="btn btn-neutral btn-sm">
                View live profile
              </Link>
            )}
          </header>

          {identityFlow.message && (
            <InlineNotice tone="success">{identityFlow.message}</InlineNotice>
          )}
          {(error || identityFlow.error) && (
            <InlineNotice tone="danger">{identityFlow.error || error}</InlineNotice>
          )}

          <section className="companion-editor-step">
            <header>
              <h2 className="text-h2">What you offer</h2>
              <p className="numbered-section-rationale mt-1">Choose how you want to meet, describe the work or skills you can share, and set the amount you receive.</p>
            </header>
            <CompanionProfileFields
              values={values}
              onChange={updateValues}
              selectedCategories={selectedCategories}
              onCategoriesChange={setSelectedCategories}
            />
          </section>

          <div className="companion-editor-actions">
            <Button type="submit" intent="self" disabled={saving}>
              {saving ? 'Saving...' : status ? 'Save changes' : 'Save profile'}
            </Button>
          </div>
        </form>

        {application && (
          <section className="companion-availability-panel" id="companion-availability" aria-labelledby="companion-availability-title">
            <header className="companion-availability-head">
              <div>
                <p className="eyebrow">Booking windows</p>
                <h2 id="companion-availability-title" className="text-h2">Weekly availability</h2>
                <p className="text-meta mt-1">Choose when members can request a session. This saves separately from your profile details.</p>
              </div>
            </header>
            <WeeklyAvailabilityEditor
              initialAvailability={application.weeklyAvailability}
              onSave={async (weeklyAvailability) => {
                await updateAvailability({ weeklyAvailability })
              }}
            />
          </section>
        )}
      </div>

      <div className="companion-editor-aside">
        <CompanionProfilePreview
          displayName={application?.displayName ?? viewer?.displayName}
          profileImageUrl={application?.profileImageUrl}
          mode={values.mode}
          city={values.city}
          intro={values.intro}
          hourlyRatePesos={values.hourlyRatePesos}
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
  // New profiles always save as approved. The pending_review and rejected
  // branches below only cover legacy rows saved under the previous model.
  const statusGuidance = status === 'approved' && identityApproved
    ? 'Your profile is live in Explore. Changes save right away.'
    : status === 'approved'
      ? 'Your profile is saved. Complete identity verification before it can appear in Explore.'
      : status === 'pending_review' || status === 'rejected'
        ? 'This profile was saved under a previous review step. Your details save right away, and identity verification is the only review step.'
        : 'Fill in your profile and save it. Identity verification is the only review step.'
  const steps = [
    { id: 'submit', label: 'Companion profile saved', done: !!status },
    { id: 'identity', label: 'Identity and safety review', done: identityApproved, active: !!status && !identityApproved },
    { id: 'live', label: 'Visible in discovery', done: status === 'approved' && identityApproved },
  ]

  return (
    <aside className="drawer">
      <div className="drawer-header">
        <h2 className="text-h3">Profile status</h2>
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
          <Button intent="self" size="small" disabled={identityBusy} onClick={onStartIdentity}>
            {identityBusy
              ? 'Opening identity check...'
              : verification.action === 'continue'
                ? 'Continue identity check'
                : verification.action === 'retry'
                  ? 'Start a new identity check'
                  : 'Verify identity'}
          </Button>
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
  if (status === 'approved') return 'Profile saved'
  // Legacy rows saved under the previous review model.
  if (status === 'pending_review') return 'Saved'
  if (status === 'rejected') return 'Needs changes'
  return status.replaceAll('_', ' ')
}

function formatModeLabel(mode: 'online' | 'in_person' | 'both') {
  if (mode === 'online') return 'Online'
  if (mode === 'in_person') return 'In-person'
  return 'Online and in-person'
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
