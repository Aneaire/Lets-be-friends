import { useAction, useQuery } from 'convex/react'
import { useEffect, useRef, useState } from 'react'
import { formatPhp } from '@lets-be-friends/shared'
import { api } from '../../../convex/_generated/api'
import { OpenableImage } from '../../design-system/molecules/OpenableImage'

export type MemberFinance = NonNullable<ReturnType<typeof useQuery<typeof api.finance.memberDashboard>>>

export function MemberWalletPanel({ finance, onCreateTopUp }: {
  finance: MemberFinance | null | undefined
  onCreateTopUp: (amountCentavos: number) => Promise<void>
}) {
  const refreshMemberTopUp = useAction(api.paymongo.refreshMemberTopUp)
  const refreshInFlightRef = useRef(false)
  const [busy, setBusy] = useState(false)
  const [walletError, setWalletError] = useState('')
  const [clockNow, setClockNow] = useState(() => Date.now())
  const activeTopUp = finance?.topUps.find((topUp) =>
    ['creating', 'awaiting_payment', 'processing'].includes(topUp.status)
    && (topUp.expiresAt === undefined || topUp.expiresAt > clockNow),
  )
  const qrTopUp = activeTopUp ?? finance?.topUps.find((topUp) => topUp.qrImageUrl && topUp.status !== 'paid')
  const qrExpired = Boolean(qrTopUp?.expiresAt && qrTopUp.expiresAt <= clockNow)
  const showPayableQr = Boolean(
    qrTopUp?.qrImageUrl
    && ['awaiting_payment', 'processing'].includes(qrTopUp.status)
    && !qrExpired,
  )

  useEffect(() => {
    const timer = window.setInterval(() => setClockNow(Date.now()), 1_000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!activeTopUp?.providerIntentId) return
    let cancelled = false
    let timer: number | undefined

    const poll = async () => {
      if (cancelled) return
      if (refreshInFlightRef.current) {
        timer = window.setTimeout(() => void poll(), 250)
        return
      }
      refreshInFlightRef.current = true
      let terminal = false
      try {
        const refreshed = await refreshMemberTopUp({ topUpId: activeTopUp._id })
        terminal = isTerminalProviderTopUpStatus(refreshed.providerStatus)
          || (refreshed.expiresAt !== undefined && refreshed.expiresAt <= Date.now())
      } catch {
        // Provider or network failures are retried while this panel remains open.
      } finally {
        refreshInFlightRef.current = false
      }
      if (!cancelled && !terminal) timer = window.setTimeout(() => void poll(), 3_000)
    }

    void poll()
    return () => {
      cancelled = true
      if (timer !== undefined) window.clearTimeout(timer)
    }
  }, [activeTopUp?._id, activeTopUp?.providerIntentId, refreshMemberTopUp])

  return (
    <section id="member-wallet" className="mb-10" aria-labelledby="member-wallet-title">
      <header className="flex items-baseline justify-between gap-3 mb-3">
        <div>
          <h2 id="member-wallet-title" className="text-h2">Booking balance</h2>
          <p className="text-meta mt-1">Use this balance for booking requests. You will see the complete booking total, including the service fee, before sending.</p>
        </div>
        {finance && <span className="status-pill" data-tone="success">{formatPhp(finance.availableCentavos)} available</span>}
      </header>
      {walletError && <div className="notice notice-danger mb-3" role="alert"><span className="notice-icon">!</span><span>{walletError}</span></div>}
      {!finance && <div className="empty-state">Loading booking wallet…</div>}
      {finance && (
        <div className="panel p-5 space-y-5">
          {!finance.enabled && (
            <div className="notice notice-warning text-meta"><span className="notice-icon">!</span><span>New member-wallet bookings are disabled on this server. Existing balances and settlements remain readable.</span></div>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="wallet-metric wallet-metric-available"><p className="text-meta">Available to book</p><p className="text-h2 tabular mt-1">{formatPhp(finance.availableCentavos)}</p></div>
            <div className="wallet-metric wallet-metric-pending"><p className="text-meta">Reserved for accepted bookings</p><p className="text-h2 tabular mt-1">{formatPhp(finance.reservedCentavos)}</p></div>
          </div>
          <div className="member-wallet-actions-grid">
            <form
              className="space-y-3"
              onSubmit={async (event) => {
                event.preventDefault()
                setBusy(true)
                setWalletError('')
                try {
                  const form = new FormData(event.currentTarget)
                  await onCreateTopUp(Math.round(Number(form.get('topUpPesos')) * 100))
                } catch (submitError) {
                  setWalletError(submitError instanceof Error ? submitError.message : 'Top-up could not be started.')
                } finally {
                  setBusy(false)
                }
              }}
            >
              <div><p className="text-h3">Add balance with PayMongo QR Ph</p><p className="text-meta mt-1">Only a provider-verified paid intent credits this wallet.</p></div>
              <label className="field-row"><span className="label">Top-up amount <span className="label-aux">PHP</span></span><input name="topUpPesos" type="number" min="100" max="100000" step="0.01" defaultValue="1000" required className="field" disabled={busy || Boolean(activeTopUp) || !finance.enabled} /></label>
              <button className="btn btn-self" disabled={busy || Boolean(activeTopUp) || !finance.enabled}>{busy ? 'Creating QR…' : activeTopUp ? 'QR attempt still active' : 'Create QR Ph top-up'}</button>
            </form>
            <div className="member-wallet-qr-card rounded-lg border border-[color:var(--rule)] bg-[color:var(--surface-subtle)] p-4">
              <p className="text-h3">Current QR attempt</p>
              {!qrTopUp && <p className="text-meta mt-2">No member-wallet top-up attempt yet.</p>}
              {qrTopUp && (
                <div className="mt-3 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <strong className="tabular">{formatPhp(qrTopUp.amountCentavos)}</strong>
                    <span className="status-pill" data-tone={qrTopUp.status === 'paid' ? 'success' : qrTopUp.status === 'failed' || qrTopUp.status === 'expired' || qrExpired ? 'danger' : 'social'}>
                      {qrExpired && qrTopUp.status !== 'paid' ? 'expired' : qrTopUp.status.replaceAll('_', ' ')}
                    </span>
                  </div>
                  {qrTopUp.expiresAt !== undefined && !qrExpired && ['awaiting_payment', 'processing'].includes(qrTopUp.status) && (
                    <p className="text-meta tabular" role="timer">QR expires in {formatQrCountdown(qrTopUp.expiresAt - clockNow)}</p>
                  )}
                  {qrExpired && qrTopUp.status !== 'paid' && <p className="text-meta">This QR expired. You can create a fresh top-up.</p>}
                  {showPayableQr && qrTopUp.qrImageUrl && (
                    <>
                      <OpenableImage src={qrTopUp.qrImageUrl} alt={`QR Ph code for ${formatPhp(qrTopUp.amountCentavos)} wallet top-up`} className="mx-auto max-w-64 rounded-lg bg-white p-3" />
                      <a href={qrTopUp.qrImageUrl} download={`lets-be-friends-qr-ph-${qrTopUp._id}.png`} className="btn btn-neutral btn-sm">
                        Download QR
                      </a>
                      <p className="text-meta">Download the QR if you need to pay from this phone.</p>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

function isTerminalProviderTopUpStatus(status: string) {
  return ['succeeded', 'paid', 'failed', 'cancelled', 'expired'].includes(status)
}

function formatQrCountdown(milliseconds: number) {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1_000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}
