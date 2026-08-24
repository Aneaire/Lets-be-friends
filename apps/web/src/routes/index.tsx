import { Link, Navigate, createFileRoute } from '@tanstack/react-router'
import { useAuth } from '@clerk/react'
import { useQuery } from 'convex/react'
import { activityCategories } from '@lets-be-friends/shared'
import { api } from '../../convex/_generated/api'

const homeTitle = "Everyday Help and Real Connections | Let's Be Friends"
const homeDescription = 'Find verified Companions who offer everyday help, shared activities, and friendly company, or become a Companion and earn by sharing your Strengths.'

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

type HomeCompanion = {
  _id: string
  displayName: string
  city: string
  mode: 'online' | 'in_person' | 'both'
  intro: string
  strengths: string[]
  bookable?: boolean
}

const invitationPrompts = [
  'Shopping and errands',
  'Technology help',
  'Learn or share a hobby',
  'Company for a walk',
  'Focused time together',
  'Friendly conversation',
] as const

const beforeYouMeet = [
  {
    label: 'Create your profile',
    body: 'Share your interests and Strengths, or describe the kind of help and company you want.',
  },
  {
    label: 'Find the right fit',
    body: 'Explore Companions by Strengths, interests, availability, session format, and boundaries.',
  },
  {
    label: 'Make a clear plan',
    body: 'Choose what you want to do, review the time and price, then send a booking request.',
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
    label: 'An errand feels easier with help',
    body: 'Find another pair of hands and some friendly company for an everyday plan.',
  },
  {
    label: 'You want to learn something useful',
    body: 'Meet someone happy to share a hobby, local knowledge, or an everyday skill.',
  },
  {
    label: 'You want a little momentum',
    body: 'Make study time, a creative project, or a trip to the shops easier to begin.',
  },
  {
    label: 'You could use good company',
    body: 'Choose conversation, gaming, language practice, or a shared plan with someone new.',
  },
] as const

const experienceModes = [
  {
    label: 'Meet in person',
    title: 'Make everyday plans easier and more social.',
    body: 'Shop for groceries, run an errand together, walk through a neighborhood, practice a hobby, or share a meal. You see the location, duration, boundaries, and price before sending a booking request.',
    examples: ['Shopping and errands', 'Local walks', 'Creative hobbies', 'Coffee and meals'],
    activity: activityExamples[5],
  },
  {
    label: 'Meet online',
    title: 'Share help and company from different places.',
    body: 'Choose technology help, an online conversation, a focused work session, language practice, or gaming. An online session can be an easy first step when you want support or company from home.',
    examples: ['Technology help', 'Conversation', 'Language practice', 'Gaming sessions'],
    activity: activityExamples[4],
  },
] as const

const homeFaqs = [
  {
    question: "What is Let's Be Friends?",
    answer: "Let's Be Friends is a trust-first community for adults who want everyday help, friendly company, or a shared activity. Members can discover Companions by Strengths, interests, location, availability, and whether an experience happens online or in person.",
  },
  {
    question: 'What is a Companion?',
    answer: 'A Companion is a verified member who offers clearly described everyday help, company, or shared experiences. Companions choose what they offer, set their schedule, rate, and boundaries, and complete identity and profile review before becoming discoverable.',
  },
  {
    question: 'Is this a dating service?',
    answer: 'No. Experiences are platonic and activity-led. Profiles describe what people can do together, the boundaries that apply, and what members should expect from the time.',
  },
  {
    question: 'Can we meet online or in person?',
    answer: 'Yes. Companions choose whether they offer online sessions, in-person sessions, or both. The available mode appears on each profile before you plan anything.',
  },
  {
    question: 'How does safety work before a booking?',
    answer: 'Adults complete identity checks, and Companion profiles go through safety review before they can receive bookings. You can review public profile details, boundaries, timing, pricing, and privacy information before sending a request.',
  },
  {
    question: 'Can I look around before creating an account?',
    answer: 'Yes. You can explore public activities and Companion profiles first. An account is needed when you are ready to use personal features such as booking or creating a Companion profile.',
  },
] as const

