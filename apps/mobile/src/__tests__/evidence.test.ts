import { evidenceDecisionCopy } from '@/data/evidence'

describe('booking evidence decision copy', () => {
  it('uses truthful role and decision copy', () => {
    expect(evidenceDecisionCopy('host_start', 'uploaded')).toEqual({ label: 'Start evidence', detail: 'Private image saved in the web app.' })
    expect(evidenceDecisionCopy('member_end', 'skipped')).toEqual({ label: 'End evidence', detail: 'Skipped after the strict warning was acknowledged.' })
    expect(evidenceDecisionCopy('member_end', undefined).detail).toContain('explicitly skip')
  })
})
