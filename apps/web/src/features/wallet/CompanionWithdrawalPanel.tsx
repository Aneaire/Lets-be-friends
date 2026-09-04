import { Link } from '@tanstack/react-router'
import { useAction, useMutation, useQuery } from 'convex/react'
import { useState } from 'react'
import { formatPhp } from '@lets-be-friends/shared'
import { api } from '../../../convex/_generated/api'

type PayoutDashboard = NonNullable<ReturnType<typeof useQuery<typeof api.withdrawals.dashboard>>>

const VERIFY_IDENTITY_MESSAGE = 'Complete identity verification first. Your payout account must use your verified legal name.'

export function friendlyPayoutError(error: unknown, fallback: string) {
  const raw = error instanceof Error && error.message ? error.message : fallback
  const message = unwrapConvexError(raw)
  if (/identity verification/i.test(message)) return VERIFY_IDENTITY_MESSAGE
  if (/approved companion profile/i.test(message)) return 'You need an approved Companion profile before using withdrawals.'
  if (/account is suspended/i.test(message)) return 'This account is suspended and cannot use withdrawals.'
  if (/withdrawals are not enabled/i.test(message)) return 'Withdrawals are currently disabled by the platform.'
  if (/profile sync required/i.test(message)) return 'Your profile is still syncing. Reload this page and try again.'
  return message || fallback
}

function unwrapConvexError(message: string) {
  const marker = 'Uncaught Error: '
  const index = message.lastIndexOf(marker)
  if (index === -1) return message
  const tail = message.slice(index + marker.length)
  const end = tail.search(/\s+at\s|\s+Called by client/)
  return (end === -1 ? tail : tail.slice(0, end)).trim()
}

