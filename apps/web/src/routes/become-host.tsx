import { Link, createFileRoute } from '@tanstack/react-router'
import { SignInButton, useAuth } from '@clerk/react'
import { useMutation, useQuery } from 'convex/react'
import { useEffect, useState } from 'react'
import type React from 'react'
import { activityCategories, friendStrengths } from '@lets-be-friends/shared'
import { api } from '../../convex/_generated/api'
import { ApproximateLocationMap } from '../components/ApproximateLocationMap'
import { useIdentityVerification } from '../components/IdentityVerificationFlow'
import { geolocationErrorMessage, roundCoordinates, type Coordinates } from '../lib/geo'
import { identityEntitlementStatus, memberVerificationPresentation, type MemberVerificationPresentation } from '../lib/memberVerification'

export const Route = createFileRoute('/become-host')({ component: BecomeHostPage })

function BecomeHostPage() {
  return (
    <main className="marketing-page-wide hosting-page">
      <header className="hosting-hero">
        <div className="hosting-hero-copy">
          <h1 className="text-display mt-4">Make time for something you love. Invite someone along.</h1>
        </div>
        <div className="hosting-hero-visual">
          <figure className="marketing-photo hosting-hero-photo">
            <img
              src="/images/marketing/photography-walk.webp"
              alt="Two friends sharing a photography walk beside a colorful public mural"
              loading="eager"
              decoding="async"
            />
          </figure>
          <div className="hosting-definition">
            <span className="hosting-definition-label">What is a Friend Host?</span>
            <p>A verified member who offers a clear, safe experience built around time together, with clear boundaries and no dating expectations.</p>
          </div>
        </div>
      </header>

      <section className="hosting-benefit-grid" aria-label="What you control">
        <article><span>01</span><h2>Start with your interests</h2><p>Choose the activities and Strengths that feel natural to you.</p></article>
        <article><span>02</span><h2>Set the boundaries</h2><p>Decide online or in-person, your schedule, your rate, and what you do not offer.</p></article>
        <article><span>03</span><h2>Get reviewed before going live</h2><p>Identity and profile review happen before anyone can discover or book you.</p></article>
      </section>
      <section className="hosting-ideas" aria-labelledby="hosting-ideas-title">
        <div>
          <p className="eyebrow">Your invitation can be simple</p>
          <h2 id="hosting-ideas-title" className="text-display section-display">Share the part you already enjoy.</h2>
        </div>
        <div className="hosting-idea-list">
          <span>Lead a photo walk</span>
          <span>Practice a language</span>
          <span>Co-work for an afternoon</span>
          <span>Show someone around</span>
          <span>Play a favorite game</span>
          <span>Talk over coffee</span>
        </div>
      </section>
      <HostAuthPanel />
    </main>
  )
}

