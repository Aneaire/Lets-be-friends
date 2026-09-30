import {
  canManageCircleEvents,
  circleEventLocationLine,
  circleEventModeLabel,
  formatCircleEventWhen,
  groupCircleEventsByDay,
  shouldQueryCircleEvents,
  validateCircleEventDraft,
  validateCircleEventThumbnailAsset,
} from '@/features/circles/circlePresentation'

describe('mobile Circle event presentation', () => {
  it('labels the session format for online, in-person, and combined events', () => {
    expect(circleEventModeLabel('online')).toBe('Online')
    expect(circleEventModeLabel('in_person')).toBe('In person')
    expect(circleEventModeLabel('both')).toBe('Online and in person')
    expect(circleEventModeLabel(undefined)).toBeNull()
  })

  it('formats the event date and time for member display', () => {
    const startsAt = new Date(2026, 9, 10, 15, 30).getTime()
    const formatted = formatCircleEventWhen(startsAt)
    expect(formatted).toContain('Oct')
    expect(formatted).toContain('10')
  })

  it('combines location and format without leaking a home address prompt', () => {
    expect(circleEventLocationLine({ location: 'Ayala Center Cebu', mode: 'in_person' })).toBe('Ayala Center Cebu · In person')
    expect(circleEventLocationLine({ location: undefined, mode: 'online' })).toBe('Online')
    expect(circleEventLocationLine({ location: undefined, mode: undefined })).toBeUndefined()
  })

  it('requires a title, details, and a future date and time', () => {
    const future = Date.now() + 24 * 60 * 60 * 1000
    expect(validateCircleEventDraft({ title: '', details: 'Plan', startsAt: future })).toBe('Event title and details are required.')
    expect(validateCircleEventDraft({ title: 'Walk', details: '', startsAt: future })).toBe('Event title and details are required.')
    expect(validateCircleEventDraft({ title: 'Walk', details: 'Plan', startsAt: Date.now() - 1000 })).toBe('Event date and time must be in the future.')
    expect(validateCircleEventDraft({ title: 'Walk', details: 'Plan', startsAt: null })).toBe('Event date and time must be in the future.')
  })

  it('rejects overlong or multiline event fields', () => {
    const future = Date.now() + 24 * 60 * 60 * 1000
    expect(validateCircleEventDraft({ title: 'x'.repeat(121), details: 'Plan', startsAt: future })).toBe('Event details are too long.')
    expect(validateCircleEventDraft({ title: 'Walk', details: 'x'.repeat(2001), startsAt: future })).toBe('Event details are too long.')
    expect(validateCircleEventDraft({ title: 'Walk', details: 'Plan', startsAt: future, location: 'Line one\nLine two' })).toBe('Use a short, single-line event location.')
  })

  it('accepts a complete future event draft', () => {
    expect(validateCircleEventDraft({
      title: 'Weekend coffee crawl',
      details: 'Meet at a public cafe and walk to two nearby spots.',
      startsAt: Date.now() + 48 * 60 * 60 * 1000,
      location: 'Ayala Center Cebu',
    })).toBeNull()
  })
})

describe('mobile Circle event grouping', () => {
  it('groups upcoming events by day in chronological order', () => {
    const first = new Date(2026, 9, 10, 9, 0).getTime()
    const second = new Date(2026, 9, 10, 18, 0).getTime()
    const third = new Date(2026, 9, 12, 10, 0).getTime()
    const groups = groupCircleEventsByDay([
      { _id: 'c', startsAt: third },
      { _id: 'b', startsAt: second },
      { _id: 'a', startsAt: first },
    ])
    expect(groups).toHaveLength(2)
    expect(groups[0].events.map((event) => event._id)).toEqual(['a', 'b'])
    expect(groups[1].events.map((event) => event._id)).toEqual(['c'])
  })
})

describe('mobile Circle event access', () => {
  it('lets only leaders manage events on usable Circles', () => {
    expect(canManageCircleEvents({ canModerate: true, circleState: 'active' })).toBe(true)
    expect(canManageCircleEvents({ canModerate: false, circleState: 'active' })).toBe(false)
    expect(canManageCircleEvents({ canModerate: true, circleState: 'archived' })).toBe(false)
    expect(canManageCircleEvents({ canModerate: true, circleState: 'suspended' })).toBe(false)
  })

  it('queries events only when the server grants discussion reads', () => {
    expect(shouldQueryCircleEvents(true)).toBe(true)
    expect(shouldQueryCircleEvents(false)).toBe(false)
    expect(shouldQueryCircleEvents(null)).toBe(false)
    expect(shouldQueryCircleEvents(undefined)).toBe(false)
  })
})

describe('mobile Circle event thumbnails', () => {
  it('accepts JPEG, PNG, and WebP still images', () => {
    expect(validateCircleEventThumbnailAsset({ type: 'image', mimeType: 'image/jpeg', fileSize: 100 }).ok).toBe(true)
    expect(validateCircleEventThumbnailAsset({ type: 'image', mimeType: 'image/png', fileName: 'thumb.png', fileSize: 100 }).ok).toBe(true)
    expect(validateCircleEventThumbnailAsset({ type: 'image', mimeType: 'image/webp', fileSize: 100 }).ok).toBe(true)
  })

  it('rejects unsupported types, oversized files, and non-images', () => {
    expect(validateCircleEventThumbnailAsset({ type: 'image', mimeType: 'image/gif', fileSize: 100 }).ok).toBe(false)
    expect(validateCircleEventThumbnailAsset({ type: 'image', mimeType: 'image/jpeg', fileSize: 6 * 1024 * 1024 }).ok).toBe(false)
    expect(validateCircleEventThumbnailAsset({ type: 'video', mimeType: 'video/mp4', fileSize: 100 }).ok).toBe(false)
  })
})