function HomePage() {
  const { isSignedIn } = useAuth()
  const companionsResult = useQuery(api.companions.listApproved, isSignedIn ? 'skip' : {}) as HomeCompanion[] | undefined
  const companions = companionsResult ?? []
  const companionsLoading = companionsResult === undefined
  const featured = companions.slice(0, 4)

  if (isSignedIn) return <Navigate to="/social" replace />

  return (
    <main>
      <section className="invitation-hero">
        <div className="invitation-hero-copy">
          <p className="eyebrow">Everyday skills. Real connections.</p>
          <h1 className="text-display invitation-title">
            Make a friend. Lend a hand. Earn along the way.
          </h1>
          <p className="lede">
            Let’s Be Friends connects people who need a little help with people happy to share the
            everyday Strengths they already use.
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
            <Link to="/discover" className="btn btn-social btn-lg hero-action">Explore Companions</Link>
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
            <span className="invitation-note-label">Everyday help, made personal</span>
            <strong>Get something done together and enjoy the company along the way.</strong>
          </div>
        </div>
      </section>

      <section className="activity-reel-band">
        <div className="marketing-page-wide activity-reel">
          <div className="section-heading-row activity-reel-heading">
            <div>
              <p className="eyebrow">You do not need to be an expert</p>
              <h2 className="text-display section-display">Simple skills can mean a lot to someone.</h2>
            </div>
            <p className="lede">What feels ordinary to you could make someone else’s day easier and create a chance to connect.</p>
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
              <p className="eyebrow">Everyday Strengths have value</p>
              <h2 id="company-moments-title" className="text-display section-display">Everyone has something they can offer.</h2>
              <p className="lede mt-4">
                You may be good at organizing a plan, explaining technology, navigating your city,
                teaching a hobby, or simply making people feel heard.
              </p>
              <p className="text-body muted mt-4">
                Those everyday Strengths can help another member, give you a flexible way to earn,
                and make space for a genuine new connection.
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
              <p className="eyebrow">How it works</p>
              <h2 className="text-display section-display">Start with a profile. End with a plan.</h2>
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
              <p className="eyebrow">Everyday help can take many forms</p>
              <h2 id="experience-modes-title" className="text-display section-display">Choose what feels useful and comfortable.</h2>
            </div>
            <p className="lede">Meet nearby or start online. The plan, price, and boundaries stay clear.</p>
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
              <p className="eyebrow">Need a little help?</p>
              <h2 className="text-display section-display">Find someone you will enjoy spending time with.</h2>
            </div>
            <Link to="/discover" className="btn btn-social-quiet btn-sm">Explore everyone</Link>
          </div>
          <div className="invitation-companion-grid">
              {companionsLoading && <HomeCompanionSkeletonRows />}
              {!companionsLoading && featured.length === 0 && (
                <div className="empty-state invitation-companion-empty">
                  <p className="empty-state-title">New Companions are getting ready.</p>
                  <p className="text-meta">People will appear here after identity and profile review.</p>
                </div>
              )}
              {!companionsLoading && featured.map((companion) => (
                <FeaturedCompanionRow key={companion._id} companion={companion} />
              ))}
          </div>
        </div>
      </section>

      <section className="invitation-companion-band">
        <div className="marketing-page-wide invitation-companion-inner">
          <div>
            <p className="eyebrow">Earn on your terms</p>
            <h2 className="text-display section-display">Earn by being helpful.</h2>
            <p className="lede mt-4">Create a Companion profile, share the Strengths and activities you are comfortable offering, set your availability and rate, then connect with members looking for that kind of help.</p>
          </div>
          <Link to="/become-companion" className="btn btn-self btn-lg">Become a Companion</Link>
        </div>
      </section>

      <section className="marketing-band invitation-faq" aria-labelledby="home-faq-title">
        <div className="marketing-page-wide invitation-faq-layout">
          <div className="invitation-faq-heading">
            <p className="eyebrow">Trust makes connection possible</p>
            <h2 id="home-faq-title" className="text-display section-display">Feel comfortable knowing who you are meeting.</h2>
            <p className="text-body muted mt-4">The short version of how membership, Companions, sessions, and safety work.</p>
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
            <p className="eyebrow">Your everyday Strengths have value</p>
            <h2 className="text-display section-display">Help with the little things. Earn on your terms. Meet someone new.</h2>
            <p className="lede mt-4">Let’s make everyday life a little easier and a little less lonely.</p>
            <div className="invitation-final-actions">
              <Link to="/become-companion" className="btn btn-self btn-lg">Become a Companion</Link>
              <Link to="/discover" className="btn btn-social btn-lg">Find a Companion</Link>
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

function HomeCompanionSkeletonRows() {
  return (
    <>
      {Array.from({ length: 3 }).map((_, index) => (
        <article className="invitation-companion-card skeleton-row" aria-hidden="true" key={index}>
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

function FeaturedCompanionRow({ companion }: { companion: HomeCompanion }) {
  return (
    <article className="invitation-companion-card">
      <div className="worklist-row-head invitation-companion-card-head">
        <div className="flex items-center gap-3 min-w-0">
          <span className="avatar" aria-hidden="true">{initials(companion.displayName)}</span>
          <div className="min-w-0">
            <p className="text-meta">Up for something together</p>
            <h3 className="text-h2 truncate">{companion.displayName}</h3>
            <div className="worklist-row-meta">
              <span>{companion.city}</span>
              <span className="dot" aria-hidden="true" />
              <span>{formatMode(companion.mode)}</span>
              <span className="dot" aria-hidden="true" />
              <TrustChip state={companion.bookable ? 'verified' : 'awaiting'} />
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Link to="/companion-profile" search={{ companionProfileId: companion._id }} className="btn btn-social btn-sm">
            See their ideas
          </Link>
        </div>
      </div>
      <p className="text-body muted line-clamp-3">{companion.intro}</p>
      <div className="invitation-strengths" aria-label={`${companion.displayName}'s strengths`}>
        {companion.strengths.slice(0, 3).map((strength) => <span key={strength}>{strength}</span>)}
      </div>
    </article>
  )
}

function TrustChip({ state }: { state: 'verified' | 'awaiting' }) {
  const label = state === 'verified' ? 'Verified after review' : 'Awaiting review'
  return (
    <span className="trust-chip" data-state={state}>
      <span className="trust-chip-dot" aria-hidden="true" />
      {label}
    </span>
  )
}

function HomeAuthAction() {
  return (
    <Link to="/become-companion" className="btn btn-self btn-lg hero-action">
      Become a Companion
    </Link>
  )
}

function formatMode(mode: HomeCompanion['mode']) {
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