function HostAuthPanel() {
  const { isSignedIn } = useAuth()
  const viewer = useQuery(api.users.viewer)
  const application = useQuery(api.hosts.myApplication)
  const latestIdentityVerification = useQuery(api.users.latestMemberVerification, viewer ? {} : 'skip')
  const submit = useMutation(api.hosts.submitApplication)
  const setIdentityTestBypass = useMutation(api.users.setIdentityTestBypass)
  const identityFlow = useIdentityVerification('host_application')
  const [selectedStrengths, setSelectedStrengths] = useState<string[]>(['Good listener'])
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [testBypassSaving, setTestBypassSaving] = useState(false)
  const [testBypassError, setTestBypassError] = useState('')
  const [approxLocation, setApproxLocation] = useState<Coordinates | null>(
    typeof application?.approximateLatitude === 'number' && typeof application?.approximateLongitude === 'number'
      ? { latitude: application.approximateLatitude, longitude: application.approximateLongitude }
      : null,
  )
  const [approximateArea, setApproximateArea] = useState(application?.approximateArea ?? '')
  const [nearbyDiscoveryEnabled, setNearbyDiscoveryEnabled] = useState(application?.nearbyDiscoveryEnabled === true)
  const [pendingDeviceLocation, setPendingDeviceLocation] = useState<Coordinates | null>(null)
  const [locationStatus, setLocationStatus] = useState('')

  useEffect(() => {
    if (!application) {
      if (viewer?.onboardingCategories?.length) setSelectedCategories(viewer.onboardingCategories)
      return
    }
    setSelectedStrengths(application.strengths.length > 0 ? application.strengths : ['Good listener'])
    setSelectedCategories(application.categories)
    setApproxLocation(
      typeof application.approximateLatitude === 'number' && typeof application.approximateLongitude === 'number'
        ? { latitude: application.approximateLatitude, longitude: application.approximateLongitude }
        : null,
    )
    setApproximateArea(application.approximateArea ?? '')
    setNearbyDiscoveryEnabled(application.nearbyDiscoveryEnabled === true)
  }, [application?._id, viewer?.onboardingCategories])

  if (!isSignedIn) {
    return (
      <div className="hosting-signin">
        <div>
          <h2 className="text-h1 mt-2">Create your hosting profile.</h2>
        </div>
        <SignInButton mode="modal">
          <button className="btn btn-self btn-lg">Sign in to start</button>
        </SignInButton>
      </div>
    )
  }

  if (viewer === undefined || application === undefined || latestIdentityVerification === undefined) {
    return <div className="empty-state">Loading host profile...</div>
  }

  const status = application?.status
  const verification = memberVerificationPresentation(
    identityEntitlementStatus(viewer?.verificationStatus ?? 'not_started', viewer?.identityEligible ?? false),
    latestIdentityVerification,
    viewer?.identityTestBypassActive ?? false,
  )

  return (
    <div className="drawer-host">
      <form
        className="min-w-0"
        onSubmit={async (event) => {
          event.preventDefault()
          setSaving(true)
          setSaved(false)
          setError('')
          try {
            const form = new FormData(event.currentTarget)
            await submit({
              intro: String(form.get('intro') || ''),
              city: String(form.get('city') || ''),
              approximateArea: approximateArea.trim() || undefined,
              approximateLatitude: approxLocation?.latitude,
              approximateLongitude: approxLocation?.longitude,
              nearbyDiscoveryEnabled: Boolean(approxLocation && nearbyDiscoveryEnabled),
              strengths: selectedStrengths,
              categories: selectedCategories,
              boundaries: String(form.get('boundaries') || '').split('\n').map((item) => item.trim()).filter(Boolean),
              mode: form.get('mode') as 'online' | 'in_person' | 'both',
              hourlyRateCentavos: Math.round(Number(form.get('hourlyRatePesos')) * 100),
              applicationNote: String(form.get('applicationNote') || '') || undefined,
            })
            setSaved(true)
          } catch (submitError) {
            setError(submitError instanceof Error ? submitError.message : 'Friend Host application could not be saved.')
          } finally {
            setSaving(false)
          }
        }}
      >
        {saved && (
          <div className="notice notice-success mb-6">
            <span className="notice-icon">✓</span>
            <span>
              Application saved. Complete Persona identity verification next; identity and the Friend Host profile are reviewed separately.
            </span>
          </div>
        )}
        {identityFlow.message && (
          <div className="notice notice-success mb-6" role="status" aria-live="polite">
            <span className="notice-icon">✓</span>
            <span>{identityFlow.message}</span>
          </div>
        )}
        {(error || identityFlow.error) && (
          <div className="notice notice-danger mb-6" role="alert">
            <span className="notice-icon">!</span>
            <span>{identityFlow.error || error}</span>
          </div>
        )}

        <NumberedSection
          n={1}
        title="Where you are available"
        rationale="Share a city or online region for context. Nearby discovery is optional and uses a rounded area, not a neighborhood or address."
        >
          <FieldRow name="city" label="City or online region" defaultValue={application?.city ?? ''} />
          <div className="panel p-4">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <p className="label">Near-me discovery</p>
                <p className="text-meta max-w-[54ch]">
                  Optional. Set a broad area by clicking or dragging the blue pin. We round coordinates again
                  when saving. Members see only approximate distance, never this area or your coordinates.
                </p>
              </div>
              <div className="flex gap-2 flex-wrap">
                <button
                  type="button"
                  className="btn btn-self btn-sm"
                  onClick={() => {
                    if (!navigator.geolocation) {
                      setLocationStatus('Location is not available in this browser.')
                      return
                    }
                    setLocationStatus('Asking for your device location…')
                    navigator.geolocation.getCurrentPosition(
                      (position) => {
                        setPendingDeviceLocation({
                          latitude: position.coords.latitude,
                          longitude: position.coords.longitude,
                        })
                        setLocationStatus('Review the location warning before applying this pin.')
                      },
                      (locationError) => setLocationStatus(geolocationErrorMessage(locationError.code)),
                      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 },
                    )
                  }}
                >
                  Use device location
                </button>
                {approxLocation && (
                  <button
                    type="button"
                    className="btn btn-neutral btn-sm"
                    onClick={() => {
                      setApproxLocation(null)
                      setNearbyDiscoveryEnabled(false)
                      setPendingDeviceLocation(null)
                      setLocationStatus('Approximate location removed and nearby discovery turned off.')
                    }}
                  >
                    Remove pin
                  </button>
                )}
              </div>
            </div>

            {pendingDeviceLocation && (
              <div className="notice notice-warning mt-3" role="alert">
                <span className="notice-icon">!</span>
                <span>
                  <strong>Exact home/current locations are not recommended.</strong>{' '}
                  Your device may provide an exact position. Apply it only if this is a safe general area,
                  then move the pin away from a home or private meeting point before saving.
                  <span className="flex gap-2 flex-wrap mt-2">
                    <button
                      type="button"
                      className="btn btn-self btn-sm"
                      onClick={() => {
                        setApproxLocation(roundCoordinates(pendingDeviceLocation))
                        setPendingDeviceLocation(null)
                        setLocationStatus('Rounded device location applied. Move the pin to a broad, safe area before saving.')
                      }}
                    >
                      Apply rounded location
                    </button>
                    <button
                      type="button"
                      className="btn btn-neutral btn-sm"
                      onClick={() => {
                        setPendingDeviceLocation(null)
                        setLocationStatus('Device location was not applied.')
                      }}
                    >
                      Do not apply
                    </button>
                  </span>
                </span>
              </div>
            )}

            <label className="field-row mt-3">
              <span className="label">Area label <span className="label-aux">optional, private</span></span>
              <input
                className="field"
                value={approximateArea}
                onChange={(event) => setApproximateArea(event.currentTarget.value)}
                placeholder="For example, central Cebu or a travel area"
              />
            </label>

            <ApproximateLocationMap
              location={approxLocation}
              onChange={(location) => {
                setApproxLocation(location)
                setLocationStatus('Pin updated. Coordinates will be rounded again when you save.')
              }}
              title={approxLocation ? 'Your approximate area' : 'Choose a broad area'}
              description={approxLocation
                ? 'Drag, click, or use the N/W/S/E controls to reposition the pin.'
                : 'Pan and zoom, then click the map to place a privacy-safe pin.'}
            />

            <label className="nearby-visibility-toggle mt-3" data-disabled={!approxLocation}>
              <input
                type="checkbox"
                checked={nearbyDiscoveryEnabled && Boolean(approxLocation)}
                disabled={!approxLocation}
                onChange={(event) => setNearbyDiscoveryEnabled(event.currentTarget.checked)}
              />
              <span>
                <strong>Appear in nearby search</strong>
                <small>Off by default. Turning this off does not remove your profile from ordinary discovery.</small>
              </span>
            </label>

            {locationStatus && (
              <p className="text-meta mt-3" role="status" aria-live="polite">
                {locationStatus}
              </p>
            )}
          </div>
        </NumberedSection>

        <NumberedSection
          n={2}
          title="Your invitation"
          rationale="Choose online, in-person, or both, then tell members what time with you could feel like."
        >
          <label className="field-row">
            <span className="label">Availability mode</span>
            <select name="mode" defaultValue={application?.mode ?? 'both'} className="field">
              <option value="both">Online and in-person</option>
              <option value="online">Online only</option>
              <option value="in_person">In-person only</option>
            </select>
          </label>
          <label className="field-row">
            <span className="label">Listed hourly rate <span className="label-aux">PHP</span></span>
            <input
              name="hourlyRatePesos"
              type="number"
              min="100"
              max="10000"
              step="0.01"
              required
              defaultValue={(application?.hourlyRateCentavos ?? 50_000) / 100}
              className="field"
            />
            <span className="field-row-help">The member wallet funds this listed subtotal plus a separate 15% member booking fee. Your entitlement is 100% of the listed subtotal. Payouts await provider activation.</span>
          </label>
          <label className="field-row">
            <span className="label">How would you spend the time? <span className="label-aux">40 chars minimum</span></span>
            <textarea
              name="intro"
              required
              minLength={40}
              defaultValue={application?.intro}
              className="field min-h-28"
              placeholder="For example: Join me for an easy coffee, a walk through local history, or an unhurried online conversation."
            />
            <span className="field-row-help">Keep it specific. Avoid romantic, dating, or transactional framing.</span>
          </label>
        </NumberedSection>

        <NumberedSection
          n={3}
          title="Strengths · what you are great at"
          rationale="Choose the qualities you genuinely want to bring to a shared experience."
        >
          <ChipGroup values={friendStrengths} selected={selectedStrengths} setSelected={setSelectedStrengths} />
        </NumberedSection>

        <NumberedSection
          n={4}
          title="Things you can do together"
          rationale="Choose the activities you feel comfortable hosting. Every category is reviewed before it is offered."
        >
          <ChipGroup values={activityCategories} selected={selectedCategories} setSelected={setSelectedCategories} />
        </NumberedSection>

        <NumberedSection
          n={5}
          title="Your boundaries"
          rationale="Tell members what keeps the experience comfortable and clear. Notes for the review team stay private."
        >
          <label className="field-row">
            <span className="label">Boundaries <span className="label-aux">one per line</span></span>
            <textarea
              name="boundaries"
              defaultValue={application?.boundaries?.join('\n') ?? 'Public places only\nNo dating or romantic expectations'}
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
        </NumberedSection>

        <div className="flex items-center justify-between gap-3 pt-6 border-t border-[color:var(--rule)]">
          <p className="text-meta">
            Submitting again replaces the pending review packet.
          </p>
          <button className="btn btn-self" disabled={saving}>
            {saving ? 'Saving…' : status ? 'Save hosting profile' : 'Send profile for review'}
          </button>
        </div>
      </form>

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
  const steps = [
    { id: 'submit', label: 'Application submitted', done: !!status },
    { id: 'identity', label: testBypassActive ? 'Identity check bypassed for testing' : 'Identity and safety review', done: identityApproved, active: !!status && !identityApproved },
    { id: 'review', label: 'Friend Host profile review', done: status === 'approved' || status === 'rejected', active: status === 'pending_review' && identityApproved },
    { id: 'live', label: 'Visible in discovery', done: status === 'approved' && identityApproved },
  ]

  return (
    <aside className="drawer">
      <div className="drawer-header">
        <h2 className="text-h3">Review status</h2>
        {status && <span className="status-pill" data-tone={statusTone(status)}>{status}</span>}
      </div>
      <div className="drawer-body">
        <ol className="flex flex-col gap-3">
          {steps.map((step, index) => (
            <li key={step.id} className="flex items-start gap-3">
              <span
                className="numbered-section-marker"
                style={{
                  width: '1.5rem',
                  height: '1.5rem',
                  fontSize: '0.75rem',
                  background: step.done
                    ? 'var(--accent-self-soft)'
                    : step.active
                      ? 'var(--warning-soft)'
                      : 'var(--surface)',
                  color: step.done
                    ? 'var(--accent-self)'
                    : step.active
                      ? 'var(--warning)'
                      : 'var(--text-soft)',
                  borderColor: step.done
                    ? 'color-mix(in oklch, var(--accent-self) 35%, var(--border))'
                    : 'var(--border)',
                }}
              >
                {index + 1}
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
              ? 'Opening Persona…'
              : verification.action === 'continue'
                ? 'Continue identity check'
                : verification.action === 'retry'
                  ? 'Start a new identity check'
                  : 'Verify identity with Persona'}
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

function NumberedSection({
  n,
  title,
  rationale,
  children,
}: {
  n: number
  title: string
  rationale: string
  children: React.ReactNode
}) {
  return (
    <section className="numbered-section">
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

function FieldRow({
  name,
  label,
  aux,
  defaultValue,
  required = true,
}: {
  name: string
  label: string
  aux?: string
  defaultValue?: string
  required?: boolean
}) {
  return (
    <label className="field-row">
      <span className="label">
        {label}
        {aux && <span className="label-aux">{aux}</span>}
      </span>
      <input name={name} required={required} defaultValue={defaultValue} className="field" />
    </label>
  )
}

function ChipGroup({
  values,
  selected,
  setSelected,
}: {
  values: readonly string[]
  selected: string[]
  setSelected: (next: string[]) => void
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {values.map((value) => {
        const isSelected = selected.includes(value)
        return (
          <button
            type="button"
            key={value}
            data-selected={isSelected}
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
  )
}
