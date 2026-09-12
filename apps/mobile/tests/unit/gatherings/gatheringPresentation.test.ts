import {
  canLeaveGathering,
  canRequestGathering,
  formatGatheringDuration,
  gatheringAudienceOptions,
  gatheringIndexPresentation,
  gatheringModeLabel,
  gatheringParticipantStateLabel,
  gatheringSeatLabel,
  gatheringStateLabel,
  gatheringStatusCopy,
  type GatheringSummaryLike,
} from '@/features/gatherings/gatheringPresentation'

const viewer = { isHost: false, isCompanion: false, participantState: null, canRequestJoin: false, canConfirm: false }

function row(overrides: Partial<GatheringSummaryLike> = {}): GatheringSummaryLike {
  return {
    _id: 'gathering-1',
    category: 'Coffee or meal companion',
    state: 'open' as const,
    startsAt: Date.now() + 86_400_000,
    durationMinutes: 60,
    capacity: 4,
    confirmedCount: 1,
    viewer,
    ...overrides,
  }
}

describe('gathering presentation', () => {
  it('labels state, mode, seats, and duration in words', () => {
    expect(gatheringStateLabel('open')).toBe('Open')
    expect(gatheringStateLabel('closed')).toBe('Closed')
    expect(gatheringStateLabel('cancelled')).toBe('Cancelled')
    expect(gatheringModeLabel('in_person')).toBe('In person')
    expect(gatheringModeLabel('online')).toBe('Online session')
    expect(gatheringSeatLabel(3, 4)).toBe('1 seat left')
    expect(gatheringSeatLabel(4, 4)).toBe('Full')
    expect(gatheringSeatLabel(0, 4)).toBe('4 seats left')
    expect(formatGatheringDuration(90)).toBe('90 minutes')
    expect(formatGatheringDuration(120)).toBe('2 hours')
  })

  it('separates hosted and joined Gatherings', () => {
    const index = gatheringIndexPresentation([
      row({ _id: 'hosted', viewer: { ...viewer, isHost: true } }),
      row({ _id: 'joined', viewer: { ...viewer, participantState: 'confirmed' } }),
    ])
    expect(index.loading).toBe(false)
    expect(index.hosting.map((item) => item._id)).toEqual(['hosted'])
    expect(index.joined.map((item) => item._id)).toEqual(['joined'])
  })

  it('reports loading while the query resolves', () => {
    expect(gatheringIndexPresentation(undefined).loading).toBe(true)
  })

  it('gates joining and leaving on viewer and Gathering state', () => {
    expect(canRequestGathering({ ...viewer, canRequestJoin: true }, 'open')).toBe(true)
    expect(canRequestGathering({ ...viewer, canRequestJoin: true }, 'closed')).toBe(false)
    expect(canRequestGathering({ ...viewer, canRequestJoin: false }, 'open')).toBe(false)
    expect(canLeaveGathering({ ...viewer, participantState: 'confirmed' })).toBe(true)
    expect(canLeaveGathering({ ...viewer, participantState: 'requested' })).toBe(true)
    expect(canLeaveGathering({ ...viewer, participantState: 'left' })).toBe(false)
    expect(canLeaveGathering({ ...viewer, isHost: true })).toBe(false)
  })

  it('describes the viewer place and participant states', () => {
    expect(gatheringStatusCopy({ ...viewer, isHost: true })).toBe('You are hosting this Gathering.')
    expect(gatheringStatusCopy({ ...viewer, participantState: 'confirmed' })).toBe('Your seat is confirmed.')
    expect(gatheringStatusCopy({ ...viewer, participantState: 'requested' })).toBe('Your request is waiting for the host.')
    expect(gatheringStatusCopy(viewer)).toBeNull()
    expect(gatheringParticipantStateLabel('removed')).toBe('Removed')
    expect(gatheringParticipantStateLabel('declined')).toBe('Not confirmed')
  })

  it('builds audience options from the Gathering Circle', () => {
    expect(gatheringAudienceOptions().map((option) => option.value)).toEqual(['none', 'profile'])
    expect(gatheringAudienceOptions('circle-1').map((option) => option.value)).toEqual(['none', 'profile', 'circle-1'])
  })
})
