import { companionMoneyCopy, memberMoneyLabel } from '@/data/bookingMoney'

describe('mobile booking money copy', () => {
  it('does not charge or reserve on a declined booking', () => {
    expect(memberMoneyLabel('declined')).toBe('not charged')
    expect(companionMoneyCopy({
      bookingStatus: 'declined',
      memberTotalCentavos: 57_500,
      companionEarningsCentavos: 50_000,
    })).toMatchObject({ label: 'No payment', tone: 'neutral' })
  })

  it('uses reserved wording only after acceptance', () => {
    expect(memberMoneyLabel('request_sent')).toBe('not charged yet · reserved if accepted')
    expect(memberMoneyLabel('accepted', 'reserved')).toBe('reserved · released on completion')
    expect(companionMoneyCopy({
      bookingStatus: 'accepted',
      settlementState: 'reserved',
      memberTotalCentavos: 57_500,
      companionEarningsCentavos: 50_000,
    })).toMatchObject({ label: 'Reserved until completion', tone: 'warning' })
  })

  it('names the platform fee before acceptance', () => {
    const copy = companionMoneyCopy({
      bookingStatus: 'request_sent',
      memberTotalCentavos: 57_500,
      companionEarningsCentavos: 50_000,
    })
    expect(copy.memberCopy).toContain('₱575.00')
    expect(copy.memberCopy).toContain('₱75.00 difference is the platform service fee')
  })
})
