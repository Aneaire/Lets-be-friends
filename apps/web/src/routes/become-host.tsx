import { Link, createFileRoute } from '@tanstack/react-router'
import { SignInButton, useAuth, useUser } from '@clerk/react'
import { useMutation, useQuery } from 'convex/react'
import { useState } from 'react'
import type React from 'react'
import { activityCategories, friendStrengths } from '@lets-be-friends/shared'
import { api } from '../../convex/_generated/api'

export const Route = createFileRoute('/become-host')({ component: BecomeHostPage })

function BecomeHostPage() {
  return (
    <main className="marketing-page-wide">
      <header className="mb-10">
        <p className="eyebrow">Become a host</p>
        <h1 className="text-h1 mt-2">Apply as a Friend Host.</h1>
        <p className="lede mt-2">
          Build a profile around what you offer: strengths, boundaries, online or in-person mode,
          and safe activity categories. Identity verification and admin approval happen before
          public discovery.
        </p>
      </header>
      <HostAuthPanel />
    </main>
  )
}

function HostAuthPanel() {
  const { isSignedIn } = useAuth()
  const { user } = useUser()
  const ensureUser = useMutation(api.users.ensureViewer)
  const application = useQuery(api.hosts.myApplication)
  const submit = useMutation(api.hosts.submitApplication)
  const [selectedStrengths, setSelectedStrengths] = useState<string[]>(['Good listener'])
  const [selectedCategories, setSelectedCategories] = useState<string[]>(['Online conversation'])
  const [saved, setSaved] = useState(false)

  if (!isSignedIn) {
    return (
      <div className="empty-state">
        <p className="empty-state-title">Sign in first</p>
        <p className="text-meta max-w-[40ch]">
          Host applications are tied to a verified account so admin review can reach back to you.
        </p>
        <SignInButton mode="modal">
          <button className="btn btn-self btn-sm mt-2">Sign in to apply</button>
        </SignInButton>
      </div>
    )
  }

  const status = application?.status

  return (
    <div className="drawer-host">
      <form
        className="min-w-0"
        onSubmit={async (event) => {
          event.preventDefault()
          const form = new FormData(event.currentTarget)
          await ensureUser({ displayName: user?.fullName ?? user?.username ?? 'New friend' })
          await submit({
            displayName: String(form.get('displayName') || user?.fullName || 'Friend Host'),
            intro: String(form.get('intro') || ''),
            city: String(form.get('city') || ''),
            approximateArea: String(form.get('approximateArea') || '') || undefined,
            strengths: selectedStrengths,
            categories: selectedCategories,
            boundaries: String(form.get('boundaries') || '').split('\n').map((item) => item.trim()).filter(Boolean),
            mode: form.get('mode') as 'online' | 'in_person' | 'both',
            applicationNote: String(form.get('applicationNote') || '') || undefined,
          })
          setSaved(true)
        }}
      >
        {saved && (
          <div className="notice notice-success mb-6">
            <span className="notice-icon">✓</span>
            <span>
              Application saved. Identity is represented by a placeholder Persona inquiry until
              real credentials are wired up.
            </span>
          </div>
        )}

        <NumberedSection
          n={1}
          title="Identity"
          rationale="Reviewers contact you with this name. The public host card uses it directly."
        >
          <FieldRow name="displayName" label="Public host name" defaultValue={application?.displayName ?? user?.fullName ?? ''} />
          <div className="grid gap-3 sm:grid-cols-2">
            <FieldRow name="city" label="City or online region" defaultValue={application?.city ?? ''} />
            <FieldRow
              name="approximateArea"
              label="Approximate area"
              aux="Optional, hidden until booking accepted"
              required={false}
              defaultValue={application?.approximateArea ?? ''}
            />
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
          rationale="MVP only allows the categories below. New ones are added through admin review."
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
          <button className="btn btn-self">
            {status ? 'Update application' : 'Submit for review'}
          </button>
        </div>
      </form>

      <ReviewStatusPanel status={status} />
    </div>
  )
}

function ReviewStatusPanel({ status }: { status?: string }) {
  const steps = [
    { id: 'submit', label: 'Application submitted', done: !!status },
    { id: 'review', label: 'Admin review', done: status === 'approved' || status === 'rejected', active: status === 'pending' },
    { id: 'identity', label: 'Identity check (Persona)', done: false, active: status === 'pending' },
    { id: 'live', label: 'Visible in discovery', done: status === 'approved' },
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
  if (status === 'pending') return 'warning'
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
