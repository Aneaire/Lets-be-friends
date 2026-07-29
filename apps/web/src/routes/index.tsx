import { Link, createFileRoute } from '@tanstack/react-router'
import { SignUpButton, useAuth } from '@clerk/react'
import { useQuery } from 'convex/react'
import { activityCategories } from '@lets-be-friends/shared'
import { api } from '../../convex/_generated/api'
import { SocialPage } from './social'

export const Route = createFileRoute('/')({ component: HomePage })

type HomeHost = {
  _id: string
  displayName: string
  city: string
  mode: 'online' | 'in_person' | 'both'
  intro: string
  strengths: string[]
  bookable?: boolean
  demo?: boolean
}

const trustGates = [
  {
    label: 'Discover',
    body: 'Approved Friend Hosts only. Demo profiles fill the surface while the review queue is empty.',
  },
  {
    label: 'Verify',
    body: 'Persona identity check before a booking request leaves verification_required.',
  },
  {
    label: 'Book',
    body: 'Exact meeting details unlock after the host accepts. Reportable at every step.',
  },
] as const

function HomePage() {
  const { isSignedIn } = useAuth()
  const hostsResult = useQuery(api.hosts.listApproved, {}) as HomeHost[] | undefined
  const hosts = hostsResult ?? []
  const hostsLoading = hostsResult === undefined
  const featured = hosts.slice(0, 4)

  if (isSignedIn) return <SocialPage />

  return (
    <main>
      <section className="hero-grid">
        <div>
          <p className="eyebrow">Trust-first social booking · Early access</p>
          <h1 className="text-display mt-5 max-w-[16ch]">
            Friendly hours, booked through people we already approved.
          </h1>
          <p className="lede mt-6">
            Find good listeners, study partners, tour buddies, and online friends. Identity, intent,
            and location stay visible before a booking moves forward.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-2">
            <Link to="/discover" className="btn btn-social btn-lg hero-action">Find a host</Link>
            <HomeAuthAction />
            <Link to="/safety" className="btn btn-ghost">How safety works</Link>
          </div>
        </div>
        <div className="hero-art">
          <img
            src="/hero-ribbon.png"
            alt=""
            aria-hidden="true"
            loading="eager"
            decoding="async"
            className="hero-art-img"
          />
        </div>
      </section>

      <section className="marketing-band">
        <div className="marketing-page-wide">
          <div className="flex items-end justify-between gap-4 mb-6">
            <div>
              <p className="eyebrow">How a booking moves</p>
              <h2 className="text-h1 mt-2">Three trust gates, in order.</h2>
            </div>
            <Link to="/safety" className="btn btn-ghost btn-sm hidden sm:inline-flex">
              Read the safety model
            </Link>
          </div>
          <div className="trust-gate-row">
            {trustGates.map((gate, index) => (
              <div className="trust-gate-step" key={gate.label}>
                <span className="trust-gate-step-num tabular">
                  {String(index + 1).padStart(2, '0')} / {gate.label}
                </span>
                <p className="text-body">{gate.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="marketing-band">
        <div className="marketing-page-wide">
          <div className="flex items-end justify-between gap-4 mb-5">
            <div>
              <p className="eyebrow">Currently visible</p>
              <h2 className="text-h1 mt-2">Approved Friend Hosts.</h2>
            </div>
            <Link to="/discover" className="btn btn-neutral btn-sm">Open discovery</Link>
          </div>
          <div className="panel">
            <div className="worklist">
              {hostsLoading && <HomeHostSkeletonRows />}
              {!hostsLoading && featured.length === 0 && (
                <div className="worklist-empty">
                  No hosts visible yet. The list fills as applications pass safety review.
                </div>
              )}
              {!hostsLoading && featured.map((host) => (
                <FeaturedHostRow key={host._id} host={host} />
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="marketing-band-sunk">
        <div className="marketing-page-wide flex flex-wrap items-baseline gap-x-3 gap-y-2 py-10">
          <p className="eyebrow shrink-0">Safe categories</p>
          <p className="text-body muted">{activityCategories.join(' · ')}</p>
        </div>
      </section>
    </main>
  )
}

function HomeHostSkeletonRows() {
  return (
    <>
      {Array.from({ length: 3 }).map((_, index) => (
        <article className="worklist-row skeleton-row" aria-hidden="true" key={index}>
          <div className="worklist-row-head">
            <div className="flex items-center gap-3 min-w-0">
              <span className="skeleton skeleton-avatar" />
              <div className="min-w-0 skeleton-stack">
                <span className="skeleton skeleton-line skeleton-line-title" />
                <span className="skeleton skeleton-line skeleton-line-meta" />
              </div>
            </div>
            <span className="skeleton skeleton-button" />
          </div>
          <span className="skeleton skeleton-line skeleton-line-body" />
        </article>
      ))}
    </>
  )
}

function FeaturedHostRow({ host }: { host: HomeHost }) {
  return (
    <article className="worklist-row">
      <div className="worklist-row-head">
        <div className="flex items-center gap-3 min-w-0">
          <span className="avatar" aria-hidden="true">{initials(host.displayName)}</span>
          <div className="min-w-0">
            <h3 className="text-h3 truncate">{host.displayName}</h3>
            <div className="worklist-row-meta">
              <span>{host.city}</span>
              <span className="dot" aria-hidden="true" />
              <span>{formatMode(host.mode)}</span>
              <span className="dot" aria-hidden="true" />
              <TrustChip state={host.demo ? 'demo' : host.bookable ? 'verified' : 'awaiting'} />
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {host.bookable ? (
            <Link to="/app" search={{ hostProfileId: host._id }} className="btn btn-social btn-sm">
              Request booking
            </Link>
          ) : (
            <span className="text-meta">Demo</span>
          )}
        </div>
      </div>
      <p className="text-body muted line-clamp-2 max-w-[64ch]">{host.intro}</p>
    </article>
  )
}

function TrustChip({ state }: { state: 'verified' | 'awaiting' | 'demo' }) {
  const label = state === 'verified' ? 'Verified after review' : state === 'awaiting' ? 'Awaiting review' : 'Demo profile'
  return (
    <span className="trust-chip" data-state={state}>
      <span className="trust-chip-dot" aria-hidden="true" />
      {label}
    </span>
  )
}

function HomeAuthAction() {
  const { isSignedIn } = useAuth()
  if (isSignedIn) {
    return (
      <Link to="/app" search={{}} className="btn btn-self btn-lg hero-action">
        Open workspace
      </Link>
    )
  }
  return (
    <SignUpButton mode="modal">
      <button className="btn btn-self btn-lg hero-action">Create account</button>
    </SignUpButton>
  )
}

function formatMode(mode: HomeHost['mode']) {
  if (mode === 'both') return 'Online and in-person'
  if (mode === 'in_person') return 'In-person'
  return 'Online'
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}