export function CompanionWithdrawalPanel() {
  const payouts = useQuery(api.withdrawals.dashboard, {})
  const listReceivingInstitutions = useAction(api.withdrawals.listReceivingInstitutions)
  const savePayoutMethod = useAction(api.withdrawals.savePayoutMethod)
  const requestWithdrawal = useMutation(api.withdrawals.request)
  const [payoutBusy, setPayoutBusy] = useState(false)
  const [payoutError, setPayoutError] = useState('')
  const [payoutMessage, setPayoutMessage] = useState('')
  const [setupOpen, setSetupOpen] = useState(false)
  const [setup, setSetup] = useState<{ accountName: string; institutions: Array<{ bic: string; name: string }> } | null>(null)
  const [withdrawalDraft, setWithdrawalDraft] = useState<number | null>(null)

  async function openPayoutSetup() {
    setPayoutBusy(true)
    setPayoutError('')
    setPayoutMessage('')
    try {
      const result = await listReceivingInstitutions({})
      setSetup(result)
      setSetupOpen(true)
      setWithdrawalDraft(null)
    } catch (setupError) {
      setPayoutError(friendlyPayoutError(setupError, 'Supported institutions could not be loaded.'))
    } finally {
      setPayoutBusy(false)
    }
  }

  return (
    <section id="withdraw-earnings" className="mb-10" aria-labelledby="withdraw-earnings-title">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 id="withdraw-earnings-title" className="text-h2">Withdraw earnings</h2>
          <p className="text-meta mt-1">Available earnings move to your verified bank or e-wallet account through PayMongo InstaPay.</p>
        </div>
        {payouts?.payoutMethod && (
          <span className="status-pill" data-tone={payouts.payoutMethod.ready ? 'success' : 'warning'}>
            {payouts.payoutMethod.ready ? 'Payout method ready' : 'Security hold'}
          </span>
        )}
      </div>

      <div className="panel p-5 space-y-4 mt-3">
        {payoutError && (
          <div className="notice notice-danger" role="alert">
            <span className="notice-icon">!</span>
            <span>
              {payoutError}
              {payoutError === VERIFY_IDENTITY_MESSAGE && (
                <>
                  {' '}
                  <Link to="/verify-identity" search={{ intent: 'member', returnTo: '/app' }} className="notice-link">
                    Verify identity
                  </Link>
                </>
              )}
            </span>
          </div>
        )}
        {payoutMessage && <div className="notice notice-success" role="status"><span className="notice-icon">✓</span><span>{payoutMessage}</span></div>}
        {payouts === undefined && <p className="text-meta">Loading withdrawal settings…</p>}
        {payouts && !payouts.enabled && <p className="text-meta">Withdrawals are currently disabled by the platform. Your earnings remain recorded and cannot be moved from this screen.</p>}

        {payouts?.enabled && payouts.payoutMethod && !setupOpen && (
          <div className="rounded-lg border border-[color:var(--rule)] p-4">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <p className="text-body"><strong>{payouts.payoutMethod.institutionName}</strong> · •••• {payouts.payoutMethod.accountNumberLast4}</p>
                <p className="text-meta mt-1">Account holder: {payouts.payoutMethod.accountName}</p>
                {!payouts.payoutMethod.ready && !payouts.payoutMethod.modeMismatch && (
                  <p className="text-meta mt-1">Ready {formatManilaDate(payouts.payoutMethod.availableAt)}. This 24-hour hold protects account changes.</p>
                )}
                {payouts.payoutMethod.modeMismatch && <p className="text-meta mt-1 text-[color:var(--danger)]">Replace this payout method for the current PayMongo mode.</p>}
              </div>
              <button
                type="button"
                className="btn btn-self btn-sm"
                disabled={payoutBusy || Boolean(payouts.activeWithdrawalId)}
                onClick={() => void openPayoutSetup()}
              >Replace</button>
            </div>
          </div>
        )}

        {payouts?.enabled && !payouts.payoutMethod && !setupOpen && (
          <div className="rounded-lg border border-[color:var(--rule)] p-4 flex items-center justify-between gap-4 flex-wrap">
            <div><p className="text-body"><strong>Add a payout method</strong></p><p className="text-meta mt-1">Use a bank or e-wallet account under your verified legal name.</p></div>
            <button type="button" className="btn btn-self" disabled={payoutBusy} onClick={() => void openPayoutSetup()}>
              {payoutBusy ? 'Loading banks…' : 'Set up payout method'}
            </button>
          </div>
        )}

        {payouts?.enabled && setupOpen && (
          <form
            className="rounded-lg border border-[color:var(--rule)] p-4 space-y-3"
            onSubmit={async (event) => {
              event.preventDefault()
              const form = new FormData(event.currentTarget)
              const accountNumber = String(form.get('payoutAccountNumber') ?? '')
              const confirmation = String(form.get('payoutAccountNumberConfirmation') ?? '')
              if (accountNumber.replace(/[\s-]/g, '') !== confirmation.replace(/[\s-]/g, '')) {
                setPayoutError('Account numbers do not match.')
                return
              }
              setPayoutBusy(true)
              setPayoutError('')
              setPayoutMessage('')
              try {
                const result = await savePayoutMethod({
                  institutionBic: String(form.get('institutionBic') ?? ''),
                  accountNumber,
                })
                setSetupOpen(false)
                setPayoutMessage(`${result.institutionName} ending in ${result.accountNumberLast4} was saved. Withdrawals unlock after the 24-hour security hold.`)
              } catch (submitError) {
                setPayoutError(friendlyPayoutError(submitError, 'Payout method could not be saved.'))
              } finally {
                setPayoutBusy(false)
              }
            }}
          >
            <div><p className="text-body"><strong>{payouts.payoutMethod ? 'Replace payout method' : 'Set up payout method'}</strong></p><p className="text-meta mt-1">Changing these details starts a new 24-hour security hold.</p></div>
            {!setup && <p className="text-meta">Loading PayMongo’s current InstaPay institutions…</p>}
            {setup && (
              <>
                <label className="field-row">
                  <span className="label">Bank or e-wallet</span>
                  <select name="institutionBic" className="field" required disabled={payoutBusy} defaultValue="">
                    <option value="" disabled>Choose an institution</option>
                    {setup.institutions.map((institution) => <option key={institution.bic} value={institution.bic}>{institution.name}</option>)}
                  </select>
                </label>
                <label className="field-row">
                  <span className="label">Verified account holder</span>
                  <input className="field" value={setup.accountName} readOnly aria-readonly="true" />
                </label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="field-row">
                    <span className="label">Account number</span>
                    <input name="payoutAccountNumber" className="field tabular" inputMode="numeric" autoComplete="off" minLength={8} maxLength={28} required disabled={payoutBusy} />
                  </label>
                  <label className="field-row">
                    <span className="label">Confirm account number</span>
                    <input name="payoutAccountNumberConfirmation" className="field tabular" inputMode="numeric" autoComplete="off" minLength={8} maxLength={28} required disabled={payoutBusy} />
                  </label>
                </div>
              </>
            )}
            <div className="flex gap-2 flex-wrap">
              <button className="btn btn-self" disabled={payoutBusy || !setup}>{payoutBusy ? 'Saving…' : 'Save payout method'}</button>
              <button type="button" className="btn btn-neutral" disabled={payoutBusy} onClick={() => { setSetupOpen(false); setPayoutError('') }}>Cancel</button>
            </div>
          </form>
        )}

        {payouts?.enabled && payouts.payoutMethod?.ready && !payouts.payoutMethod.modeMismatch && !payouts.activeWithdrawalId && !setupOpen && withdrawalDraft === null && (
          <form
            className="flex items-end gap-3 flex-wrap"
            onSubmit={(event) => {
              event.preventDefault()
              const form = new FormData(event.currentTarget)
              const amountCentavos = Math.round(Number(form.get('withdrawalPesos')) * 100)
              if (!Number.isSafeInteger(amountCentavos) || amountCentavos < payouts.minimumCentavos || amountCentavos > Math.min(payouts.maximumCentavos, payouts.availableEarningsCentavos)) {
                setPayoutError(`Enter an amount from ${formatPhp(payouts.minimumCentavos)} to ${formatPhp(Math.min(payouts.maximumCentavos, payouts.availableEarningsCentavos))}.`)
                return
              }
              setPayoutError('')
              setPayoutMessage('')
              setWithdrawalDraft(amountCentavos)
            }}
          >
            <label className="field-row flex-1 min-w-56">
              <span className="label">Withdrawal amount <span className="label-aux">PHP</span></span>
              <input name="withdrawalPesos" type="number" min={payouts.minimumCentavos / 100} max={Math.min(payouts.maximumCentavos, payouts.availableEarningsCentavos) / 100} step="0.01" defaultValue={Math.min(1_000, payouts.availableEarningsCentavos / 100)} required className="field" />
            </label>
            <button className="btn btn-self" disabled={payouts.availableEarningsCentavos < payouts.minimumCentavos}>Review withdrawal</button>
          </form>
        )}

        {payouts?.enabled && payouts.payoutMethod && withdrawalDraft !== null && (
          <div className="rounded-lg border border-[color:var(--accent-self)] p-4 space-y-3" role="group" aria-label="Confirm withdrawal">
            <div><p className="text-body"><strong>Confirm {formatPhp(withdrawalDraft)} withdrawal</strong></p><p className="text-meta mt-1">To {payouts.payoutMethod.institutionName} · •••• {payouts.payoutMethod.accountNumberLast4}</p></div>
            <div className="grid gap-2 sm:grid-cols-2 text-meta">
              <p>You receive: <strong className="tabular text-[color:var(--text)]">{formatPhp(withdrawalDraft)}</strong></p>
              <p>Transfer fee: <strong className="text-[color:var(--text)]">Paid by platform</strong></p>
            </div>
            <p className="text-meta">InstaPay usually arrives within minutes. Allow up to 20 minutes for final status. Submitted transfers cannot be cancelled.</p>
            <div className="flex gap-2 flex-wrap">
              <button
                type="button"
                className="btn btn-self"
                disabled={payoutBusy}
                onClick={async () => {
                  setPayoutBusy(true)
                  setPayoutError('')
                  try {
                    await requestWithdrawal({ amountCentavos: withdrawalDraft })
                    setPayoutMessage(`${formatPhp(withdrawalDraft)} is now in transfer. Track its final status below.`)
                    setWithdrawalDraft(null)
                  } catch (submitError) {
                    setPayoutError(friendlyPayoutError(submitError, 'Withdrawal could not be requested.'))
                  } finally {
                    setPayoutBusy(false)
                  }
                }}
              >{payoutBusy ? 'Submitting…' : 'Confirm withdrawal'}</button>
              <button type="button" className="btn btn-neutral" disabled={payoutBusy} onClick={() => setWithdrawalDraft(null)}>Go back</button>
            </div>
          </div>
        )}

        {payouts?.activeWithdrawalId && <p className="text-meta">One withdrawal is already in progress. A new withdrawal becomes available after it reaches a final status.</p>}

        {payouts && payouts.withdrawals.length > 0 && (
          <div>
            <p className="text-body"><strong>Withdrawal history</strong></p>
            <div className="mt-2 divide-y divide-[color:var(--rule)]">
              {payouts.withdrawals.slice(0, 8).map((withdrawal) => (
                <div key={withdrawal.id} className="py-3 flex items-start justify-between gap-4">
                  <div><p className="text-body tabular">{formatPhp(withdrawal.amountCentavos)}</p><p className="text-meta mt-1">{withdrawal.institutionName} · •••• {withdrawal.accountNumberLast4} · {formatManilaDate(withdrawal.createdAt)}</p></div>
                  <span className="status-pill" data-tone={withdrawalTone(withdrawal.status)}>{withdrawalStatusLabel(withdrawal.status)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}

function withdrawalTone(status: PayoutDashboard['withdrawals'][number]['status']): 'self' | 'success' | 'warning' | 'danger' {
  if (status === 'succeeded') return 'success'
  if (status === 'failed') return 'danger'
  if (status === 'needs_review') return 'warning'
  return 'self'
}

function withdrawalStatusLabel(status: PayoutDashboard['withdrawals'][number]['status']) {
  if (status === 'queued') return 'Queued'
  if (status === 'submitting') return 'Submitting'
  if (status === 'pending') return 'In transfer'
  if (status === 'succeeded') return 'Received'
  if (status === 'failed') return 'Returned'
  return 'Needs review'
}

function formatManilaDate(timestamp: number) {
  return new Intl.DateTimeFormat('en-PH', {
    timeZone: 'Asia/Manila',
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(timestamp)
}
