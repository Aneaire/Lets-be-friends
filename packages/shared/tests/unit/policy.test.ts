import { describe, expect, it } from 'vitest'
import {
  currentPolicyVersion,
  getPolicyDocument,
  hasCurrentUnifiedAcceptance,
  isPublicLegalPath,
  otherPolicyDocument,
  policyCrossLinkLabel,
  policyDocuments,
  policyEffectiveDate,
  previousPolicyVersion,
  privacyAcceptanceLabel,
  privacyDocument,
  privacySections,
  privacySummaryParagraphs,
  publicLegalPaths,
  termsAcceptanceLabel,
  termsDocument,
  termsSections,
  termsSummaryParagraphs,
  unifiedAcceptanceStatement,
} from '../../src/policy'

const legacyVersion = '2026-08-13'
const old730Version = '2026-10-17'

const current = {
  approximateLocationConsentedAt: 1,
  termsAcceptedAt: 1,
  termsVersion: currentPolicyVersion,
  privacyPolicyAcceptedAt: 1,
  privacyPolicyVersion: currentPolicyVersion,
  identityConsentAcceptedAt: 1,
  identityConsentVersion: currentPolicyVersion,
}

describe('unified policy acceptance', () => {
  it('uses the 2026-10-17.2 lifetime version effective 2026-10-17', () => {
    expect(currentPolicyVersion).toBe('2026-10-17.2')
    expect(policyEffectiveDate).toBe('2026-10-17')
    expect(previousPolicyVersion).toBe(old730Version)
  })

  it('accepts only the full current scope', () => {
    expect(hasCurrentUnifiedAcceptance(current)).toBe(true)
    expect(hasCurrentUnifiedAcceptance(null)).toBe(false)
    expect(hasCurrentUnifiedAcceptance(undefined)).toBe(false)
    expect(hasCurrentUnifiedAcceptance({ ...current, termsVersion: legacyVersion })).toBe(false)
    expect(hasCurrentUnifiedAcceptance({ ...current, privacyPolicyVersion: legacyVersion })).toBe(false)
    expect(hasCurrentUnifiedAcceptance({ ...current, identityConsentVersion: legacyVersion })).toBe(false)
    expect(hasCurrentUnifiedAcceptance({ ...current, privacyPolicyAcceptedAt: undefined })).toBe(false)
    expect(hasCurrentUnifiedAcceptance({ ...current, identityConsentAcceptedAt: undefined })).toBe(false)
    expect(hasCurrentUnifiedAcceptance({ ...current, approximateLocationConsentedAt: undefined })).toBe(false)
  })

  it('does not grandfather the old 730 day scope as current', () => {
    expect(hasCurrentUnifiedAcceptance({ ...current, termsVersion: old730Version })).toBe(false)
    expect(hasCurrentUnifiedAcceptance({ ...current, privacyPolicyVersion: old730Version })).toBe(false)
    expect(hasCurrentUnifiedAcceptance({ ...current, identityConsentVersion: old730Version })).toBe(false)
  })

  it('shares one canonical summary text without inventing controls or contacts', () => {
    expect(termsSummaryParagraphs.length).toBeGreaterThan(0)
    expect(privacySummaryParagraphs.length).toBeGreaterThan(0)
    const combined = [...termsSummaryParagraphs, ...privacySummaryParagraphs, unifiedAcceptanceStatement].join('\n')
    expect(combined).not.toContain('—')
    expect(combined).not.toContain('[')
    expect(combined.toLowerCase()).not.toContain('marketing')
    expect(combined.toLowerCase()).not.toContain('opt out of marketing')
    expect(combined.toLowerCase()).not.toContain('appeal')
    expect(combined.toLowerCase()).not.toContain('refund')
    expect(combined).toContain('selfie')
    expect(combined).toContain('for as long as your account exists')
    expect(combined).not.toContain('730 days')
    expect(combined).not.toContain('up to 730')
  })

  it('keeps sectioned and flat content identical', () => {
    expect(termsSections.flatMap((section) => section.paragraphs)).toEqual(termsSummaryParagraphs)
    expect(privacySections.flatMap((section) => section.paragraphs)).toEqual(privacySummaryParagraphs)
    for (const section of [...termsSections, ...privacySections]) {
      expect(section.heading.trim().length).toBeGreaterThan(0)
    }
    expect(termsAcceptanceLabel).toBe('I agree to the Terms and Conditions')
    expect(privacyAcceptanceLabel).toBe('I agree to the Privacy Policy')
  })

  it('recognizes exactly the dedicated legal paths', () => {
    expect(publicLegalPaths).toEqual(['/terms-and-conditions', '/privacy-policy'])
    expect(isPublicLegalPath('/terms-and-conditions')).toBe(true)
    expect(isPublicLegalPath('/privacy-policy')).toBe(true)
    expect(isPublicLegalPath('/privacy-policy/')).toBe(true)
    expect(isPublicLegalPath('/onboarding')).toBe(false)
    expect(isPublicLegalPath('/terms-and-conditions/extra')).toBe(false)
  })

  it('exposes one policy catalog for every platform surface', () => {
    expect(policyDocuments).toEqual([termsDocument, privacyDocument])
    expect(policyDocuments.map((document) => document.id)).toEqual(['terms', 'privacy'])
    expect(termsDocument).toMatchObject({
      title: 'Terms and Conditions',
      shortTitle: 'Terms',
      path: '/terms-and-conditions',
      acceptancePrefix: 'I agree to the ',
      acceptanceLabel: 'I agree to the Terms and Conditions',
    })
    expect(privacyDocument).toMatchObject({
      title: 'Privacy Policy',
      shortTitle: 'Privacy',
      path: '/privacy-policy',
      acceptancePrefix: 'I agree to the ',
      acceptanceLabel: 'I agree to the Privacy Policy',
    })
    expect(termsDocument.sections).toBe(termsSections)
    expect(privacyDocument.sections).toBe(privacySections)
    expect(getPolicyDocument('terms')).toBe(termsDocument)
    expect(getPolicyDocument('privacy')).toBe(privacyDocument)
    expect(otherPolicyDocument('terms')).toBe(privacyDocument)
    expect(otherPolicyDocument(privacyDocument)).toBe(termsDocument)
    expect(policyCrossLinkLabel(privacyDocument)).toBe('Read the Privacy Policy')
    expect(policyCrossLinkLabel(termsDocument)).toBe('Read the Terms and Conditions')
  })
})
