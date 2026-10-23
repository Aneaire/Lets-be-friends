import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { currentPolicyVersion, policyEffectiveDate, privacyDocument, termsDocument } from '@lets-be-friends/shared'

import { policyDocumentPresentation } from '@/features/policy/policyPresentation'

const source = (path: string) => readFileSync(join(process.cwd(), 'src', path), 'utf8')

describe('mobile legal policy surfaces', () => {
  it('builds both screens from the shared policy catalog', () => {
    expect(policyDocumentPresentation('terms')).toMatchObject({
      title: termsDocument.title,
      sections: termsDocument.sections,
      version: currentPolicyVersion,
      effectiveDate: policyEffectiveDate,
      relatedTitle: privacyDocument.title,
      relatedPath: '/privacy-policy',
      relatedLabel: 'Read the Privacy Policy',
    })
    expect(policyDocumentPresentation('privacy')).toMatchObject({
      title: privacyDocument.title,
      sections: privacyDocument.sections,
      version: currentPolicyVersion,
      effectiveDate: policyEffectiveDate,
      relatedTitle: termsDocument.title,
      relatedPath: '/terms-and-conditions',
      relatedLabel: 'Read the Terms and Conditions',
    })
  })

  it('keeps both legal routes registered and backed by the shared screen', () => {
    const layout = source('app/_layout.tsx')
    expect(layout).toContain('<Stack.Screen name="terms-and-conditions" />')
    expect(layout).toContain('<Stack.Screen name="privacy-policy" />')
    expect(source('app/terms-and-conditions.tsx')).toContain('documentId="terms"')
    expect(source('app/privacy-policy.tsx')).toContain('documentId="privacy"')
  })

  it('uses shared document metadata in onboarding and profile links', () => {
    expect(source('app/onboarding.tsx')).toContain('policyDocuments.map')
    expect(source('app/onboarding.tsx')).toContain('document.acceptanceLabel')
    expect(source('member/ProfileContent.tsx')).toContain('termsDocument.title')
    expect(source('member/ProfileContent.tsx')).toContain('privacyDocument.title')
    expect(source('app/(tabs)/profile.tsx')).toContain('router.push(\'/terms-and-conditions\')')
    expect(source('app/(tabs)/profile.tsx')).toContain('router.push(\'/privacy-policy\')')
  })
})
