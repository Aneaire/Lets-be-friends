/**
 * Tracks how many pointers are currently touching a native map so the screen can
 * stop an enclosing ScrollView or FlatList from stealing the gesture. Android's
 * scroll containers intercept drags on move, which cancels pinch and pan before
 * MapLibre sees them.
 */
export type MapInteractionTracker = {
  start: () => void
  end: () => void
  reset: () => void
}

export function createMapInteractionTracker(onChange: (active: boolean) => void): MapInteractionTracker {
  let pointers = 0
  let active = false

  function update(next: boolean) {
    if (next === active) return
    active = next
    onChange(next)
  }

  return {
    start() {
      pointers += 1
      update(true)
    },
    end() {
      pointers = Math.max(0, pointers - 1)
      if (pointers === 0) update(false)
    },
    reset() {
      pointers = 0
      update(false)
    },
  }
}
