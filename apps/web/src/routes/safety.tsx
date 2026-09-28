import { createFileRoute, Link } from '@tanstack/react-router'
import { OpenableImage } from '../design-system/molecules/OpenableImage'
import {
  friendayCheckins,
  friendayNotAllowed,
  friendayPromise,
  friendaySafetyGroups,
  friendaySteps,
} from '../features/social/FriendayGuide'

export const Route = createFileRoute('/safety')({ component: SafetyPage })

const safetySteps = [
  {
    title: 'Adults verify once',
    body: 'A government ID and current camera selfie support identity and age review before someone can send a booking request.',
    detail: 'AI extracts editable details from the ID only. Let’s Be Friends privately stores the ID and current selfie for safety review and incident records for up to 730 days, subject to incident or legal holds.',
  },
  {
    title: 'Every Companion is reviewed',
    body: 'Companion profiles stay out of Explore until identity and profile review are complete.',
    detail: 'Reviewers check the Companion profile, activity categories, boundaries, and verification result before making it visible.',
  },
  {
    title: 'You choose what to share',
    body: 'Public profiles use a city or broad area. Exact meeting details stay private until a Companion accepts the booking.',
    detail: 'Nearby search uses rounded locations and never reveals a Companion pin or saved approximate area.',
  },
  {
    title: 'Money follows the plan',
    body: 'You see the complete booking total, including the service fee, before sending. Funds are reserved only when the Companion accepts.',
    detail: 'After both people confirm completion, funds remain pending for 24 hours before settlement can continue.',
  },
  {
    title: 'Help stays within reach',
    body: 'Profiles, posts, messages, bookings, and reviews can all be reported. A booking report pauses unsettled funds for review.',
    detail: 'Private check-in photos are optional. A reviewer can retrieve one only while a linked booking report is active, and access is audited.',
  },
] as const

