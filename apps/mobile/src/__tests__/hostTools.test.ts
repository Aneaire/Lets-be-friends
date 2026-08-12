import { hasSavedNearbyCoordinates, initialHostApplicationForm, validateHostApplication, validateHourlyRate } from '@/data/hostTools'

describe('Friend Host mobile models and validation', () => {
  const validForm = {
    intro: 'I host relaxed public coffee chats and thoughtful city walks with clear plans.',
    city: 'Cebu City',
    mode: 'both' as const,
    hourlyRatePesos: '500',
    strengths: ['Good listener'],
    categories: ['Coffee and meals'],
    boundaries: 'Public places only\nNo dating expectations',
    applicationNote: '  Ready for review.  ',
  }

  it('normalizes a valid application using shared Strengths and activities', () => {
    expect(validateHostApplication(validForm)).toEqual({
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
    expect(validateHostApplication({ ...validForm, intro: 'Too short' })).toMatchObject({ ok: false })
    expect(validateHostApplication({ ...validForm, strengths: ['Invented Strength'] })).toMatchObject({ ok: false, message: 'Review the selected Strengths.' })
    expect(validateHostApplication({ ...validForm, boundaries: '  ' })).toMatchObject({ ok: false, message: 'Add at least one clear boundary.' })
    expect(validateHourlyRate('99.99')).toEqual({ ok: false, message: 'Set an hourly rate from PHP 100 to PHP 10,000.' })
    expect(validateHourlyRate('10000')).toEqual({ ok: true, hourlyRateCentavos: 1_000_000 })
  })

  it('enables nearby discovery only when a saved coordinate pair already exists', () => {
    expect(hasSavedNearbyCoordinates({ approximateLatitude: 14.95, approximateLongitude: 120.67 })).toBe(true)
    expect(hasSavedNearbyCoordinates({ approximateLatitude: 14.95 })).toBe(false)
    expect(hasSavedNearbyCoordinates(null)).toBe(false)
  })

  it('hydrates an existing application without creating location fields', () => {
    const form = initialHostApplicationForm({
      ...validForm,
      hourlyRateCentavos: 75_000,
      boundaries: ['Public places only'],
    })
    expect(form.hourlyRatePesos).toBe('750')
    expect(form.boundaries).toBe('Public places only')
    expect(Object.keys(form)).not.toContain('approximateLatitude')
  })
})
