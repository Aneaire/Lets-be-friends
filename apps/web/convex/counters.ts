/**
 * Safe nonnegative counter adjustment for the exact engagement counters.
 *
 * Relationship rows remain canonical. Counters mirror them and are patched in
 * the same mutation that inserts or deletes the matching row. This helper keeps
 * the value from going below zero if a counter is ever stale or is being
 * decremented after a backfill that did not yet observe the row.
 */
export function adjustCounter(current: number | undefined | null, delta: number): number {
  const next = (current ?? 0) + delta
  return Math.max(0, next)
}
