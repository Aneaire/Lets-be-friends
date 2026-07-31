import { createFileRoute, Link } from '@tanstack/react-router'

export const Route = createFileRoute('/safety')({ component: SafetyPage })

const trustGates = [
  {
    what: 'Adult-only access',
    who: 'Account creation',
    when: 'Persona checks date of birth from a government ID before booking or public discovery can unlock.',
  },
  {
    what: 'Host approval',
    who: 'Safety review queue',
    when: 'Every Friend Host application is held until a reviewer decides approve or reject.',
  },
  {
    what: 'Identity verification',
    who: 'Persona + safety review queue',
    when: 'Persona checks a government ID, live selfie, liveness, and face match. Every completed result then receives an explicit admin decision.',
  },
  {
    what: 'Location privacy',
    who: 'Host & member',
    when: 'Exact meeting details unlock only after the host accepts the booking.',
  },
  {
    what: 'Reportable everywhere',
    who: 'Any signed-in user',
    when: 'Profiles, posts, messages, bookings, and reviews each create a safety report.',
  },
] as const

function SafetyPage() {
  return (
    <main className="marketing-page">
      <p className="eyebrow">Safety model</p>
      <h1 className="text-display mt-5 max-w-[20ch]">
        Safety is the product, not a page in the footer.
      </h1>
      <p className="lede mt-6">
        Let&apos;s Be Friends is built around explicit trust gates. Each one decides whether a
        member can request a booking or a Friend Host can appear in discovery.
      </p>

      <section className="mt-12">
        <header className="flex items-baseline justify-between gap-4 mb-4">
          <h2 className="text-h2">What is checked, who checks it, when it unlocks.</h2>
        </header>
        <dl className="definition-table">
          <div className="definition-row" role="row" aria-hidden="true">
            <dt className="text-meta uppercase tracking-wide">Check</dt>
            <dt className="text-meta uppercase tracking-wide">Who</dt>
            <dt className="text-meta uppercase tracking-wide">When</dt>
          </div>
          {trustGates.map((gate) => (
            <div className="definition-row" key={gate.what}>
              <dt>{gate.what}</dt>
              <dd>{gate.who}</dd>
              <dd>{gate.when}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="mt-12 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-body muted max-w-[60ch]">
          Persona securely collects identity evidence; Let&apos;s Be Friends stores only the verification outcome and operational metadata. Raw government-ID and selfie media are not copied into this app.
        </p>
        <div className="flex gap-2">
          <Link to="/discover" className="btn btn-neutral btn-sm">Open discovery</Link>
          <Link to="/become-host" className="btn btn-self btn-sm">Apply as a host</Link>
        </div>
      </section>
    </main>
  )
}
