import { Link, createFileRoute } from '@tanstack/react-router'
import { SignUpButton, useAuth } from '@clerk/react'
import { useQuery } from 'convex/react'
import { activityCategories } from '@lets-be-friends/shared'
import { api } from '../../convex/_generated/api'
import { SocialPage } from './social'

const homeTitle = "Find a Friend Host for Shared Activities | Let's Be Friends"
const homeDescription = 'Meet verified Friend Hosts for coffee, walks, gaming, study sessions, local experiences, and online conversation, with clear boundaries and safety steps.'

export const Route = createFileRoute('/')({
  head: () => ({
    meta: [
      { title: homeTitle },
      { name: 'description', content: homeDescription },
      { name: 'robots', content: 'index, follow, max-image-preview:large' },
      { property: 'og:type', content: 'website' },
      { property: 'og:site_name', content: "Let's Be Friends" },
      { property: 'og:title', content: homeTitle },
      { property: 'og:description', content: homeDescription },
      { name: 'twitter:card', content: 'summary' },
      { name: 'twitter:title', content: homeTitle },
      { name: 'twitter:description', content: homeDescription },
    ],
  }),
  component: HomePage,
})

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

const invitationPrompts = [
  'Coffee and conversation',
  'A walk somewhere new',
  'Focused study time',
  'Gaming with company',
  'Local knowledge',
  'Just someone to talk to',
] as const

const beforeYouMeet = [
  {
    label: 'Choose what feels right',
    body: 'Explore people by activity, personality, availability, and the boundaries they share.',
  },
  {
    label: 'Know who you are meeting',
    body: 'Identity checks and safety review happen before a Friend Host can receive bookings.',
  },
  {
    label: 'Plan with clarity',
    body: 'Review the time, price, and privacy details before sending a booking request.',
  },
] as const

const activityExamples = [
  {
    title: 'Photography walk',
    description: 'Trade ideas for the next shot, then take turns behind the camera.',
    image: '/images/marketing/photography-walk.webp',
    alt: 'A woman photographs her friend posing beside a colorful public mural',
  },
  {
    title: 'Gaming together',
    description: 'Queue up from different places, share the reactions, and make the match feel social.',
    image: '/images/marketing/valorant-remote-friends.webp',
    alt: 'Two friends in separate webcam panels gaming together remotely',
  },
  {
    title: 'Board game night',
    description: 'Make room at the table for an easygoing game and a lot of laughs.',
    image: '/images/marketing/board-game-night.webp',
    alt: 'Three friends laughing together around a board game',
  },
  {
    title: 'Weekend picnic',
    description: 'Pick a public park, bring a few snacks, and let the afternoon unfold.',
    image: '/images/marketing/park-picnic.webp',
    alt: 'Three friends enjoying a relaxed picnic in a public park',
  },
  {
    title: 'Gaming together',
    description: 'Bring the game. Skip the solo queue and share the funny parts.',
    image: '/images/marketing/gaming-together.webp',
    alt: 'Two friends laughing together during a relaxed gaming session',
  },
  {
    title: 'Coffee and conversation',
    description: 'Choose a public place and start with an easy plan that leaves room to talk.',
    image: '/images/marketing/public-cafe-meetup.webp',
    alt: 'Two women enjoying a friendly conversation in a bright public cafe',
  },
  {
    title: 'Celebrate with someone',
    description: 'Mark a birthday, a milestone, or a small win with someone happy to share the moment.',
    image: '/images/marketing/celebrate-with-someone.webp',
    alt: 'Two friends celebrating together with a small cake in a bright public cafe',
  },
] as const

const companyMoments = [
  {
    label: 'Your usual friends are busy',
    body: 'Keep the plan instead of waiting for everyone’s calendars to line up.',
  },
  {
    label: 'You are getting to know a place',
    body: 'Explore a neighborhood, market, or local interest with someone who knows the area.',
  },
  {
    label: 'You want a little momentum',
    body: 'Turn study time, a creative project, or an outdoor goal into something easier to begin.',
  },
  {
    label: 'You would rather start online',
    body: 'Choose conversation, gaming, language practice, or co-working from a familiar space.',
  },
] as const

