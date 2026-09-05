import { describe, expect, it } from 'vitest'
import {
  buildOnboardingApplicationPayload,
  companionApplicationSkipDestination,
  defaultOnboardingApplicationValues,
  hasSubmittedApplication,
  onboardingApplicationStatusGuidance,
  onboardingApplicationStatusLabel,
  validateOnboardingApplication,
  type OnboardingApplicationValues,
} from '../../src/features/companion-application/onboardingCompanionApplication'
import { onboardingDestination } from '../../src/lib/onboarding'

const validValues: OnboardingApplicationValues = {
  intro: 'I can join a shopping trip, explain everyday technology, and share unhurried conversation.',
  city: 'Bacolor',
  categories: ['Good company'],
  mode: 'both',
  hourlyRatePesos: '500',
  bio: 'I enjoy photography walks and quiet cafe sessions.',
  earningMotivation: 'I want to earn by helping neighbors with everyday company.',
}

describe('onboarding Companion application defaults', () => {
  it('prefills bio and categories from the onboarding profile', () => {
    const defaults = defaultOnboardingApplicationValues('Hello there', ['Good company'])
    expect(defaults.bio).toBe('Hello there')
    expect(defaults.categories).toEqual(['Good company'])
    expect(defaults.mode).toBe('both')
  })

  it('starts blank without viewer details', () => {
    const defaults = defaultOnboardingApplicationValues(null, null)
    expect(defaults.bio).toBe('')
    expect(defaults.categories).toEqual([])
  })
})

describe('onboarding Companion application validation', () => {
  it('accepts a complete application', () => {
    expect(validateOnboardingApplication(validValues)).toEqual({ ok: true })
  })

  it('requires a descriptive introduction', () => {
    expect(validateOnboardingApplication({ ...validValues, intro: 'Too short' }).ok).toBe(false)
  })

  it('requires a city for in-person availability but not for online only', () => {
    expect(validateOnboardingApplication({ ...validValues, city: '  ' }).ok).toBe(false)
    expect(validateOnboardingApplication({ ...validValues, city: '', mode: 'online' })).toEqual({ ok: true })
  })

  it('requires at least one activity', () => {
    expect(validateOnboardingApplication({ ...validValues, categories: [] }).ok).toBe(false)
  })

  it('requires an hourly rate inside the supported range', () => {
    expect(validateOnboardingApplication({ ...validValues, hourlyRatePesos: '50' }).ok).toBe(false)
    expect(validateOnboardingApplication({ ...validValues, hourlyRatePesos: '20000' }).ok).toBe(false)
    expect(validateOnboardingApplication({ ...validValues, hourlyRatePesos: 'not a number' }).ok).toBe(false)
  })

  it('requires a private motivation note of at least 20 characters', () => {
    expect(validateOnboardingApplication({ ...validValues, earningMotivation: 'Too short' }).ok).toBe(false)
  })

  it('keeps every user-facing message free of em dashes', () => {
    const messages = [
      validateOnboardingApplication({ ...validValues, intro: 'x' }),
      validateOnboardingApplication({ ...validValues, city: '' }),
      validateOnboardingApplication({ ...validValues, categories: [] }),
      validateOnboardingApplication({ ...validValues, hourlyRatePesos: '1' }),
      validateOnboardingApplication({ ...validValues, earningMotivation: 'x' }),
    ]
    for (const result of messages) {
      if (!result.ok) expect(result.message).not.toContain('—')
    }
  })
})

describe('onboarding Companion application payload', () => {
  it('trims fields and converts pesos to centavos', () => {
    const payload = buildOnboardingApplicationPayload({
      ...validValues,
      intro: `  ${validValues.intro}  `,
      hourlyRatePesos: '750.50',
    })
    expect(payload.intro).toBe(validValues.intro)
    expect(payload.boundaries).toEqual([])
    expect(payload.hourlyRateCentavos).toBe(75050)
    expect(payload.bio).toBe(validValues.bio)
    expect(payload.strengths).toEqual([])
  })

  it('omits an empty personal note', () => {
    const payload = buildOnboardingApplicationPayload({ ...validValues, bio: '   ' })
    expect(payload.bio).toBeUndefined()
  })

  it('throws the validation message for invalid input', () => {
    expect(() => buildOnboardingApplicationPayload({ ...validValues, categories: [] })).toThrow()
  })

})

describe('onboarding Companion application status', () => {
  it('treats any stored status as submitted so the form is not duplicated', () => {
    expect(hasSubmittedApplication('pending_review')).toBe(true)
    expect(hasSubmittedApplication('approved')).toBe(true)
    expect(hasSubmittedApplication('rejected')).toBe(true)
    expect(hasSubmittedApplication(null)).toBe(false)
    expect(hasSubmittedApplication(undefined)).toBe(false)
    expect(hasSubmittedApplication('')).toBe(false)
  })

  it('labels submitted applications without em dashes', () => {
    expect(onboardingApplicationStatusLabel('pending_review')).toBe('In review')
    expect(onboardingApplicationStatusLabel('approved')).toBe('Profile approved')
    expect(onboardingApplicationStatusLabel('rejected')).toBe('Changes requested')
    for (const status of ['pending_review', 'approved', 'rejected', 'suspended', 'draft']) {
      expect(onboardingApplicationStatusLabel(status)).not.toContain('—')
      expect(onboardingApplicationStatusGuidance(status)).not.toContain('—')
    }
  })

  it('keeps admin review mandatory in pending guidance', () => {
    expect(onboardingApplicationStatusGuidance('pending_review')).toMatch(/review team/)
  })
})

describe('onboarding Companion skip behavior', () => {
  it('preserves the become-companion destination when skipping the application', () => {
    expect(companionApplicationSkipDestination()).toBe('/become-companion')
    expect(companionApplicationSkipDestination()).toBe(onboardingDestination('companion'))
  })
})
