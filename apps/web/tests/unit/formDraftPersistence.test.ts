import { describe, expect, it } from 'vitest'
import {
  clearCompanionApplicationDraft,
  companionLocationReady,
  companionApplicationDraftKey,
  readCompanionApplicationDraft,
  restoreCompanionEditorStep,
  writeCompanionApplicationDraft,
  type CompanionApplicationDraft,
} from '../../src/features/companion-application/companionApplicationDraft'
import {
  clearIdentityVerificationDraft,
  identityVerificationDraftKey,
  readIdentityVerificationDraft,
  writeIdentityVerificationDraft,
} from '../../src/features/identity/identityVerificationDraft'

function memoryStorage() {
  const values = new Map<string, string>()
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  }
}

describe('form draft persistence', () => {
  it('stores, scopes, and clears a Companion application draft', () => {
    const storage = memoryStorage()
    const draft: CompanionApplicationDraft = {
      currentStep: 3,
      editorStepCount: 4,
      mode: 'both',
      city: 'Bacolor',
      hourlyRatePesos: '650',
      intro: 'I enjoy helping members with errands and local activities.',
      bio: 'Weekend cyclist.',
      earningMotivation: 'I want flexible work that helps people nearby.',
      selectedCategories: ['Good company', 'Grocery shopping'],
      approximateLocation: { latitude: 15.03, longitude: 120.69 },
      locationConfirmed: true,
      locationConsent: true,
    }

    writeCompanionApplicationDraft(storage, 'member-a', draft)

    expect(readCompanionApplicationDraft(storage, 'member-a')).toEqual(draft)
    expect(readCompanionApplicationDraft(storage, 'member-b')).toBeNull()
    expect(companionApplicationDraftKey('member-a')).not.toBe(companionApplicationDraftKey('member-b'))
    clearCompanionApplicationDraft(storage, 'member-a')
    expect(readCompanionApplicationDraft(storage, 'member-a')).toBeNull()
  })

  it('ignores malformed Companion application drafts', () => {
    const storage = memoryStorage()
    storage.setItem(companionApplicationDraftKey('member-a'), '{bad json')
    expect(readCompanionApplicationDraft(storage, 'member-a')).toBeNull()
  })

  it('maps older drafts into the three-step editor', () => {
    expect(restoreCompanionEditorStep(1, undefined, 3)).toBe(1)
    expect(restoreCompanionEditorStep(2, undefined, 3)).toBe(2)
    expect(restoreCompanionEditorStep(3, undefined, 3)).toBe(2)
    expect(restoreCompanionEditorStep(4, 5, 3)).toBe(3)
    expect(restoreCompanionEditorStep(5, 5, 3)).toBe(3)
    expect(restoreCompanionEditorStep(3, 4, 3)).toBe(3)
    expect(restoreCompanionEditorStep(2, 3, 3)).toBe(2)
  })

  it('requires a confirmed approximate location and consent', () => {
    const location = { latitude: 15.03, longitude: 120.69 }
    expect(companionLocationReady(location, true, true)).toBe(true)
    expect(companionLocationReady(null, true, true)).toBe(false)
    expect(companionLocationReady(location, false, true)).toBe(false)
    expect(companionLocationReady(location, true, false)).toBe(false)
  })

  it('stores identity text by member and verification record without files', () => {
    const storage = memoryStorage()
    const draft = {
      selectedIdType: 'passport' as const,
      detailStep: 3 as const,
      fields: { fullLegalName: 'Sample Member', nationality: 'Filipino' },
    }

    writeIdentityVerificationDraft(storage, 'member-a', 'record-a', draft)

    expect(readIdentityVerificationDraft(storage, 'member-a', 'record-a')).toEqual(draft)
    expect(readIdentityVerificationDraft(storage, 'member-a', 'record-b')).toBeNull()
    expect(identityVerificationDraftKey('member-a', 'record-a')).not.toBe(identityVerificationDraftKey('member-b', 'record-a'))
    clearIdentityVerificationDraft(storage, 'member-a', 'record-a')
    expect(readIdentityVerificationDraft(storage, 'member-a', 'record-a')).toBeNull()
  })
})
