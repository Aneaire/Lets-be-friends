import { createFileRoute, Link } from '@tanstack/react-router'

export const Route = createFileRoute('/child-safety')({
  component: ChildSafetyPage,
  head: () => ({
    meta: [{ title: "Child safety standards | Let's Be Friends" }],
  }),
})

export function ChildSafetyPage() {
  return (
    <main className="marketing-page legal-page">
      <p className="eyebrow">Safety</p>
      <h1 className="text-display mt-4">Child safety standards</h1>
      <p className="text-meta mt-2">Last updated 22 November 2026</p>

      <p className="text-body muted mt-4">
        Let's Be Friends is an adults-only service. These standards explain what we prohibit,
        how we enforce it, and how anyone can report a concern about a child.
      </p>

      <section className="mt-6">
        <h2 className="text-h2">Who may use the service</h2>
        <p className="text-body muted mt-2">
          You must be 18 or older to create an account, act as a Companion, or book an experience.
          Accounts that we determine belong to a minor are removed.
        </p>
      </section>

      <section className="mt-6">
        <h2 className="text-h2">What is prohibited</h2>
        <ul className="text-body muted mt-2">
          <li>Any content that sexualizes, endangers, or exploits a minor.</li>
          <li>Sharing, requesting, or linking to child sexual abuse material in any form.</li>
          <li>Using the service to contact a minor, arrange to meet a minor, or discuss a minor in a sexual or romantic way.</li>
          <li>Impersonating a minor, or helping anyone evade our age requirements.</li>
        </ul>
      </section>

      <section className="mt-6">
        <h2 className="text-h2">How we enforce it</h2>
        <ul className="text-body muted mt-2">
          <li>Identity review is required before booking, and a completed submission receives a safety-team decision.</li>
          <li>Members can report profiles, posts, comments, messages, reviews, Circles, and bookings from inside the app.</li>
          <li>Members can block other members, and reports enter a moderation queue that a human reviews.</li>
          <li>Content and accounts that violate these standards are removed or suspended, and repeat violations end access.</li>
          <li>We preserve relevant records and cooperate with law enforcement and child protection authorities where the law requires it.</li>
        </ul>
      </section>

      <section className="mt-6">
        <h2 className="text-h2">How to report a concern</h2>
        <p className="text-body muted mt-2">
          Report inside the app using the report action on the profile, post, message, review, or
          booking. Reports about a child are treated as urgent and escalated to our safety team.
        </p>
        <p className="text-body muted mt-2">
          You can also contact us directly at <a className="underline" href="mailto:letsbefriends896@gmail.com">letsbefriends896@gmail.com</a>.
          If a child is in immediate danger, contact your local emergency services first.
        </p>
      </section>

      <section className="mt-6">
        <h2 className="text-h2">Designated point of contact</h2>
        <p className="text-body muted mt-2">
          Our child safety contact is reachable at the address above and is responsible for
          handling reports, cooperating with authorities, and keeping these standards current.
        </p>
      </section>

      <nav className="mt-6" aria-label="Safety pages">
        <Link to="/privacy-policy" className="btn btn-neutral btn-sm">Privacy Policy</Link>
        <Link to="/terms-and-conditions" className="btn btn-neutral btn-sm ml-2">Terms and Conditions</Link>
      </nav>
    </main>
  )
}