function SafetyPage() {
  return (
    <main className="marketing-page-wide safety-page">
      <section className="safety-hero">
        <div className="safety-hero-copy">
          <h1 className="text-display mt-4">
            Know what happens before you meet.
          </h1>
          <div className="safety-hero-actions">
            <Link to="/nearby" className="btn btn-social">Find a Companion</Link>
            <Link to="/become-companion" className="btn btn-self">Become a Companion</Link>
          </div>
        </div>
        <figure className="marketing-photo safety-hero-photo">
          <OpenableImage
            src="/images/marketing/public-cafe-meetup.webp"
            alt="Two women having a relaxed first conversation in a bright public cafe"
            loading="eager"
            decoding="async"
          />
          <figcaption>
            <strong>Start somewhere comfortable.</strong>
            <span>A public place, a clear plan, and time to decide at your own pace.</span>
          </figcaption>
        </figure>
      </section>

      <section className="safety-journey">
        <header className="section-heading-row">
          <div>
            <p className="eyebrow">Before, during, and after</p>
            <h2 className="text-display section-display">Five promises, in plain language.</h2>
          </div>
        </header>
        <ol className="safety-step-list">
          {safetySteps.map((step, index) => (
            <li className="safety-step" key={step.title}>
              <span className="safety-step-number tabular">{String(index + 1).padStart(2, '0')}</span>
              <div>
                <h3 className="text-h2">{step.title}</h3>
                <p className="text-body">{step.body}</p>
                <p className="text-meta">{step.detail}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="safety-control-grid" aria-label="Your controls">
        <article><span>01</span><h3>Your boundaries stay visible</h3><p>Read what a Companion offers and what they do not offer before you request a time.</p></article>
        <article><span>02</span><h3>Your location stays broad</h3><p>Nearby results can show approximate distance without revealing someone’s saved pin.</p></article>
        <article><span>03</span><h3>You can report without evidence</h3><p>A private check-in photo is optional and is never required to raise a safety concern.</p></article>
      </section>

      <details className="safety-technical">
        <summary>Technical and policy details</summary>
        <div className="safety-technical-body">
          <p><strong>Identity:</strong> AI extracts editable fields from the government ID, then the member takes a current camera selfie. The selfie is not sent to the AI, face matched, or treated as biometric liveness proof. Every completed submission receives an explicit safety-team decision.</p>
          <p><strong>Payments:</strong> The member sees one booking total that includes the service fee. Acceptance reserves the total; mutual completion begins a 24-hour pending period.</p>
          <p><strong>Private booking evidence:</strong> The Companion decides at the start and the member decides at the end. Each may upload a private image or explicitly skip after a warning. Retrieval requires an active linked report and is audit-logged.</p>
          <p><strong>Reports:</strong> Participant booking reports block unsettled wallet funds until a full admin records a resolution.</p>
        </div>
      </details>

      <section className="frienday-full-guide" id="frienday" aria-labelledby="frienday-title">
        <p className="eyebrow">Frienday guide</p>
        <h2 id="frienday-title" className="text-display section-display">Meet. Help. Earn. Make everyday life easier.</h2>
        <p className="lede mt-4">
          A Frienday is the agreed time when a Friend and a Friender meet and complete a booked
          activity. In this guide, Friend means the Companion offering help and Friender means the
          member booking help. Every Frienday has a clear task, an agreed time and place, a confirmed price,
          clear boundaries, three check-ins when required, and completion confirmation before payment.
        </p>
        <div className="frienday-full-grid">
          <article className="frienday-full-card" aria-labelledby="frienday-steps-title">
            <h3 id="frienday-steps-title">How a Frienday works</h3>
            <p>Nine steps from profile setup to review. Keep every agreement and change inside the app.</p>
            <ol>
              {friendaySteps.map((step) => (
                <li key={step.title}>
                  <strong>{step.title}.</strong> {step.body}
                </li>
              ))}
            </ol>
          </article>
          <article className="frienday-full-card" aria-labelledby="frienday-checkins-title">
            <h3 id="frienday-checkins-title">Three Friend Selfie check-ins</h3>
            <p>Selfies support check-in and safety steps. They do not prove all work was complete and do not replace emergency services.</p>
            <ul>
              {friendayCheckins.map((checkin) => (
                <li key={checkin.title}>
                  <strong>{checkin.title}.</strong> {checkin.when}: {checkin.purpose}
                </li>
              ))}
            </ul>
          </article>
          <article className="frienday-full-card" id="frienday-safety" aria-labelledby="frienday-safety-title">
            <h3 id="frienday-safety-title">Frienday safety rules</h3>
            <p>Meet in a well lit public place when possible. Confirm the person matches the profile before continuing.</p>
            {friendaySafetyGroups.map((group) => (
              <div key={group.title}>
                <p><strong>{group.title}</strong></p>
                <ul>
                  {group.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ))}
          </article>
          <article className="frienday-full-card" id="frienday-not-allowed" aria-labelledby="frienday-not-allowed-title">
            <h3 id="frienday-not-allowed-title">Activities that are not allowed</h3>
            <p>These may not be requested, offered, or completed through Let&apos;s Be Friends.</p>
            <ul>
              {friendayNotAllowed.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </article>
        </div>
        <article className="frienday-full-card mt-4" id="frienday-promise" aria-labelledby="frienday-promise-title">
          <h3 id="frienday-promise-title">A simple Frienday promise</h3>
          <p>By booking or accepting a Frienday, both people agree to:</p>
          <ul>
            {friendayPromise.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <div className="frienday-full-actions">
            <Link to="/become-companion" className="btn btn-self">Create your Companion profile</Link>
            <Link to="/nearby" className="btn btn-social">Find a Companion</Link>
          </div>
        </article>
      </section>

      <section className="safety-closing">
        <p className="eyebrow">A safer plan still starts with a good fit</p>
        <h2 className="text-display section-display">Take your time. Read the profile. Ask questions.</h2>
        <Link to="/nearby" className="btn btn-social btn-lg">Explore people and experiences</Link>
      </section>
    </main>
  )
}
