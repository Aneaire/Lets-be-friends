import { Link } from '@tanstack/react-router'
import {
  CalendarCheck,
  Camera,
  ChevronDown,
  HeartHandshake,
  ListChecks,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react'
import { useId, useState, type ReactNode } from 'react'
import {
  friendayCheckins,
  friendayNotAllowed,
  friendayPromise,
  friendaySafetyGroups,
  friendaySteps,
} from '@lets-be-friends/shared'

export { friendayCheckins, friendayNotAllowed, friendayPromise, friendaySafetyGroups, friendaySteps }

export function FlipCard({
  icon: Icon,
  eyebrow,
  title,
  teaser,
  previewLabel,
  children,
  defaultOpen = false,
}: {
  icon: LucideIcon
  eyebrow: string
  title: string
  teaser?: string
  previewLabel: string
  children: ReactNode
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  const bodyId = useId()
  const titleId = useId()

  return (
    <section className="frienday-rail-card frienday-flip" data-open={open} aria-labelledby={titleId}>
      <button
        type="button"
        className="frienday-flip-head"
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="frienday-flip-icon" aria-hidden="true">
          <Icon size={16} />
        </span>
        <span className="frienday-flip-copy">
          <span className="eyebrow">{eyebrow}</span>
          <span id={titleId} className="text-h3 frienday-rail-title frienday-flip-title">
            {title}
          </span>
          {teaser ? <span className="text-meta frienday-flip-teaser">{teaser}</span> : null}
        </span>
        <span className="frienday-flip-chevron" aria-hidden="true">
          <ChevronDown size={14} />
        </span>
      </button>

      {!open && <p className="frienday-flip-preview tabular">{previewLabel}</p>}

      {open && (
        <div id={bodyId} className="frienday-flip-body">
          {children}
        </div>
      )}
    </section>
  )
}

function StepsList({ limit }: { limit?: number }) {
  const visible = limit ? friendaySteps.slice(0, limit) : friendaySteps
  return (
    <ol className="frienday-step-list">
      {visible.map((step, index) => (
        <li key={step.title}>
          <span className="frienday-step-number tabular" aria-hidden="true">
            {String(index + 1).padStart(2, '0')}
          </span>
          <div>
            <strong>{step.title}</strong>
            <span>{step.body}</span>
          </div>
        </li>
      ))}
    </ol>
  )
}

export function WhatIsFriendayCard({ defaultOpen = true }: { defaultOpen?: boolean }) {
  return (
    <FlipCard
      icon={CalendarCheck}
      eyebrow="Frienday guide"
      title="What is a Frienday"
      previewLabel="Tap to open"
      defaultOpen={defaultOpen}
    >
      <img
        src="/images/rail/frienday-cafe-conversation-1024.webp"
        srcSet="/images/rail/frienday-cafe-conversation-768.webp 768w, /images/rail/frienday-cafe-conversation-1024.webp 1024w"
        sizes="(max-width: 1500px) 19rem, 21rem"
        alt="Two people talking over coffee at a table in a bright public cafe"
        loading="lazy"
        decoding="async"
        width={1024}
        height={768}
        className="frienday-rail-photo-img frienday-guide-cafe-img"
      />
      <p className="text-meta frienday-rail-intro">
        A Frienday is the agreed time when a Companion and a member meet and complete a booked
        activity. The Companion offers help and the member books help.
      </p>
      <Link to="/safety" hash="frienday" className="frienday-rail-link">
        Read the full Frienday guide
      </Link>
    </FlipCard>
  )
}

export function FriendayIdeas() {
  const titleId = useId()
  return (
    <section className="frienday-ideas" aria-labelledby={titleId}>
      <h2 id={titleId} className="text-h3 frienday-ideas-title">
        A little inspiration for your next Frienday
      </h2>
      <div className="frienday-ideas-grid">
        <article className="frienday-ideas-card">
          <img
            src="/images/rail/frienday-public-walk-1024.webp"
            srcSet="/images/rail/frienday-public-walk-768.webp 768w, /images/rail/frienday-public-walk-1024.webp 1024w"
            sizes="(max-width: 480px) 100vw, 21rem"
            alt="Two people walking and talking together on a public path in daylight"
            loading="lazy"
            decoding="async"
            width={1024}
            height={768}
            className="frienday-ideas-img"
          />
          <div className="frienday-ideas-copy">
            <p className="eyebrow">In-person session idea</p>
            <h3 className="text-h3 frienday-ideas-card-title">A walk and a good conversation</h3>
            <p className="text-meta">
              Take an easy walk in a public place with clear time and route. Good company and
              unhurried conversation.
            </p>
          </div>
        </article>
        <article className="frienday-ideas-card">
          <img
            src="/images/rail/frienday-online-session-1024.webp"
            srcSet="/images/rail/frienday-online-session-768.webp 768w, /images/rail/frienday-online-session-1024.webp 1024w"
            sizes="(max-width: 480px) 100vw, 21rem"
            alt="A person smiling during a video call with a Companion on a laptop at home"
            loading="lazy"
            decoding="async"
            width={1024}
            height={768}
            className="frienday-ideas-img"
          />
          <div className="frienday-ideas-copy">
            <p className="eyebrow">Online session idea</p>
            <h3 className="text-h3 frienday-ideas-card-title">Good company, wherever you are</h3>
            <p className="text-meta">
              Meet over video from a comfortable place with a clear plan. Good company is possible
              wherever you are.
            </p>
          </div>
        </article>
      </div>
      <Link to="/nearby" className="btn btn-social btn-sm frienday-ideas-cta">
        Find a Companion
      </Link>
    </section>
  )
}

export function StepsCard({ defaultOpen = false }: { defaultOpen?: boolean }) {
  const [showAll, setShowAll] = useState(false)
  const expanded = showAll

  return (
    <FlipCard
      icon={ListChecks}
      eyebrow="Nine steps"
      title="How a Frienday works"
      previewLabel="9 steps inside, tap to open"
      defaultOpen={defaultOpen}
    >
      <StepsList limit={expanded ? undefined : 2} />
      <button
        type="button"
        className="btn btn-neutral btn-sm frienday-expand-btn"
        aria-expanded={expanded}
        onClick={() => setShowAll((value) => !value)}
      >
        {expanded ? 'Show fewer steps' : `Show all 9 steps (${friendaySteps.length - 2} more)`}
      </button>
    </FlipCard>
  )
}

export function CheckinsCard({ defaultOpen = false }: { defaultOpen?: boolean }) {
  const [active, setActive] = useState(0)
  const current = friendayCheckins[active]

  return (
    <FlipCard
      icon={Camera}
      eyebrow="Check-ins"
      title="Two optional check-in photos"
      previewLabel="2 optional photos inside, tap to open"
      defaultOpen={defaultOpen}
    >
      <p className="text-meta frienday-rail-intro">
        Check-in photos are optional and support safety review. They do not prove all work was
        complete and do not replace emergency services. Each photo is chosen from the library as a
        private image, never as a required camera selfie.
      </p>
      <div className="frienday-checkin-dots" role="tablist" aria-label="Check-in moments">
        {friendayCheckins.map((checkin, index) => (
          <button
            key={checkin.title}
            type="button"
            role="tab"
            aria-selected={active === index}
            className="frienday-checkin-dot"
            data-active={active === index}
            onClick={() => setActive(index)}
          >
            <span className="frienday-checkin-dot-number tabular">{index + 1}</span>
            <span>{checkin.when}</span>
          </button>
        ))}
      </div>
      <div className="frienday-checkin-detail" role="tabpanel" aria-live="polite">
        <strong>{current.title}</strong>
        <span className="text-meta">
          {current.when}: {current.purpose}
        </span>
      </div>
    </FlipCard>
  )
}

export function SafetyCard({ defaultOpen = false }: { defaultOpen?: boolean }) {
  const [tab, setTab] = useState(0)
  const group = friendaySafetyGroups[tab]

  return (
    <FlipCard
      icon={ShieldCheck}
      eyebrow="Safety first"
      title="Frienday safety rules"
      previewLabel="3 moments inside, tap to open"
      defaultOpen={defaultOpen}
    >
      <div className="frienday-tab-row" role="tablist" aria-label="Safety moments">
        {friendaySafetyGroups.map((item, index) => (
          <button
            key={item.title}
            type="button"
            role="tab"
            aria-selected={tab === index}
            className="frienday-tab"
            data-active={tab === index}
            onClick={() => setTab(index)}
          >
            {item.short}
          </button>
        ))}
      </div>
      <div className="frienday-safety-group" role="tabpanel" aria-live="polite">
        <h3>{group.title}</h3>
        <ul>
          {group.items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
      <Link to="/safety" hash="frienday-safety" className="frienday-rail-link">
        Safety details and emergency steps
      </Link>
    </FlipCard>
  )
}

export function StartCard({ defaultOpen = true }: { defaultOpen?: boolean }) {
  return (
    <FlipCard
      icon={HeartHandshake}
      eyebrow="Get started"
      title="Ready for your next Frienday"
      previewLabel="2 actions plus the promise"
      defaultOpen={defaultOpen}
    >
      <div className="frienday-rail-actions">
        <Link to="/become-companion" className="btn btn-self btn-sm">
          Create your Companion profile
        </Link>
        <Link to="/nearby" className="btn btn-social btn-sm">
          Find a Companion
        </Link>
      </div>
      <Link to="/safety" hash="frienday-promise" className="frienday-rail-link">
        Read the Frienday promise
      </Link>
    </FlipCard>
  )
}

export function FriendayHowItWorksRail() {
  return (
    <div className="frienday-rail-stack">
      <WhatIsFriendayCard defaultOpen />
      <StepsCard defaultOpen />
      <CheckinsCard />
    </div>
  )
}

export function FriendayMomentPhotoCard() {
  return (
    <section className="frienday-rail-card frienday-rail-photo" aria-label="Example of a safe public plan">
      <img
        src="/images/rail/frienday-park-picnic-1024.webp"
        srcSet="/images/rail/frienday-park-picnic-768.webp 768w, /images/rail/frienday-park-picnic-1024.webp 1024w"
        sizes="(max-width: 1500px) 19rem, 21rem"
        alt="Two Filipino friends smiling at each other over a picnic in a sunny public park"
        loading="lazy"
        decoding="async"
        width={1024}
        height={768}
        className="frienday-rail-photo-img"
      />
      <div className="frienday-rail-photo-copy">
        <p className="eyebrow">In-person session idea</p>
        <p className="text-h3 frienday-rail-title">Time together in a public place</p>
        <p className="text-meta frienday-rail-intro">
          A daytime picnic in a public park with a Companion. A simple shared plan with clear
          time, place, and company.
        </p>
      </div>
    </section>
  )
}

export function FriendaySafetyRail() {
  return (
    <div className="frienday-rail-stack">
      <FriendayMomentPhotoCard />
      <SafetyCard defaultOpen />
      <StartCard />
    </div>
  )
}

export function FriendayMobileSummary() {
  return (
    <details className="frienday-mobile-summary">
      <summary>How a Frienday works: 9 steps, 2 optional photos, safety rules</summary>
      <div className="frienday-mobile-body">
        <p className="text-meta">
          A Frienday is the agreed time when a Companion and a member meet and complete a booked
          activity. The Companion offers help and the member books help. Tap a card to open it. Keep chat, booking, and payment in the app, decide on your own optional
          check-in photo or explicitly skip it, and follow the agreed plan.
        </p>
        <WhatIsFriendayCard defaultOpen={false} />
        <StepsCard defaultOpen={false} />
        <CheckinsCard defaultOpen={false} />
        <SafetyCard defaultOpen={false} />
        <Link to="/safety" hash="frienday" className="btn btn-neutral btn-sm">
          Read the full Frienday guide
        </Link>
      </div>
    </details>
  )
}
