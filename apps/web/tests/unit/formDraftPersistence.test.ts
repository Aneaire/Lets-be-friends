import { describe, expect, it } from 'vitest'
import {
  clearCompanionApplicationDraft,
  companionApplicationDraftKey,
  readCompanionApplicationDraft,
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
  it('stores, scopes, and clears a Companion profile draft', () => {
    const storage = memoryStorage()
    const draft: CompanionApplicationDraft = {
      mode: 'both',
      city: 'Bacolor',
      hourlyRatePesos: '650',
      intro: 'I enjoy helping members with errands and local activities.',
      bio: 'Weekend cyclist.',
      selectedCategories: ['Good company', 'Grocery shopping'],
    }

    writeCompanionApplicationDraft(storage, 'member-a', draft)

    expect(readCompanionApplicationDraft(storage, 'member-a')).toEqual(draft)
    expect(readCompanionApplicationDraft(storage, 'member-b')).toBeNull()
    expect(companionApplicationDraftKey('member-a')).not.toBe(companionApplicationDraftKey('member-b'))
    clearCompanionApplicationDraft(storage, 'member-a')
    expect(readCompanionApplicationDraft(storage, 'member-a')).toBeNull()
  })

  it('ignores malformed Companion profile drafts', () => {
    const storage = memoryStorage()
    storage.setItem(companionApplicationDraftKey('member-a'), '{bad json')
    expect(readCompanionApplicationDraft(storage, 'member-a')).toBeNull()

    storage.setItem(companionApplicationDraftKey('member-a'), JSON.stringify({ mode: 'sometimes' }))
    expect(readCompanionApplicationDraft(storage, 'member-a')).toBeNull()
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
