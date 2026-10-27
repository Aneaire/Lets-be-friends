import { useEffect } from 'react'
import { AppState } from 'react-native'

/** Webhooks update the wallet immediately. Poll while this screen is active as a fallback. */
export function useTopUpReconciliation(topUpId: string | undefined, refresh: (topUpId: string) => Promise<unknown>) {
  useEffect(() => {
    if (!topUpId) return
    let inFlight = false
    let disposed = false
    async function check() {
      if (disposed || inFlight || (AppState.currentState && AppState.currentState !== 'active')) return
      inFlight = true
      try { await refresh(topUpId!) } catch {
        // Keep the last server-confirmed state. The next poll or webhook retries.
      } finally { inFlight = false }
    }
    void check()
    const timer = setInterval(() => void check(), 20_000)
    const listener = AppState.addEventListener('change', (state) => { if (state === 'active') void check() })
    return () => { disposed = true; clearInterval(timer); listener.remove() }
  }, [topUpId, refresh])
}
