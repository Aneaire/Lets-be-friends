import { createFileRoute, Link } from '@tanstack/react-router'
import { currentPolicyVersion, policyEffectiveDate, privacyPath, termsSections } from '@lets-be-friends/shared'

export const Route = createFileRoute('/terms-and-conditions')({
  component: TermsAndConditionsPage,
  head: () => ({
    meta: [{ title: "Terms and Conditions | Let's Be Friends" }],
  }),
})

export function TermsAndConditionsPage() {
  return (
    <main className="marketing-page legal-page">
      <p className="eyebrow">Terms and Conditions</p>
      <h1 className="text-display mt-4">Terms and Conditions</h1>
      <p className="text-meta mt-2">Version {currentPolicyVersion}. Effective {policyEffectiveDate}.</p>
      {termsSections.map((section) => (
        <section key={section.heading} className="mt-6">
          <h2 className="text-h2">{section.heading}</h2>
          {section.paragraphs.map((paragraph) => (
            <p key={paragraph.slice(0, 32)} className="text-body muted mt-2">{paragraph}</p>
          ))}
        </section>
      ))}
      <nav className="mt-6" aria-label="Related policy pages">
        <Link to={privacyPath as '/privacy-policy'} className="btn btn-neutral btn-sm">Read the Privacy Policy</Link>
      </nav>
    </main>
  )
}
