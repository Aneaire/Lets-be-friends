import {
  currentPolicyVersion,
  getPolicyDocument,
  otherPolicyDocument,
  policyCrossLinkLabel,
  policyEffectiveDate,
  type PolicyDocumentId,
} from '@lets-be-friends/shared'

// Screen copy comes from the shared policy catalog so the app and website
// cannot drift on titles, section order, version, or crosslinks.
export function policyDocumentPresentation(documentId: PolicyDocumentId) {
  const document = getPolicyDocument(documentId)
  const related = otherPolicyDocument(documentId)
  return {
    title: document.title,
    sections: document.sections,
    version: currentPolicyVersion,
    effectiveDate: policyEffectiveDate,
    relatedTitle: related.title,
    relatedPath: related.path,
    relatedLabel: policyCrossLinkLabel(related),
  }
}
