import {
  MAX_HOST_HOURLY_RATE_CENTAVOS,
  MIN_HOST_HOURLY_RATE_CENTAVOS,
  activityCategories,
  friendStrengths,
  type HostApplicationStatus,
} from '@lets-be-friends/shared'

export type HostMode = 'online' | 'in_person' | 'both'

export type HostApplicationForm = {
  intro: string
  city: string
  mode: HostMode
  hourlyRatePesos: string
  strengths: string[]
  categories: string[]
  boundaries: string
  applicationNote: string
}

export type SavedHostApplication = {
  intro: string
  city: string
  mode: HostMode
  hourlyRateCentavos?: number
  strengths: string[]
  categories: string[]
  boundaries: string[]
  applicationNote?: string
  approximateLatitude?: number
  approximateLongitude?: number
  nearbyDiscoveryEnabled?: boolean
}

export const hostApplicationStatusCopy: Record<HostApplicationStatus, { label: string; detail: string }> = {
  draft: { label: 'Draft', detail: 'Finish the profile and send it for review.' },
  pending_review: { label: 'Pending review', detail: 'Your Friend Host profile is waiting for review.' },
  approved: { label: 'Approved', detail: 'Your Friend Host profile is live when identity approval is current.' },
  rejected: { label: 'Needs changes', detail: 'Review the profile details before sending it again.' },
  suspended: { label: 'Suspended', detail: 'This Friend Host profile is not currently visible.' },
}

export function initialHostApplicationForm(application?: SavedHostApplication | null): HostApplicationForm {
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

export function hasSavedNearbyCoordinates(application?: Pick<SavedHostApplication, 'approximateLatitude' | 'approximateLongitude'> | null) {
  return typeof application?.approximateLatitude === 'number' && typeof application.approximateLongitude === 'number'
}

export type ValidHostApplication = {
  intro: string
  city: string
  mode: HostMode
  hourlyRateCentavos: number
  strengths: string[]
  categories: string[]
  boundaries: string[]
  applicationNote?: string
}

export function validateHostApplication(form: HostApplicationForm): { ok: true; value: ValidHostApplication } | { ok: false; message: string } {
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
    || hourlyRateCentavos < MIN_HOST_HOURLY_RATE_CENTAVOS
    || hourlyRateCentavos > MAX_HOST_HOURLY_RATE_CENTAVOS
  ) return { ok: false, message: 'Set an hourly rate from PHP 100 to PHP 10,000.' }
  if (form.strengths.length === 0) return { ok: false, message: 'Choose at least one Strength.' }
  if (form.strengths.some((value) => !(friendStrengths as readonly string[]).includes(value))) return { ok: false, message: 'Review the selected Strengths.' }
  if (form.categories.length === 0) return { ok: false, message: 'Choose at least one activity.' }
  if (form.categories.some((value) => !(activityCategories as readonly string[]).includes(value))) return { ok: false, message: 'Review the selected activities.' }
  if (boundaries.length === 0) return { ok: false, message: 'Add at least one clear boundary.' }

  return {
    ok: true,
    value: {
      intro,
      city,
      mode: form.mode,
      hourlyRateCentavos,
      strengths: [...new Set(form.strengths)],
      categories: [...new Set(form.categories)],
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
    || centavos < MIN_HOST_HOURLY_RATE_CENTAVOS
    || centavos > MAX_HOST_HOURLY_RATE_CENTAVOS
  ) return { ok: false as const, message: 'Set an hourly rate from PHP 100 to PHP 10,000.' }
  return { ok: true as const, hourlyRateCentavos: centavos }
}
