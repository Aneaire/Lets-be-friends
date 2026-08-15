import { buildPlanThread } from '@/data/planThread'

describe('Plan Thread', () => {
  it('makes an accepted booking the current experience plan', () => {
    const steps = buildPlanThread({ status: 'accepted', requestedAt: Date.now() + 60_000 })
    expect(steps.map((step) => step.state)).toEqual(['done', 'done', 'current', 'upcoming', 'upcoming'])
  })

  it('keeps preserved history visible after cancellation', () => {
    const steps = buildPlanThread({ status: 'cancelled', requestedAt: Date.now() })
    expect(steps[1]).toMatchObject({ title: 'Plan ended', state: 'stopped' })
    expect(steps[1].detail).toContain('safety records remain available')
  })

  it('opens reflection after both people complete', () => {
    const steps = buildPlanThread({ status: 'review_window', requestedAt: Date.now(), memberCompletedAt: 1, companionCompletedAt: 2 })
    expect(steps[3].state).toBe('done')
    expect(steps[4].state).toBe('current')
  })
})
