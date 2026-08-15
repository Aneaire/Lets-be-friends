import { createFileRoute, Link } from '@tanstack/react-router'

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
            <Link to="/discover" className="btn btn-social">Find a Companion</Link>
            <Link to="/become-companion" className="btn btn-self">Become a Companion</Link>
          </div>
        </div>
        <figure className="marketing-photo safety-hero-photo">
          <img
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

      <section className="safety-closing">
        <p className="eyebrow">A safer plan still starts with a good fit</p>
        <h2 className="text-display section-display">Take your time. Read the profile. Ask questions.</h2>
        <Link to="/discover" className="btn btn-social btn-lg">Explore people and experiences</Link>
      </section>
    </main>
  )
}
