import { createFileRoute, Link } from '@tanstack/react-router'
import { currentPolicyVersion, policyEffectiveDate, privacySections, termsPath } from '@lets-be-friends/shared'

export const Route = createFileRoute('/privacy-policy')({
  component: PrivacyPolicyPage,
  head: () => ({
    meta: [{ title: "Privacy Policy | Let's Be Friends" }],
  }),
})

export function PrivacyPolicyPage() {
  return (
    <main className="marketing-page legal-page">
      <p className="eyebrow">Privacy Policy</p>
      <h1 className="text-display mt-4">Privacy Policy</h1>
      <p className="text-meta mt-2">Version {currentPolicyVersion}. Effective {policyEffectiveDate}.</p>
      {privacySections.map((section) => (
        <section key={section.heading} className="mt-6">
          <h2 className="text-h2">{section.heading}</h2>
          {section.paragraphs.map((paragraph) => (
            <p key={paragraph.slice(0, 32)} className="text-body muted mt-2">{paragraph}</p>
          ))}
        </section>
      ))}
      <nav className="mt-6" aria-label="Related policy pages">
        <Link to={termsPath as '/terms-and-conditions'} className="btn btn-neutral btn-sm">Read the Terms and Conditions</Link>
      </nav>
    </main>
  )
}
