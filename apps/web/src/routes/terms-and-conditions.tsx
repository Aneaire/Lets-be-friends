import { createFileRoute, Link } from '@tanstack/react-router'
import {
  currentPolicyVersion,
  otherPolicyDocument,
  policyCrossLinkLabel,
  policyEffectiveDate,
  termsDocument,
} from '@lets-be-friends/shared'

export const Route = createFileRoute('/terms-and-conditions')({
  component: TermsAndConditionsPage,
  head: () => ({
    meta: [{ title: "Terms and Conditions | Let's Be Friends" }],
  }),
})

export function TermsAndConditionsPage() {
  const related = otherPolicyDocument(termsDocument)
  return (
    <main className="marketing-page legal-page">
      <p className="eyebrow">{termsDocument.title}</p>
      <h1 className="text-display mt-4">{termsDocument.title}</h1>
      <p className="text-meta mt-2">Version {currentPolicyVersion}. Effective {policyEffectiveDate}.</p>
      {termsDocument.sections.map((section) => (
        <section key={section.heading} className="mt-6">
          <h2 className="text-h2">{section.heading}</h2>
          {section.paragraphs.map((paragraph) => (
            <p key={paragraph.slice(0, 32)} className="text-body muted mt-2">{paragraph}</p>
          ))}
        </section>
      ))}
      <nav className="mt-6" aria-label="Related policy pages">
        <Link to={related.path} className="btn btn-neutral btn-sm">{policyCrossLinkLabel(related)}</Link>
      </nav>
    </main>
  )
}
