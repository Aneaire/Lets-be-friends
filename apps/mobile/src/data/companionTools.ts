import {
  MAX_COMPANION_HOURLY_RATE_CENTAVOS,
  MIN_COMPANION_HOURLY_RATE_CENTAVOS,
  friendStrengths,
  maximumCompanionActivityCategories,
  validateActivityCategories,
  type CompanionApplicationStatus,
} from '@lets-be-friends/shared'

export type CompanionMode = 'online' | 'in_person' | 'both'

export const COMPANION_BIO_MAX_LENGTH = 500
export const COMPANION_BIO_PLACEHOLDER = 'For example: I can help you practice a new language, and I make everyday errands more fun.'

export type CompanionApplicationForm = {
  intro: string
  city: string
  mode: CompanionMode
  hourlyRatePesos: string
  strengths: string[]
  categories: string[]
  boundaries: string
  applicationNote: string
  bio: string
}

export type SavedCompanionApplication = {
  intro: string
  city: string
  mode: CompanionMode
  hourlyRateCentavos?: number
  strengths: string[]
  categories: string[]
  boundaries: string[]
  applicationNote?: string
  bio?: string
}

export const companionApplicationStatusCopy: Record<CompanionApplicationStatus, { label: string; detail: string }> = {
  draft: { label: 'Draft', detail: 'Finish the profile and save it.' },
  pending_review: { label: 'Pending review', detail: 'Your Companion profile is saved. Only identity verification is reviewed.' },
  approved: { label: 'Approved', detail: 'Your Companion profile is live when identity approval is current.' },
  rejected: { label: 'Needs changes', detail: 'Update the profile details and save them again.' },
  suspended: { label: 'Suspended', detail: 'This Companion profile is not currently visible.' },
}

export function initialCompanionApplicationForm(application?: SavedCompanionApplication | null): CompanionApplicationForm {
  return {
    intro: application?.intro ?? '',
    city: application?.city ?? '',
    mode: application?.mode ?? 'both',
    hourlyRatePesos: String((application?.hourlyRateCentavos ?? 50_000) / 100),
    strengths: application?.strengths.length ? application.strengths : ['Good listener'],
    categories: application?.categories ?? [],
    boundaries: application?.boundaries.length
      ? application.boundaries.join('\n')
      : 'Public places only\nNo dating or romantic expectations',
    applicationNote: application?.applicationNote ?? '',
    bio: application?.bio ?? '',
  }
}

export type ValidCompanionApplication = {
  intro: string
  city: string
  mode: CompanionMode
  hourlyRateCentavos: number
  strengths: string[]
  categories: string[]
  boundaries: string[]
  applicationNote?: string
  bio?: string
}

export function validateCompanionApplication(form: CompanionApplicationForm): { ok: true; value: ValidCompanionApplication } | { ok: false; message: string } {
  const intro = form.intro.trim()
  const city = form.city.trim()
  const hourlyRatePesos = Number(form.hourlyRatePesos.trim())
  const hourlyRateCentavos = Math.round(hourlyRatePesos * 100)
  const boundaries = form.boundaries.split('\n').map((item) => item.trim()).filter(Boolean)
  const bio = form.bio.trim()

  if (intro.length < 40 || intro.length > 500) return { ok: false, message: 'Describe the experience in 40 to 500 characters.' }
  if (bio.length === 0) return { ok: false, message: 'Add a short bio about the skills, talents, or everyday help you can share.' }
  if (bio.length > COMPANION_BIO_MAX_LENGTH) return { ok: false, message: `Tell me about yourself must be ${COMPANION_BIO_MAX_LENGTH} characters or fewer.` }
  if (form.mode !== 'online' && !city) return { ok: false, message: 'Add a city for an in-person session.' }
  if (
    !Number.isFinite(hourlyRatePesos)
    || !Number.isSafeInteger(hourlyRateCentavos)
    || hourlyRateCentavos < MIN_COMPANION_HOURLY_RATE_CENTAVOS
    || hourlyRateCentavos > MAX_COMPANION_HOURLY_RATE_CENTAVOS
  ) return { ok: false, message: 'Set an hourly rate from PHP 30 to PHP 10,000.' }
  if (form.strengths.length === 0) return { ok: false, message: 'Choose at least one Strength.' }
  if (form.strengths.some((value) => !(friendStrengths as readonly string[]).includes(value))) return { ok: false, message: 'Review the selected Strengths.' }
  if (form.categories.length === 0) return { ok: false, message: 'Choose at least one activity.' }
  const categories = validateActivityCategories(form.categories, maximumCompanionActivityCategories)
  if (!categories.ok) return categories
  if (boundaries.length === 0) return { ok: false, message: 'Add at least one clear boundary.' }

  return {
    ok: true,
    value: {
      intro,
      city,
      mode: form.mode,
      hourlyRateCentavos,
      strengths: [...new Set(form.strengths)],
      categories: categories.value,
      boundaries,
      applicationNote: form.applicationNote.trim() || undefined,
      bio,
    },
  }
}

export function validateHourlyRate(value: string) {
  const pesos = Number(value.trim())
  const centavos = Math.round(pesos * 100)
  if (
    !Number.isFinite(pesos)
    || !Number.isSafeInteger(centavos)
    || centavos < MIN_COMPANION_HOURLY_RATE_CENTAVOS
    || centavos > MAX_COMPANION_HOURLY_RATE_CENTAVOS
  ) return { ok: false as const, message: 'Set an hourly rate from PHP 30 to PHP 10,000.' }
  return { ok: true as const, hourlyRateCentavos: centavos }
}
