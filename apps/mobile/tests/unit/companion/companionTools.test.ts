import { COMPANION_BIO_PLACEHOLDER, initialCompanionApplicationForm, validateCompanionApplication, validateHourlyRate } from '@/data/companionTools'

describe('Companion mobile models and validation', () => {
  const validForm = {
    intro: 'I join relaxed public coffee chats and thoughtful city walks with clear plans.',
    city: 'Cebu City',
    mode: 'both' as const,
    hourlyRatePesos: '500',
    strengths: ['Good listener'],
    categories: ['Coffee and meals'],
    boundaries: 'Public places only\nNo dating expectations',
    applicationNote: '  Ready for review.  ',
    bio: 'Something personal about hobbies, family, and work.',
    earningMotivation: 'I want to earn by sharing everyday help with members in my city.',
  }

  it('normalizes a valid application using shared Strengths and activities', () => {
    expect(validateCompanionApplication({
      ...validForm,
      categories: ['  Board   game nights  ', 'coffee and meals'],
    })).toEqual({
      ok: true,
      value: {
        intro: validForm.intro,
        city: 'Cebu City',
        mode: 'both',
        hourlyRateCentavos: 50_000,
        strengths: ['Good listener'],
        categories: ['Board game nights', 'Coffee and meals'],
        boundaries: ['Public places only', 'No dating expectations'],
        applicationNote: 'Ready for review.',
        bio: 'Something personal about hobbies, family, and work.',
        earningMotivation: 'I want to earn by sharing everyday help with members in my city.',
      },
    })
  })

  it('rejects missing safety content, unknown choices, and rates outside backend limits', () => {
    expect(validateCompanionApplication({ ...validForm, intro: 'Too short' })).toMatchObject({ ok: false })
    expect(validateCompanionApplication({ ...validForm, strengths: ['Invented Strength'] })).toMatchObject({ ok: false, message: 'Review the selected Strengths.' })
    expect(validateCompanionApplication({ ...validForm, categories: ['Everything'] })).toMatchObject({ ok: false, message: 'Everything is a filter and cannot be saved as a category.' })
    expect(validateCompanionApplication({ ...validForm, categories: ['Board games', ' board games '] })).toMatchObject({ ok: false, message: 'Choose each category only once.' })
    expect(validateCompanionApplication({ ...validForm, boundaries: '  ' })).toMatchObject({ ok: false, message: 'Add at least one clear boundary.' })
    expect(validateCompanionApplication({ ...validForm, earningMotivation: 'Too short' })).toMatchObject({ ok: false })
    expect(validateCompanionApplication({ ...validForm, earningMotivation: '  ' })).toMatchObject({ ok: false })
    expect(validateCompanionApplication({ ...validForm, bio: 'x'.repeat(501) })).toMatchObject({ ok: false })
    expect(validateHourlyRate('99.99')).toEqual({ ok: false, message: 'Set an hourly rate from PHP 100 to PHP 10,000.' })
    expect(validateHourlyRate('10000')).toEqual({ ok: true, hourlyRateCentavos: 1_000_000 })
  })

  it('uses the required bio placeholder for the member bio field', () => {
    expect(COMPANION_BIO_PLACEHOLDER).toBe('Something personal about your hobbies, family, or work.')
  })

  it('hydrates an existing application without creating location fields', () => {
    const form = initialCompanionApplicationForm({
      ...validForm,
      hourlyRateCentavos: 75_000,
      boundaries: ['Public places only'],
    })
    expect(form.hourlyRatePesos).toBe('750')
    expect(form.boundaries).toBe('Public places only')
    expect(form.bio).toBe(validForm.bio)
    expect(form.earningMotivation).toBe(validForm.earningMotivation)
    expect(Object.keys(form)).not.toContain('approximateLatitude')
  })

  it('hydrates legacy applications without the new motivation field', () => {
    const { earningMotivation: _omitted, bio: _bioOmitted, ...legacy } = validForm
    const form = initialCompanionApplicationForm({
      ...legacy,
      hourlyRateCentavos: 75_000,
      boundaries: ['Public places only'],
    })
    expect(form.earningMotivation).toBe('')
    expect(form.bio).toBe('')
  })
})
