import { createMapInteractionTracker } from '@/design-system/organisms/productMapInteraction'

describe('map interaction tracker', () => {
  it('reports one active interaction for the first pointer and stops after the last pointer lifts', () => {
    const changes: boolean[] = []
    const tracker = createMapInteractionTracker((active) => changes.push(active))

    tracker.start()
    expect(changes).toEqual([true])

    tracker.end()
    expect(changes).toEqual([true, false])
  })

  it('keeps the enclosing list locked until every finger of a pinch lifts', () => {
    const changes: boolean[] = []
    const tracker = createMapInteractionTracker((active) => changes.push(active))

    tracker.start()
    tracker.start()
    tracker.end()
    expect(changes).toEqual([true])

    tracker.end()
    expect(changes).toEqual([true, false])
  })

  it('does not emit duplicate changes for repeated start or end events', () => {
    const changes: boolean[] = []
    const tracker = createMapInteractionTracker((active) => changes.push(active))

    tracker.start()
    tracker.start()
    tracker.end()
    tracker.end()
    tracker.end()
    expect(changes).toEqual([true, false])
  })

  it('releases the list when the map unmounts mid gesture or a touch is cancelled', () => {
    const changes: boolean[] = []
    const tracker = createMapInteractionTracker((active) => changes.push(active))

    tracker.start()
    tracker.reset()
    expect(changes).toEqual([true, false])

    tracker.start()
    tracker.end()
    tracker.reset()
    expect(changes).toEqual([true, false, true, false])
  })
})
