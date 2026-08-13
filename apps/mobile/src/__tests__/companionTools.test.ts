import { initialCompanionApplicationForm, validateCompanionApplication, validateHourlyRate } from '@/data/companionTools'

describe('Companion mobile models and validation', () => {
  const validForm = {
    intro: 'I companion relaxed public coffee chats and thoughtful city walks with clear plans.',
    city: 'Cebu City',
    mode: 'both' as const,
    hourlyRatePesos: '500',
    strengths: ['Good listener'],
    categories: ['Coffee and meals'],
    boundaries: 'Public places only\nNo dating expectations',
    applicationNote: '  Ready for review.  ',
  }

  it('normalizes a valid application using shared Strengths and activities', () => {
    expect(validateCompanionApplication(validForm)).toEqual({
      ok: true,
      value: {
        intro: validForm.intro,
        city: 'Cebu City',
        mode: 'both',
        hourlyRateCentavos: 50_000,
        strengths: ['Good listener'],
        categories: ['Coffee and meals'],
        boundaries: ['Public places only', 'No dating expectations'],
        applicationNote: 'Ready for review.',
      },
    })
  })

  it('rejects missing safety content, unknown choices, and rates outside backend limits', () => {
    expect(validateCompanionApplication({ ...validForm, intro: 'Too short' })).toMatchObject({ ok: false })
    expect(validateCompanionApplication({ ...validForm, strengths: ['Invented Strength'] })).toMatchObject({ ok: false, message: 'Review the selected Strengths.' })
    expect(validateCompanionApplication({ ...validForm, boundaries: '  ' })).toMatchObject({ ok: false, message: 'Add at least one clear boundary.' })
    expect(validateHourlyRate('99.99')).toEqual({ ok: false, message: 'Set an hourly rate from PHP 100 to PHP 10,000.' })
    expect(validateHourlyRate('10000')).toEqual({ ok: true, hourlyRateCentavos: 1_000_000 })
  })

  it('hydrates an existing application without creating location fields', () => {
    const form = initialCompanionApplicationForm({
      ...validForm,
      hourlyRateCentavos: 75_000,
      boundaries: ['Public places only'],
    })
    expect(form.hourlyRatePesos).toBe('750')
    expect(form.boundaries).toBe('Public places only')
    expect(Object.keys(form)).not.toContain('approximateLatitude')
  })
})
