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
  onboardingCompanionSkipCopy,
  onboardingCompanionStatusPresentation,
  onboardingMaxStep,
  onboardingTotalSteps,
} from '@/features/companion/onboardingCompanionApplication'

describe('Mobile onboarding Companion application step', () => {
  it('keeps the member track at four steps and adds a fifth step for the companion track', () => {
    expect(onboardingTotalSteps('member')).toBe(4)
    expect(onboardingMaxStep('member')).toBe(3)
    expect(onboardingTotalSteps('companion')).toBe(5)
    expect(onboardingMaxStep('companion')).toBe(4)
  })

  it('clamps the active step when the goal changes so members never see the application step', () => {
    expect(clampOnboardingStep(4, 'member')).toBe(3)
    expect(clampOnboardingStep(4, 'companion')).toBe(4)
    expect(clampOnboardingStep(-1, 'companion')).toBe(0)
    expect(clampOnboardingStep(2, 'member')).toBe(2)
  })

  it('treats an existing application or a just-submitted form as submitted, without duplicating the form', () => {
    expect(hasSubmittedCompanionApplication(null, false)).toBe(false)
    expect(hasSubmittedCompanionApplication(undefined, false)).toBe(false)
    expect(hasSubmittedCompanionApplication({ status: 'pending_review' }, false)).toBe(true)
    expect(hasSubmittedCompanionApplication({ status: 'approved' }, false)).toBe(true)
    expect(hasSubmittedCompanionApplication(null, true)).toBe(true)
  })

  it('presents submitted status with review-team ownership and web identity follow-up', () => {
    const pending = onboardingCompanionStatusPresentation({ status: 'pending_review' }, false)
    expect(pending.label).toBe('Pending review')
    expect(pending.guidance).toContain('Approval stays with the review team')
    expect(pending.guidance).toContain('identity verification on web')

    const approved = onboardingCompanionStatusPresentation({ status: 'approved' }, false)
    expect(approved.label).toBe('Approved')
    expect(approved.guidance).toContain('identity verification on web')

    const rejected = onboardingCompanionStatusPresentation({ status: 'rejected' }, false)
    expect(rejected.label).toBe('Needs changes')
    expect(rejected.guidance).toContain('Companion screen')

    const justSubmitted = onboardingCompanionStatusPresentation(null, true)
    expect(justSubmitted.label).toBe('Pending review')
  })

  it('falls back to pending review for unknown statuses instead of crashing', () => {
    expect(onboardingCompanionStatusPresentation({ status: 'something_new' }, false).label).toBe('Pending review')
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
      earningMotivation: 'I want to earn by sharing everyday help with members in my city.',
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
        earningMotivation: form.earningMotivation,
      },
    })
  })

  it('rejects incomplete applications with the same boundaries as the Companion screen', () => {
    const base = {
      ...defaultOnboardingCompanionForm({ categories: ['Coffee and meals'] }),
      intro: 'I join relaxed public coffee chats and thoughtful city walks with clear plans.',
      city: 'Cebu City',
      earningMotivation: 'I want to earn by sharing everyday help with members in my city.',
    }
    expect(validateCompanionApplication({ ...base, intro: 'Too short' })).toMatchObject({ ok: false })
    expect(validateCompanionApplication({ ...base, strengths: [] })).toMatchObject({ ok: false })
    expect(validateCompanionApplication({ ...base, categories: [] })).toMatchObject({ ok: false })
    expect(validateCompanionApplication({ ...base, boundaries: '  ' })).toMatchObject({ ok: false })
    expect(validateCompanionApplication({ ...base, earningMotivation: 'Too short' })).toMatchObject({ ok: false })
    expect(validateCompanionApplication({ ...base, hourlyRatePesos: '50' })).toMatchObject({ ok: false })
    expect(validateCompanionApplication({ ...base, mode: 'in_person' as const, city: '  ' })).toMatchObject({ ok: false })
  })

  it('keeps skip and review copy free of em dashes and pointed at the Companion screen', () => {
    for (const copy of [
      onboardingCompanionSkipCopy,
      onboardingCompanionReviewNotice,
      onboardingCompanionIdentityFollowupCopy,
      onboardingCompanionHeroTitle,
      onboardingCompanionHeroCopy,
    ]) {
      expect(copy).not.toContain('—')
    }
    expect(onboardingCompanionSkipCopy).toContain('Companion screen')
    expect(onboardingCompanionReviewNotice).toContain('Admin review stays required')
    expect(onboardingCompanionIdentityFollowupCopy).toContain('on web')
  })
})
