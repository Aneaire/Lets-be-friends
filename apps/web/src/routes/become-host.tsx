import { Link, createFileRoute } from '@tanstack/react-router'
import { SignInButton, useAuth } from '@clerk/react'
import { useMutation, useQuery } from 'convex/react'
import { useEffect, useState } from 'react'
import type React from 'react'
import { activityCategories, friendStrengths } from '@lets-be-friends/shared'
import { api } from '../../convex/_generated/api'
import { ApproximateLocationMap } from '../components/ApproximateLocationMap'
import { useIdentityVerification } from '../components/IdentityVerificationFlow'
import { roundCoordinates, type Coordinates } from '../lib/geo'
import { identityEntitlementStatus, memberVerificationPresentation, type MemberVerificationPresentation } from '../lib/memberVerification'

export const Route = createFileRoute('/become-host')({ component: BecomeHostPage })

function BecomeHostPage() {
  return (
    <main className="marketing-page-wide">
      <header className="mb-10">
        <p className="eyebrow">Become a host</p>
        <h1 className="text-h1 mt-2">Apply as a Friend Host.</h1>
        <p className="lede mt-2">
          Build a profile around what you offer: strengths, boundaries, online or in-person mode,
          and safe activity categories. Identity verification and safety review happen before
          public discovery.
        </p>
      </header>
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
  const identityFlow = useIdentityVerification('host_application')
  const [selectedStrengths, setSelectedStrengths] = useState<string[]>(['Good listener'])
  const [selectedCategories, setSelectedCategories] = useState<string[]>(['Online conversation'])
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
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
    if (!application) return
    setSelectedStrengths(application.strengths.length > 0 ? application.strengths : ['Good listener'])
    setSelectedCategories(application.categories.length > 0 ? application.categories : ['Online conversation'])
    setApproxLocation(
      typeof application.approximateLatitude === 'number' && typeof application.approximateLongitude === 'number'
        ? { latitude: application.approximateLatitude, longitude: application.approximateLongitude }
        : null,
    )
    setApproximateArea(application.approximateArea ?? '')
    setNearbyDiscoveryEnabled(application.nearbyDiscoveryEnabled === true)
  }, [application?._id])

  if (!isSignedIn) {
    return (
      <div className="empty-state">
        <p className="empty-state-title">Sign in first</p>
        <p className="text-meta max-w-[40ch]">
          Host applications are tied to a verified account so safety review can reach back to you.
        </p>
        <SignInButton mode="modal">
          <button className="btn btn-self btn-sm mt-2">Sign in to apply</button>
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
          title="Location"
          rationale="Share a city or online region for useful context. Near-me discovery is optional and uses rounded coordinates instead of a neighborhood or address."
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
                      () => setLocationStatus('Location permission was not granted.'),
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
          title="Mode and intro"
          rationale="Online, in-person, or either. Intro shows on the discovery list."
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
            <span className="label">Hourly cash rate <span className="label-aux">PHP</span></span>
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
            <span className="field-row-help">Members pay you in cash. The locked booking price uses this rate; the platform commission is 10%.</span>
          </label>
          <label className="field-row">
            <span className="label">Intro <span className="label-aux">40 chars minimum</span></span>
            <textarea
              name="intro"
              required
              minLength={40}
              defaultValue={application?.intro}
              className="field min-h-28"
              placeholder="Describe the safe, friendly experiences you offer."
            />
            <span className="field-row-help">Keep it specific. Avoid romantic, dating, or transactional framing.</span>
          </label>
        </NumberedSection>

        <NumberedSection
          n={3}
          title="Strengths"
          rationale="Members search by strength. Pick the ones you actually want to host around."
        >
          <ChipGroup values={friendStrengths} selected={selectedStrengths} setSelected={setSelectedStrengths} />
        </NumberedSection>

        <NumberedSection
          n={4}
          title="Safe categories"
          rationale="Early access supports the categories below. New ones are added through safety review."
        >
          <ChipGroup values={activityCategories} selected={selectedCategories} setSelected={setSelectedCategories} />
        </NumberedSection>

        <NumberedSection
          n={5}
          title="Boundaries and reviewer note"
          rationale="Boundaries are visible to members. The reviewer note stays internal."
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
            {saving ? 'Saving…' : status ? 'Update application' : 'Submit for review'}
          </button>
        </div>
      </form>

      <ReviewStatusPanel
        status={status}
        verification={verification}
        canStartIdentity={Boolean(application)}
        identityBusy={identityFlow.busy}
        onStartIdentity={() => void identityFlow.begin()}
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
}: {
  status?: string
  verification: MemberVerificationPresentation
  canStartIdentity: boolean
  identityBusy: boolean
  onStartIdentity: () => void
}) {
  const identityApproved = verification.state === 'approved'
  const steps = [
    { id: 'submit', label: 'Application submitted', done: !!status },
    { id: 'identity', label: 'Persona identity and safety review', done: identityApproved, active: !!status && !identityApproved },
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
