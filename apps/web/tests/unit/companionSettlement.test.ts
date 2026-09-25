import { describe, expect, it } from 'vitest'
import {
  companionSettlementPresentation,
  formatSettlementReleaseAt,
} from '../../src/features/booking/companionSettlement'

const ELIGIBLE_AT = Date.UTC(2026, 7, 12, 5, 39, 0)

describe('companionSettlementPresentation', () => {
  it('shows the exact local release date and the 24-hour review window for pending settlement', () => {
    const settlement = companionSettlementPresentation({
      settlementState: 'pending',
      settlementEligibleAt: ELIGIBLE_AT,
    })

    expect(settlement.state).toBe('pending')
    expect(settlement.tone).toBe('warning')
    expect(settlement.label).toBe('Pending 24-hour review')
    expect(settlement.releaseAt).toBe(ELIGIBLE_AT)
    expect(settlement.releaseAtLabel).toBe('Aug 12, 2026, 1:39 PM')
    expect(settlement.explanation).toContain('24-hour review window')
    expect(settlement.explanation).toContain('Aug 12, 2026, 1:39 PM')
    expect(settlement.explanation).toContain('Asia/Manila')
  })

  it('falls back to a timestampless pending explanation when the release time is unknown', () => {
    const settlement = companionSettlementPresentation({ settlementState: 'pending' })

    expect(settlement.tone).toBe('warning')
    expect(settlement.releaseAt).toBeUndefined()
    expect(settlement.explanation).toContain('24-hour review window')
  })

  it('describes settled funds as available in the Companion wallet', () => {
    const settlement = companionSettlementPresentation({ settlementState: 'settled' })

    expect(settlement.state).toBe('settled')
    expect(settlement.tone).toBe('success')
    expect(settlement.label).toBe('Available in your wallet')
    expect(settlement.explanation).toContain('available in your Companion wallet')
  })

  it('explains that an active report placed blocked funds on hold for review', () => {
    const settlement = companionSettlementPresentation({ settlementState: 'blocked' })

    expect(settlement.state).toBe('blocked')
    expect(settlement.tone).toBe('warning')
    expect(settlement.label).toBe('On hold for review')
    expect(settlement.explanation).toContain('active report')
    expect(settlement.explanation).toContain('on hold')
  })

  it('explains that reserved funds wait for both participants to confirm completion', () => {
    const settlement = companionSettlementPresentation({ settlementState: 'reserved' })

    expect(settlement.state).toBe('reserved')
    expect(settlement.tone).toBe('warning')
    expect(settlement.label).toBe('Reserved until completion')
    expect(settlement.explanation).toContain('reserved until both')
    expect(settlement.explanation).toContain('24-hour review window')
  })

  it('returns refunded funds to the member without recording Companion earnings', () => {
    const settlement = companionSettlementPresentation({ settlementState: 'refunded' })

    expect(settlement.state).toBe('refunded')
    expect(settlement.tone).toBe('neutral')
    expect(settlement.label).toBe('Returned to member')
    expect(settlement.explanation).toContain('returned to the member')
  })

  it('has deterministic neutral copy for unreserved and unknown settlement states', () => {
    const unreserved = companionSettlementPresentation({ settlementState: 'unreserved' })
    const unknown = companionSettlementPresentation({ settlementState: 'something_else' })
    const missing = companionSettlementPresentation({})

    expect(unreserved.state).toBe('unreserved')
    expect(unreserved.tone).toBe('neutral')
    expect(unknown.state).toBe('unknown')
    expect(unknown.tone).toBe('neutral')
    expect(missing.state).toBe('unknown')
  })

  it('never uses an em dash in settlement copy', () => {
    const states = ['unreserved', 'reserved', 'pending', 'blocked', 'settled', 'refunded', 'unknown']
    for (const settlementState of states) {
      const { label, explanation } = companionSettlementPresentation({ settlementState })
      expect(`${label} ${explanation}`).not.toContain('—')
    }
  })
})

describe('formatSettlementReleaseAt', () => {
  it('formats the release instant in Asia/Manila time deterministically', () => {
    expect(formatSettlementReleaseAt(ELIGIBLE_AT)).toBe('Aug 12, 2026, 1:39 PM')
  })
})
