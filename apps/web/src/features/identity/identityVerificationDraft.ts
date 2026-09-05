export type IdentityVerificationDraft = {
  selectedIdType: 'passport' | 'drivers_license' | 'national_id' | 'residence_permit' | 'other_government_id'
  detailStep: 2 | 3 | 4 | null
  fields: {
    fullLegalName?: string
    dateOfBirth?: string
    idType?: 'passport' | 'drivers_license' | 'national_id' | 'residence_permit' | 'other_government_id'
    idNumberLast4?: string
    expirationDate?: string
    nationality?: string
  }
}

const draftVersion = 1

export function identityVerificationDraftKey(userId: string, recordId?: string) {
  return `lbf:identity-verification-draft:v${draftVersion}:${userId}:${recordId ?? 'new'}`
}

export function readIdentityVerificationDraft(storage: Pick<Storage, 'getItem'>, userId: string, recordId?: string) {
  try {
    const value = JSON.parse(storage.getItem(identityVerificationDraftKey(userId, recordId)) ?? 'null') as unknown
    if (!value || typeof value !== 'object') return null
    const draft = value as Partial<IdentityVerificationDraft>
    if (!['passport', 'drivers_license', 'national_id', 'residence_permit', 'other_government_id'].includes(draft.selectedIdType ?? '')) return null
    if (![null, 2, 3, 4].includes(draft.detailStep ?? null)) return null
    if (!draft.fields || typeof draft.fields !== 'object') return null
    return draft as IdentityVerificationDraft
  } catch {
    return null
  }
}

export function writeIdentityVerificationDraft(storage: Pick<Storage, 'setItem'>, userId: string, recordId: string | undefined, draft: IdentityVerificationDraft) {
  storage.setItem(identityVerificationDraftKey(userId, recordId), JSON.stringify(draft))
}

export function clearIdentityVerificationDraft(storage: Pick<Storage, 'removeItem'>, userId: string, recordId?: string) {
  storage.removeItem(identityVerificationDraftKey(userId, recordId))
}
