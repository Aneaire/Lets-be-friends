import {
  maximumCompanionActivityCategories,
  validateActivityCategories,
} from '@lets-be-friends/shared'

export type CompanionProfileMode = 'online' | 'in_person' | 'both'

export interface CompanionProfileValues {
  mode: CompanionProfileMode
  hourlyRatePesos: string
  city: string
  bio: string
  intro: string
}

export const companionProfileDefaults = {
  rateMinPesos: 30,
  rateMaxPesos: 10000,
  defaultRatePesos: '500',
  introMinLength: 40,
  introMaxLength: 500,
  bioMaxLength: 500,
} as const

export function defaultCompanionProfileValues(
  overrides: Partial<CompanionProfileValues> = {},
): CompanionProfileValues {
  return {
    mode: overrides.mode ?? 'both',
    hourlyRatePesos: overrides.hourlyRatePesos ?? companionProfileDefaults.defaultRatePesos,
    city: overrides.city ?? '',
    bio: overrides.bio ?? '',
    intro: overrides.intro ?? '',
  }
}

export function validateCompanionProfile(
  values: CompanionProfileValues,
  categories: string[],
): { ok: true } | { ok: false; message: string } {
  const intro = values.intro.trim()
  if (intro.length < companionProfileDefaults.introMinLength) {
    return {
      ok: false,
      message: `Describe the work or skills you can share in at least ${companionProfileDefaults.introMinLength} characters.`,
    }
  }
  if (intro.length > companionProfileDefaults.introMaxLength) {
    return {
      ok: false,
      message: `Keep your work or skills note to ${companionProfileDefaults.introMaxLength} characters or fewer.`,
    }
  }
  const bio = values.bio.trim()
  if (bio.length === 0) {
    return { ok: false, message: 'Add a short bio about yourself.' }
  }
  if (bio.length > companionProfileDefaults.bioMaxLength) {
    return { ok: false, message: `Keep your bio to ${companionProfileDefaults.bioMaxLength} characters or fewer.` }
  }
  if (values.mode !== 'online' && !values.city.trim()) {
    return { ok: false, message: 'Add the city where you can meet in person.' }
  }
  if (categories.length === 0) {
    return { ok: false, message: 'Choose at least one activity before continuing.' }
  }
  const categoryResult = validateActivityCategories(categories, maximumCompanionActivityCategories)
  if (!categoryResult.ok) return { ok: false, message: categoryResult.message }
  const rate = Number(values.hourlyRatePesos)
  if (
    !Number.isFinite(rate)
    || rate < companionProfileDefaults.rateMinPesos
    || rate > companionProfileDefaults.rateMaxPesos
  ) {
    return {
      ok: false,
      message: `Set an hourly rate between ${companionProfileDefaults.rateMinPesos} and ${companionProfileDefaults.rateMaxPesos} PHP.`,
    }
  }
  return { ok: true }
}

export interface CompanionProfilePayload {
  intro: string
  city: string
  strengths: string[]
  categories: string[]
  boundaries: string[]
  mode: CompanionProfileMode
  hourlyRateCentavos: number
  bio: string
}

export function buildCompanionProfilePayload(
  values: CompanionProfileValues,
  categories: string[],
): CompanionProfilePayload {
  const categoryResult = validateActivityCategories(categories, maximumCompanionActivityCategories)
  return {
    intro: values.intro.trim(),
    city: values.city.trim(),
    strengths: [],
    categories: categoryResult.ok ? categoryResult.value : categories,
    boundaries: [],
    mode: values.mode,
    hourlyRateCentavos: Math.round(Number(values.hourlyRatePesos) * 100),
    bio: values.bio.trim(),
  }
}

export function formatPhpFromPesos(value: string) {
  const amount = Number(value)
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 2,
  }).format(Number.isFinite(amount) ? amount : 0)
}
