import {
  MAX_COMPANION_HOURLY_RATE_CENTAVOS,
  MIN_COMPANION_HOURLY_RATE_CENTAVOS,
  friendStrengths,
  maximumCompanionActivityCategories,
  validateActivityCategories,
  type CompanionApplicationStatus,
} from '@lets-be-friends/shared'

export type CompanionMode = 'online' | 'in_person' | 'both'

export type CompanionApplicationForm = {
  intro: string
  city: string
  mode: CompanionMode
  hourlyRatePesos: string
  strengths: string[]
  categories: string[]
  boundaries: string
  applicationNote: string
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
}

export const companionApplicationStatusCopy: Record<CompanionApplicationStatus, { label: string; detail: string }> = {
  draft: { label: 'Draft', detail: 'Finish the profile and send it for review.' },
  pending_review: { label: 'Pending review', detail: 'Your Companion profile is waiting for review.' },
  approved: { label: 'Approved', detail: 'Your Companion profile is live when identity approval is current.' },
  rejected: { label: 'Needs changes', detail: 'Review the profile details before sending it again.' },
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
}

export function validateCompanionApplication(form: CompanionApplicationForm): { ok: true; value: ValidCompanionApplication } | { ok: false; message: string } {
  const intro = form.intro.trim()
  const city = form.city.trim()
  const hourlyRatePesos = Number(form.hourlyRatePesos.trim())
  const hourlyRateCentavos = Math.round(hourlyRatePesos * 100)
  const boundaries = form.boundaries.split('\n').map((item) => item.trim()).filter(Boolean)

  if (intro.length < 40 || intro.length > 500) return { ok: false, message: 'Describe the experience in 40 to 500 characters.' }
  if (form.mode !== 'online' && !city) return { ok: false, message: 'Add a city for an in-person session.' }
  if (
    !Number.isFinite(hourlyRatePesos)
    || !Number.isSafeInteger(hourlyRateCentavos)
    || hourlyRateCentavos < MIN_COMPANION_HOURLY_RATE_CENTAVOS
    || hourlyRateCentavos > MAX_COMPANION_HOURLY_RATE_CENTAVOS
  ) return { ok: false, message: 'Set an hourly rate from PHP 100 to PHP 10,000.' }
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
  ) return { ok: false as const, message: 'Set an hourly rate from PHP 100 to PHP 10,000.' }
  return { ok: true as const, hourlyRateCentavos: centavos }
}
