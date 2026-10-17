import { validateCompanionApplication } from '@/data/companionTools'
import {
  clampOnboardingStep,
  defaultOnboardingCompanionForm,
  hasSubmittedCompanionApplication,
  mergeOnboardingCategoriesIntoForm,
  onboardingCompanionHeroCopy,
  onboardingCompanionHeroTitle,
  onboardingCompanionIdentityFollowupCopy,
  onboardingCompanionReviewNotice,
  onboardingCompanionStatusPresentation,
  onboardingMaxStep,
  onboardingTotalSteps,
} from '@/features/companion/onboardingCompanionApplication'

describe('Mobile onboarding Companion application step', () => {
  it('keeps exactly five steps for both member and companion tracks with the final step for acceptance', () => {
    expect(onboardingTotalSteps('member')).toBe(5)
    expect(onboardingMaxStep('member')).toBe(4)
    expect(onboardingTotalSteps('companion')).toBe(5)
    expect(onboardingMaxStep('companion')).toBe(4)
  })

  it('clamps the active step within the five-step flow', () => {
    expect(clampOnboardingStep(4, 'member')).toBe(4)
    expect(clampOnboardingStep(4, 'companion')).toBe(4)
    expect(clampOnboardingStep(-1, 'companion')).toBe(0)
    expect(clampOnboardingStep(2, 'member')).toBe(2)
    expect(clampOnboardingStep(9, 'member')).toBe(4)
  })

  it('treats an existing application or a just-submitted form as submitted, without duplicating the form', () => {
    expect(hasSubmittedCompanionApplication(null, false)).toBe(false)
    expect(hasSubmittedCompanionApplication(undefined, false)).toBe(false)
    expect(hasSubmittedCompanionApplication({ status: 'pending_review' }, false)).toBe(true)
    expect(hasSubmittedCompanionApplication({ status: 'approved' }, false)).toBe(true)
    expect(hasSubmittedCompanionApplication(null, true)).toBe(true)
  })

  it('presents submitted status with saved profile framing and web identity follow-up', () => {
    const pending = onboardingCompanionStatusPresentation({ status: 'pending_review' }, false)
    expect(pending.label).toBe('Pending review')
    expect(pending.guidance).toContain('Only identity verification is reviewed')
    expect(pending.guidance).toContain('identity verification on web')

    const approved = onboardingCompanionStatusPresentation({ status: 'approved' }, false)
    expect(approved.label).toBe('Approved')
    expect(approved.guidance).toContain('identity verification on web')

    const rejected = onboardingCompanionStatusPresentation({ status: 'rejected' }, false)
    expect(rejected.label).toBe('Needs changes')
    expect(rejected.guidance).toContain('Companion screen')
    expect(rejected.guidance).not.toContain('review team')

    const justSubmitted = onboardingCompanionStatusPresentation(null, true)
    expect(justSubmitted.label).toBe('Approved')
  })

  it('falls back to approved for unknown statuses instead of crashing', () => {
    expect(onboardingCompanionStatusPresentation({ status: 'something_new' }, false).label).toBe('Approved')
  })

  it('prefills the application form from onboarding state while keeping Companion defaults', () => {
    const form = defaultOnboardingCompanionForm({ bio: '  Weekend hiker.  ', categories: ['Coffee and meals'] })
    expect(form.bio).toBe('Weekend hiker.')
    expect(form.categories).toEqual(['Coffee and meals'])
    expect(form.mode).toBe('both')
    expect(form.strengths).toEqual(['Good listener'])
    expect(form.hourlyRatePesos).toBe('500')
    expect(form.boundaries).toContain('Public places only')
  })

  it('handles missing onboarding prefill without sharing array references', () => {
    const categories = ['Coffee and meals']
    const form = defaultOnboardingCompanionForm({ bio: null, categories })
    expect(form.bio).toBe('')
    expect(form.categories).toEqual(categories)
    expect(form.categories).not.toBe(categories)
  })

  it('merges onboarding categories only when the application form has none yet', () => {
    const empty = defaultOnboardingCompanionForm({ categories: [] })
    const merged = mergeOnboardingCategoriesIntoForm(empty, ['Coffee and meals'])
    expect(merged.categories).toEqual(['Coffee and meals'])

    const filled = defaultOnboardingCompanionForm({ categories: ['Board game nights'] })
    expect(mergeOnboardingCategoriesIntoForm(filled, ['Coffee and meals'])).toBe(filled)
  })

  it('validates the onboarding form with the same rules as the Companion screen', () => {
    const form = {
      ...defaultOnboardingCompanionForm({ bio: 'Something personal about hobbies, family, and work.', categories: ['Coffee and meals'] }),
      intro: 'I join relaxed public coffee chats and thoughtful city walks with clear plans.',
      city: 'Cebu City',
    }
    const validated = validateCompanionApplication(form)
    expect(validated).toMatchObject({
      ok: true,
      value: {
        intro: form.intro,
        city: 'Cebu City',
        mode: 'both',
        hourlyRateCentavos: 50_000,
        strengths: ['Good listener'],
        categories: ['Coffee and meals'],
      },
    })
    expect(validated).toMatchObject({ ok: true })
    if (validated.ok) expect(Object.keys(validated.value)).not.toContain('earningMotivation')
    expect(validateCompanionApplication({ ...form, hourlyRatePesos: '30' })).toMatchObject({
      ok: true,
      value: { hourlyRateCentavos: 3_000 },
    })
  })

  it('rejects incomplete applications with the same boundaries as the Companion screen', () => {
    const base = {
      ...defaultOnboardingCompanionForm({ bio: 'Something personal about hobbies, family, and work.', categories: ['Coffee and meals'] }),
      intro: 'I join relaxed public coffee chats and thoughtful city walks with clear plans.',
      city: 'Cebu City',
    }
    expect(validateCompanionApplication({ ...base, intro: 'Too short' })).toMatchObject({ ok: false })
    expect(validateCompanionApplication({ ...base, strengths: [] })).toMatchObject({ ok: false })
    expect(validateCompanionApplication({ ...base, categories: [] })).toMatchObject({ ok: false })
    expect(validateCompanionApplication({ ...base, boundaries: '  ' })).toMatchObject({ ok: false })
    expect(validateCompanionApplication({ ...base, hourlyRatePesos: '29.99' })).toEqual({
      ok: false,
      message: 'Set an hourly rate from PHP 30 to PHP 10,000.',
    })
    expect(validateCompanionApplication({ ...base, mode: 'in_person' as const, city: '  ' })).toMatchObject({ ok: false })
  })

  it('keeps review copy free of em dashes and pointed at the identity flow', () => {
    for (const copy of [
      onboardingCompanionReviewNotice,
      onboardingCompanionIdentityFollowupCopy,
      onboardingCompanionHeroTitle,
      onboardingCompanionHeroCopy,
    ]) {
      expect(copy).not.toContain('—')
    }
    expect(onboardingCompanionReviewNotice).toContain('Only identity is reviewed')
    expect(onboardingCompanionIdentityFollowupCopy).toContain('on web')
  })

  it('keeps Companion onboarding copy free of policy consent and retention prose', () => {
    const copy = [
      onboardingCompanionReviewNotice,
      onboardingCompanionIdentityFollowupCopy,
      onboardingCompanionHeroTitle,
      onboardingCompanionHeroCopy,
    ].join('\n')
    expect(copy).not.toContain('for as long as your account exists')
    expect(copy).not.toContain('Privacy Policy')
    expect(copy).not.toContain('Terms and Conditions')
    expect(copy).not.toContain('OpenAI')
    expect(copy).not.toMatch(/human safety/i)
    expect(onboardingCompanionReviewNotice).toContain('Only identity is reviewed')
  })
})
