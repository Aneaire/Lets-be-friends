export type CompanionApplicationDraft = {
  currentStep: number
  editorStepCount?: number
  mode: 'online' | 'in_person' | 'both'
  city: string
  hourlyRatePesos: string
  intro: string
  bio: string
  earningMotivation: string
  selectedCategories: string[]
  approximateLocation?: { latitude: number; longitude: number } | null
  locationConfirmed?: boolean
  locationConsent?: boolean
}

const draftVersion = 1

export function companionApplicationDraftKey(userId: string) {
  return `lbf:companion-application-draft:v${draftVersion}:${userId}`
}

export function readCompanionApplicationDraft(storage: Pick<Storage, 'getItem'>, userId: string) {
  try {
    const value = JSON.parse(storage.getItem(companionApplicationDraftKey(userId)) ?? 'null') as unknown
    if (!isCompanionApplicationDraft(value)) return null
    return value
  } catch {
    return null
  }
}

export function writeCompanionApplicationDraft(storage: Pick<Storage, 'setItem'>, userId: string, draft: CompanionApplicationDraft) {
  storage.setItem(companionApplicationDraftKey(userId), JSON.stringify(draft))
}

export function clearCompanionApplicationDraft(storage: Pick<Storage, 'removeItem'>, userId: string) {
  storage.removeItem(companionApplicationDraftKey(userId))
}

export function restoreCompanionEditorStep(savedStep: number, savedStepCount: number | undefined, currentStepCount: number) {
  if (savedStepCount === currentStepCount) return Math.max(1, Math.min(currentStepCount, savedStep))
  const previousStepCount = savedStepCount ?? 5
  const mappedStep = currentStepCount === 3
    ? previousStepCount >= 5
      ? savedStep <= 1 ? 1 : savedStep <= 3 ? 2 : 3
      : Math.min(savedStep, 3)
    : savedStep
  return Math.max(1, Math.min(currentStepCount, mappedStep))
}

export function companionLocationReady(
  location: { latitude: number; longitude: number } | null,
  confirmed: boolean,
  consent: boolean,
) {
  return Boolean(location && confirmed && consent)
}

function isCompanionApplicationDraft(value: unknown): value is CompanionApplicationDraft {
  if (!value || typeof value !== 'object') return false
  const draft = value as Partial<CompanionApplicationDraft>
  return typeof draft.currentStep === 'number'
    && (draft.editorStepCount === undefined || typeof draft.editorStepCount === 'number')
    && ['online', 'in_person', 'both'].includes(draft.mode ?? '')
    && [draft.city, draft.hourlyRatePesos, draft.intro, draft.bio, draft.earningMotivation].every((item) => typeof item === 'string')
    && Array.isArray(draft.selectedCategories)
    && draft.selectedCategories.every((item) => typeof item === 'string')
}
