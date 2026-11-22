import { createFileRoute, Link } from '@tanstack/react-router'
import {
  currentPolicyVersion,
  otherPolicyDocument,
  policyCrossLinkLabel,
  policyEffectiveDate,
  privacyDocument,
} from '@lets-be-friends/shared'

export const Route = createFileRoute('/privacy-policy')({
  component: PrivacyPolicyPage,
  head: () => ({
    meta: [{ title: "Privacy Policy | Let's Be Friends" }],
  }),
})

export function PrivacyPolicyPage() {
  const related = otherPolicyDocument(privacyDocument)
  return (
    <main className="marketing-page legal-page">
      <p className="eyebrow">Legal</p>
      <h1 className="text-display mt-4">{privacyDocument.title}</h1>
      <p className="text-meta mt-2">Version {currentPolicyVersion}. Effective {policyEffectiveDate}.</p>
      {privacyDocument.sections.map((section) => (
        <section key={section.heading} className="mt-6">
          <h2 className="text-h2">{section.heading}</h2>
          {section.paragraphs.map((paragraph) => (
            <p key={paragraph.slice(0, 32)} className="text-body muted mt-2">{paragraph}</p>
          ))}
        </section>
      ))}
      <nav className="mt-6" aria-label="Related policy pages">
        <Link to={related.path} className="btn btn-neutral btn-sm">{policyCrossLinkLabel(related)}</Link>
        <Link to="/account-deletion" className="btn btn-neutral btn-sm ml-2">Delete your account</Link>
        <Link to="/child-safety" className="btn btn-neutral btn-sm ml-2">Child safety</Link>
      </nav>
    </main>
  )
}