const experienceModes = [
  {
    label: 'Meet in person',
    title: 'Make an ordinary outing feel more social.',
    body: 'Plan coffee in a public cafe, walk through a familiar neighborhood, visit a market, practice photography, or go to an event. You see the location, duration, boundaries, and price before sending a booking request.',
    examples: ['Coffee and meals', 'Local walks', 'Creative hobbies', 'Public events'],
    activity: activityExamples[5],
  },
  {
    label: 'Meet online',
    title: 'Share the time, even from different places.',
    body: 'Choose an online conversation, a focused work session, language practice, or gaming. Online sessions can be a comfortable first step when you want company without planning a trip across town.',
    examples: ['Conversation', 'Co-working', 'Language practice', 'Gaming sessions'],
    activity: activityExamples[4],
  },
] as const

const homeFaqs = [
  {
    question: "What is Let's Be Friends?",
    answer: "Let's Be Friends is a trust-first service for adults who want company for a shared activity or conversation. Members can discover Friend Hosts by activity, Strengths, location, availability, and whether an experience happens online or in person.",
  },
  {
    question: 'What is a Friend Host?',
    answer: 'A Friend Host is a verified member who offers a clearly described shared experience. They choose what they host, set their schedule and boundaries, and complete identity and profile review before becoming discoverable.',
  },
  {
    question: 'Is this a dating service?',
    answer: 'No. Experiences are platonic and activity-led. Profiles describe what people can do together, the boundaries that apply, and what members should expect from the time.',
  },
  {
    question: 'Can we meet online or in person?',
    answer: 'Yes. Friend Hosts choose whether they offer online sessions, in-person sessions, or both. The available mode appears on each profile before you plan anything.',
  },
  {
    question: 'How does safety work before a booking?',
    answer: 'Adults complete identity checks, and Friend Host profiles go through safety review before they can receive bookings. You can review public profile details, boundaries, timing, pricing, and privacy information before sending a request.',
  },
  {
    question: 'Can I look around before creating an account?',
    answer: 'Yes. You can explore public activities and Friend Host profiles first. An account is needed when you are ready to use personal features such as booking or creating a hosting profile.',
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
      <section className="invitation-hero">
        <div className="invitation-hero-copy">
          <p className="eyebrow">Good company, with safety built in</p>
          <h1 className="text-display invitation-title">
            What would feel better with company?
          </h1>
          <p className="lede invitation-lede">
            Meet verified people who are up for coffee, a walk, study time, gaming, or a
            conversation, online or nearby.
          </p>
          <div className="invitation-prompt-list" aria-label="Things you can do together">
            {invitationPrompts.map((prompt, index) => (
              <Link
                key={prompt}
                to="/discover"
                className="invitation-prompt"
                data-featured={index === 0 || undefined}
              >
                {prompt}
              </Link>
            ))}
          </div>
          <div className="invitation-actions">
            <Link to="/discover" className="btn btn-social btn-lg hero-action">Find someone to join you</Link>
            <HomeAuthAction />
            <Link to="/safety" className="btn btn-ghost">How safety works</Link>
          </div>
        </div>
        <div className="invitation-hero-art">
          <img
            src="/images/marketing/market-friends.webp"
            srcSet="/images/marketing/market-friends-768.webp 768w, /images/marketing/market-friends.webp 1536w"
            sizes="(max-width: 900px) calc(100vw - 1.75rem), 48vw"
            alt="Two friends laughing while exploring a neighborhood market together"
            loading="eager"
            decoding="async"
            fetchPriority="high"
            width={1536}
            height={1024}
            className="hero-art-img"
          />
          <div className="invitation-note">
            <span className="invitation-note-label">A simple first plan</span>
            <strong>Walk around, find something good, and enjoy having company.</strong>
          </div>
        </div>
      </section>

      <section className="activity-reel-band">
        <div className="marketing-page-wide activity-reel">
          <div className="section-heading-row activity-reel-heading">
            <div>
              <p className="eyebrow">Try something easy</p>
              <h2 className="text-display section-display">Plans that already sound like a good time.</h2>
            </div>
            <p className="lede">Start with an activity you already enjoy, or try one that has been waiting on your list.</p>
          </div>
          <div className="activity-reel-grid">
            {activityExamples.slice(0, 3).map((activity) => (
              <Link
                key={activity.title}
                to="/discover"
                className="activity-card"
                aria-label={`Explore people for ${activity.title.toLowerCase()}`}
              >
                <MarketingActivityImage
                  activity={activity}
                  sizes="(max-width: 700px) calc(100vw - 1.75rem), (max-width: 900px) calc(50vw - 1.5rem), 33vw"
                />
                <span className="activity-card-copy">
                  <strong>{activity.title}</strong>
                  <span>{activity.description}</span>
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="marketing-band invitation-intent-band" aria-labelledby="company-moments-title">
        <div className="marketing-page-wide">
          <div className="invitation-intent-layout">
            <div className="invitation-intent-copy">
              <p className="eyebrow">A clear reason to connect</p>
              <h2 id="company-moments-title" className="text-display section-display">There is no wrong reason to want company.</h2>
              <p className="lede mt-4">
                Friendship does not always begin with a big introduction. Sometimes it begins with
                a plan you already wanted to make and another person who is happy to join you.
              </p>
              <p className="text-body muted mt-4">
                Let’s Be Friends helps adults find verified people for platonic shared activities,
                local experiences, and online sessions. Start with what you want to do, then choose
                the person, setting, and boundaries that feel right.
              </p>
            </div>
            <div className="company-moment-list">
              {companyMoments.map((moment) => (
                <article key={moment.label}>
                  <h3>{moment.label}</h3>
                  <p>{moment.body}</p>
                </article>
              ))}
            </div>
          </div>
          <ActivityStoryPhoto
            activity={activityExamples[6]}
            className="invitation-intent-photo"
            sizes="(max-width: 700px) calc(100vw - 1.75rem), calc(100vw - 4rem)"
          />
        </div>
      </section>

      <section className="marketing-band invitation-how">
        <div className="marketing-page-wide">
          <div className="section-heading-row">
            <div>
              <p className="eyebrow">Before you meet</p>
              <h2 className="text-display section-display">Clear steps, without the guesswork.</h2>
            </div>
            <Link to="/safety" className="btn btn-ghost btn-sm hidden sm:inline-flex">
              See how safety works
            </Link>
          </div>
          <div className="invitation-step-grid">
            {beforeYouMeet.map((step, index) => (
              <article className="invitation-step" key={step.label}>
                <span className="invitation-step-number tabular">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <h3 className="text-h2">{step.label}</h3>
                <p className="text-body muted">{step.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="marketing-band invitation-modes" aria-labelledby="experience-modes-title">
        <div className="marketing-page-wide">
          <div className="section-heading-row invitation-modes-heading">
            <div>
              <p className="eyebrow">Choose your comfort level</p>
              <h2 id="experience-modes-title" className="text-display section-display">Online or nearby, the plan stays clear.</h2>
            </div>
            <p className="lede">Pick the setting that makes it easiest to say yes.</p>
          </div>
          <div className="experience-mode-grid">
            {experienceModes.map((mode, index) => (
              <article className="experience-mode" key={mode.label} data-mode={index === 0 ? 'social' : 'self'}>
                <ActivityStoryPhoto
                  activity={mode.activity}
                  className="experience-mode-photo"
                  sizes="(max-width: 900px) calc(100vw - 3.75rem), 50vw"
                />
                <div className="experience-mode-content">
                  <p className="experience-mode-label">{mode.label}</p>
                  <h3>{mode.title}</h3>
                  <p className="text-body muted">{mode.body}</p>
                  <ul aria-label={`${mode.label} examples`}>
                    {mode.examples.map((example) => <li key={example}>{example}</li>)}
                  </ul>
                  <Link to="/discover" className={index === 0 ? 'btn btn-social-quiet btn-sm' : 'btn btn-self-quiet btn-sm'}>
                    Explore {mode.label.toLowerCase()} options
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="marketing-band invitation-people">
        <div className="marketing-page-wide">
          <div className="section-heading-row">
            <div>
              <p className="eyebrow">People ready to join you</p>
              <h2 className="text-display section-display">Start with a person, not a listing.</h2>
            </div>
            <Link to="/discover" className="btn btn-social-quiet btn-sm">Explore everyone</Link>
          </div>
          <div className="invitation-host-grid">
              {hostsLoading && <HomeHostSkeletonRows />}
              {!hostsLoading && featured.length === 0 && (
                <div className="empty-state invitation-host-empty">
                  <p className="empty-state-title">New Friend Hosts are getting ready.</p>
                  <p className="text-meta">People will appear here after identity and profile review.</p>
                </div>
              )}
              {!hostsLoading && featured.map((host) => (
                <FeaturedHostRow key={host._id} host={host} />
              ))}
          </div>
        </div>
      </section>

      <section className="invitation-hosting-band">
        <div className="marketing-page-wide invitation-hosting-inner">
          <div>
            <p className="eyebrow">Have something you enjoy sharing?</p>
            <h2 className="text-display section-display">Make room for good company.</h2>
            <p className="lede mt-4">Create a hosting profile around an activity, conversation, or local knowledge. You choose your schedule, boundaries, and whether it happens online or in person.</p>
          </div>
          <Link to="/become-host" className="btn btn-self btn-lg">Share what you enjoy</Link>
        </div>
      </section>

      <section className="marketing-band invitation-faq" aria-labelledby="home-faq-title">
        <div className="marketing-page-wide invitation-faq-layout">
          <div className="invitation-faq-heading">
            <p className="eyebrow">Common questions</p>
            <h2 id="home-faq-title" className="text-display section-display">Know what to expect before you join.</h2>
            <p className="text-body muted mt-4">The short version of how membership, Friend Hosts, sessions, and safety work.</p>
            <Link to="/safety" className="btn btn-ghost btn-sm mt-5">Read the full safety guide</Link>
          </div>
          <div className="invitation-faq-list">
            {homeFaqs.map((item, index) => (
              <details key={item.question} open={index === 0}>
                <summary>{item.question}</summary>
                <p>{item.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="marketing-band-sunk invitation-final-cta">
        <div className="marketing-page-wide invitation-final-inner">
          <div className="invitation-final-copy">
            <p className="eyebrow">Your next plan can be small</p>
            <h2 className="text-display section-display">Choose one thing that would feel better together.</h2>
            <p className="lede mt-4">Browse first, create an account when you are ready, and move at your own pace.</p>
            <div className="invitation-final-actions">
              <Link to="/discover" className="btn btn-social btn-lg">Explore Friend Hosts</Link>
              <SignUpButton mode="modal">
                <button className="btn btn-self btn-lg">Create an account</button>
              </SignUpButton>
            </div>
          </div>
          <ActivityStoryPhoto
            activity={activityExamples[3]}
            className="invitation-final-photo"
            sizes="(max-width: 900px) calc(100vw - 3.75rem), 52vw"
          />
          <div className="invitation-category-line">
            <p className="eyebrow shrink-0">Things you can do together</p>
            <p className="text-body muted">{activityCategories.join(' · ')}</p>
          </div>
        </div>
      </section>
    </main>
  )
}

type MarketingActivity = (typeof activityExamples)[number]

function MarketingActivityImage({
  activity,
  sizes,
}: {
  activity: MarketingActivity
  sizes: string
}) {
  return (
    <img
      src={activity.image}
      srcSet={`${activity.image.replace('.webp', '-768.webp')} 768w, ${activity.image} 1536w`}
      sizes={sizes}
      alt={activity.alt}
      loading="lazy"
      decoding="async"
      width={1536}
      height={1024}
    />
  )
}

function ActivityStoryPhoto({
  activity,
  className,
  sizes,
}: {
  activity: MarketingActivity
  className: string
  sizes: string
}) {
  return (
    <figure className={`activity-story-photo ${className}`}>
      <MarketingActivityImage activity={activity} sizes={sizes} />
      <figcaption>
        <strong>{activity.title}</strong>
        <span>{activity.description}</span>
      </figcaption>
    </figure>
  )
}

function HomeHostSkeletonRows() {
  return (
    <>
      {Array.from({ length: 3 }).map((_, index) => (
        <article className="invitation-host-card skeleton-row" aria-hidden="true" key={index}>
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
    <article className="invitation-host-card">
      <div className="worklist-row-head invitation-host-card-head">
        <div className="flex items-center gap-3 min-w-0">
          <span className="avatar" aria-hidden="true">{initials(host.displayName)}</span>
          <div className="min-w-0">
            <p className="text-meta">Up for something together</p>
            <h3 className="text-h2 truncate">{host.displayName}</h3>
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
            <Link to="/host-profile" search={{ hostProfileId: host._id }} className="btn btn-social btn-sm">
              See their ideas
            </Link>
          ) : (
            <span className="text-meta">Demo</span>
          )}
        </div>
      </div>
      <p className="text-body muted line-clamp-3">{host.intro}</p>
      <div className="invitation-strengths" aria-label={`${host.displayName}'s strengths`}>
        {host.strengths.slice(0, 3).map((strength) => <span key={strength}>{strength}</span>)}
      </div>
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
      <button className="btn btn-self btn-lg hero-action">Share what you enjoy</button>
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
