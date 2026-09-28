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

export const friendaySteps = [
  {
    title: 'Set up your profile',
    body: 'Use your real identity. Friends list only services they can safely and legally perform.',
  },
  {
    title: 'Find the right match',
    body: 'Frienders browse profiles or post a task. Friends respond only when the task fits their skills and comfort.',
  },
  {
    title: 'Chat and agree in writing',
    body: 'Agree on task, date, meeting place, duration, price, materials, boundaries, and what counts as complete.',
  },
  {
    title: 'Confirm and fund the booking',
    body: 'The Friender confirms and loads the amount. Payment stays reserved until completion. Keep payment in the app.',
  },
  {
    title: 'Meet and take the first selfie',
    body: 'Meet in a well lit public place when possible. Both people take the First Friend Selfie in the app.',
  },
  {
    title: 'Take the mid session check-in',
    body: 'Around halfway, both people take the Second Friend Selfie. Approve changes to task, time, or price in the app.',
  },
  {
    title: 'Take the final check-in',
    body: 'At the end, both people take the Third Friend Selfie before separating. The Friender reviews completion.',
  },
  {
    title: 'Payment is released',
    body: 'Reserved payment moves to the Friend after confirmation or after the stated window ends with no dispute.',
  },
  {
    title: 'Leave an honest review',
    body: 'Both people may rate each other. Keep reviews truthful, relevant, and free of private details.',
  },
] as const

export const friendayCheckins = [
  {
    title: 'First Friend Selfie',
    when: 'At the start',
    purpose: 'Confirms both people met and the Frienday began.',
  },
  {
    title: 'Second Friend Selfie',
    when: 'Around the midpoint',
    purpose: 'Confirms the Frienday is continuing as agreed.',
  },
  {
    title: 'Third Friend Selfie',
    when: 'At the end',
    purpose: 'Records the end before completion and payment review.',
  },
] as const

export const friendaySafetyGroups = [
  {
    title: 'Before the Frienday',
    short: 'Before',
    items: [
      'Keep chat, booking details, and payment inside the app.',
      'Read ratings, reviews, descriptions, and qualifications.',
      'Tell a trusted person where you go and when you expect to return.',
      'Arrange your own transport and keep a way to leave.',
    ],
  },
  {
    title: 'During the Frienday',
    short: 'During',
    items: [
      'Follow the agreed task, schedule, price, and boundaries.',
      'Consent can be withdrawn at any time.',
      'Stop if the situation becomes unsafe.',
    ],
  },
  {
    title: 'In an emergency',
    short: 'Emergency',
    items: [
      'Leave first, then contact local emergency services.',
      'Report to Let’s Be Friends only after reaching safety.',
    ],
  },
] as const

export const friendayNotAllowed = [
  'Illegal activity or help with a crime.',
  'Sexual services, exploitation, or trafficking.',
  'Violence, threats, intimidation, harassment, or hate based conduct.',
  'Weapons tasks or activity meant to harm.',
  'Drug sales, illegal substances, or unsafe intoxication.',
  'Fraud, impersonation, cheating, false documents, or deceptive testimony.',
  'Surveillance, stalking, or locating someone without consent.',
  'Unlicensed regulated work when a license is required.',
  'Unsafe work without training, protective equipment, or legal permission.',
  'Any romantic, adult, hazardous, or inappropriate service involving a minor.',
] as const

export const friendayPromise = [
  'Be honest about identity, needs, skills, and qualifications.',
  'Keep important agreements in the app.',
  'Respect consent, privacy, time, property, and boundaries.',
  'Follow the three check-ins when they apply.',
  'Keep payment on the platform.',
  'Follow local laws and platform rules.',
  'Leave and report the booking if it becomes unsafe.',
] as const

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
      <p className="text-meta frienday-rail-intro">
        A Frienday is the agreed time when a Friend and a Friender meet and complete a booked
        activity. Friend is the Companion offering help. Friender is the member booking help.
      </p>
      <Link to="/safety" hash="frienday" className="frienday-rail-link">
        Read the full Frienday guide
      </Link>
    </FlipCard>
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
      title="Three Friend Selfies"
      previewLabel="3 selfies inside, tap to open"
      defaultOpen={defaultOpen}
    >
      <p className="text-meta frienday-rail-intro">
        Selfies support check-in and safety steps. They do not prove all work was complete and do
        not replace emergency services.
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

export function FriendaySafetyRail() {
  return (
    <div className="frienday-rail-stack">
      <SafetyCard defaultOpen />
      <StartCard />
    </div>
  )
}

export function FriendayMobileSummary() {
  return (
    <details className="frienday-mobile-summary">
      <summary>How a Frienday works: 9 steps, 3 check-ins, safety rules</summary>
      <div className="frienday-mobile-body">
        <p className="text-meta">
          A Frienday is the agreed time when a Friend and a Friender meet and complete a booked
          activity. Friend is the Companion offering help. Friender is the member booking help. Tap a card to open it. Keep chat, booking, and payment in the app, take three
          check-in selfies, and follow the agreed plan.
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
