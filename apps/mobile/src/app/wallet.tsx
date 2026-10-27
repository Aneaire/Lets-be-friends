import { formatPhp } from '@lets-be-friends/shared'
import type { FunctionReturnType } from 'convex/server'
import { useAction, useQuery } from 'convex/react'
import { router, type ErrorBoundaryProps } from 'expo-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import { AppState, StyleSheet } from 'react-native'

import { mobileApi, type PaymongoTopUpId } from '@/backend/client'
import { ActionButton } from '@/design-system/atoms/ActionButton'
import { Screen } from '@/design-system/templates/Screen'
import { PageSkeleton } from '@/design-system/templates/PageSkeleton'
import { AppText } from '@/design-system/atoms/Typography'
import {
  formatQrExpiry,
  formatWalletTimestamp,
  parseWalletAmount,
  saveQrImageMessage,
  topUpPresentation,
  walletBalanceRows,
  walletTopUpCreationState,
} from '@/data/wallet'
import { transactionsActivityState, transactionsPreviewRows, TRANSACTIONS_ROUTE } from '@/features/finance/transactions'
import {
  WalletPresentation,
  type WalletTopUpItem,
} from '@/features/finance/WalletPresentation'
import { useTopUpReconciliation } from '@/features/finance/useTopUpReconciliation'
import { saveQrImageToPhotos } from '@/features/finance/saveQrImage'
import { useMobileMember } from '@/member/MobileMember'
import { useAppTheme } from '@/theme/ThemeProvider'

type Wallet = NonNullable<FunctionReturnType<typeof mobileApi.finance.memberDashboard>>
type TopUp = Wallet['topUps'][number]

export default function WalletScreen() {
  const member = useMobileMember()
  if (member.status === 'signed_out') return <WalletState title="Sign in to view your booking wallet" action="Sign in" onPress={() => router.replace('/auth')} />
  if (member.status === 'unconfigured') return <WalletState title="Booking wallet needs account services" action="Return to Profile" onPress={() => router.replace('/profile')} />
  if (member.status === 'unavailable' || member.status === 'error') return <WalletState title="Booking wallet is unavailable" detail="Your member account could not be connected safely." />
  if (member.status !== 'ready') return <PageSkeleton variant="wallet" />
  return <ReadyWalletScreen />
}

function ReadyWalletScreen() {
  const wallet = useQuery(mobileApi.finance.memberDashboard, {})
  const bookingTransactions = useQuery(mobileApi.finance.memberBookingTransactions, { limit: 50 })
  const topUps = useQuery(mobileApi.finance.memberTopUps, { limit: 50 })
  if (wallet === undefined) return <PageSkeleton variant="wallet" />
  if (wallet === null) return <WalletState title="Booking wallet is unavailable" detail="Your wallet could not be connected safely." />
  return (
    <WalletView
      wallet={wallet}
      bookingTransactions={bookingTransactions}
      topUps={topUps}
    />
  )
}

function WalletView({
  wallet,
  bookingTransactions,
  topUps,
}: {
  wallet: Wallet
  bookingTransactions: FunctionReturnType<typeof mobileApi.finance.memberBookingTransactions> | undefined
  topUps: FunctionReturnType<typeof mobileApi.finance.memberTopUps> | undefined
}) {
  const createTopUp = useAction(mobileApi.paymongo.createMemberTopUp)
  const refreshTopUp = useAction(mobileApi.paymongo.refreshMemberTopUp)
  const reconcile = useCallback((topUpId: string) => refreshTopUp({ topUpId: topUpId as PaymongoTopUpId }), [refreshTopUp])
  const unresolvedTopUp = wallet.topUps.find((topUp) => topUp.providerIntentId && ['awaiting_payment', 'processing'].includes(topUp.status))
  useTopUpReconciliation(unresolvedTopUp ? String(unresolvedTopUp._id) : undefined, reconcile)
  const [amount, setAmount] = useState(() => {
    const current = wallet.topUps.find((topUp) => topUpPresentation(topUp.status, topUp.expiresAt).active)
    return current ? String(current.amountCentavos / 100) : '1000'
  })
  const [busy, setBusy] = useState<'create' | string | null>(null)
  const [savingQr, setSavingQr] = useState(false)
  const [message, setMessage] = useState('')
  const [pendingCreatedTopUpId, setPendingCreatedTopUpId] = useState<string | null>(null)
  const [clockNow, setClockNow] = useState(() => Date.now())
  const busyRef = useRef(false)
  const activeTopUp = wallet.topUps.find((topUp) => topUpPresentation(topUp.status, topUp.expiresAt, clockNow).active)
  const displayTopUp = activeTopUp ?? wallet.topUps[0]
  const waitingForCreatedTopUp = pendingCreatedTopUpId !== null
  const creation = walletTopUpCreationState({ amount, activeTopUp, busy: busy !== null, waiting: waitingForCreatedTopUp, enabled: wallet.enabled })
  const activityState = transactionsActivityState({ bookingTransactions, topUps, now: clockNow })
  const activity = activityState.state === 'ready' ? transactionsPreviewRows(activityState.rows) : []
  const activityLoading = activityState.state === 'loading'

  useEffect(() => {
    const timer = setInterval(() => setClockNow(Date.now()), 30_000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    if (pendingCreatedTopUpId && wallet.topUps.some((topUp) => String(topUp._id) === pendingCreatedTopUpId)) {
      setPendingCreatedTopUpId(null)
    }
  }, [pendingCreatedTopUpId, wallet.topUps])

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => { if (state === 'active') setClockNow(Date.now()) })
    const nextExpiry = wallet.topUps.filter((topUp) => topUp.status === 'awaiting_payment' && topUp.expiresAt !== undefined && topUp.expiresAt > clockNow).map((topUp) => topUp.expiresAt!)
    const timer = nextExpiry.length ? setTimeout(() => setClockNow(Date.now()), Math.max(0, Math.min(...nextExpiry) - Date.now()) + 25) : undefined
    return () => { subscription.remove(); if (timer !== undefined) clearTimeout(timer) }
  }, [wallet.topUps, clockNow])

  async function create() {
    if (busyRef.current || creation.disabled) return
    const validation = parseWalletAmount(amount)
    if (!validation.ok) {
      setMessage(validation.message)
      return
    }
    busyRef.current = true
    setBusy('create')
    setMessage('')
    try {
      const result = await createTopUp({ amountCentavos: validation.amountCentavos })
      setPendingCreatedTopUpId(String(result.topUpId))
      setMessage(result.qrImageUrl
        ? `QR Ph top-up for ${formatPhp(result.amountCentavos)} is ready to scan.`
        : 'PayMongo is confirming the QR Ph setup. Your wallet will update only after provider confirmation.')
    } catch {
      setPendingCreatedTopUpId(null)
      setMessage('The QR could not be prepared. Check recent top-ups before trying again.')
    } finally {
      busyRef.current = false
      setBusy(null)
    }
  }

  async function saveQr(qrImageUrl: string) {
    if (!displayTopUp || savingQr) return
    setSavingQr(true)
    setMessage('')
    try {
      const result = await saveQrImageToPhotos(qrImageUrl, String(displayTopUp._id))
      setMessage(saveQrImageMessage(result))
    } catch {
      setMessage(saveQrImageMessage({ ok: false, reason: 'unavailable' }))
    } finally {
      setSavingQr(false)
    }
  }

  return (
    <WalletPresentation
      enabled={wallet.enabled}
      balances={walletBalanceRows(wallet)}
      amount={amount}
      onAmountChange={(value) => {
        setAmount(value)
        setMessage('')
      }}
      createLabel={creation.label}
      createDisabled={creation.disabled}
      amountEditable={creation.editable}
      createBusy={busy === 'create'}
      qrPreparing={busy === 'create' || waitingForCreatedTopUp || displayTopUp?.status === 'creating' || Boolean(displayTopUp?.status === 'awaiting_payment' && !displayTopUp.qrImageUrl)}
      onCreate={() => void create()}
      currentTopUp={displayTopUp ? walletTopUpItem(displayTopUp, clockNow) : undefined}
      saveQrBusy={savingQr}
      onSaveQr={(qrImageUrl) => void saveQr(qrImageUrl)}
      message={message}
      activity={activity}
      activityLoading={activityLoading}
      onOpenBooking={(bookingId) => router.push(`/booking/${bookingId}` as never)}
      onOpenTransactions={() => router.push(TRANSACTIONS_ROUTE as never)}
      onReturn={() => router.replace('/profile')}
      onOpenWithdrawals={() => router.push('/companion-finance')}
    />
  )
}

function walletTopUpItem(topUp: TopUp, now: number): WalletTopUpItem {
  const presentation = topUpPresentation(topUp.status, topUp.expiresAt, now)
  return {
    id: String(topUp._id),
    amountLabel: formatPhp(topUp.amountCentavos),
    createdLabel: formatWalletTimestamp(topUp.createdAt),
    statusLabel: presentation.label,
    detail: presentation.detail,
    active: presentation.active,
    payable: presentation.payable,
    expiryLabel: topUp.status === 'awaiting_payment' && topUp.expiresAt !== undefined
      ? formatQrExpiry(topUp.expiresAt, now)
      : undefined,
    qrImageUrl: topUp.qrImageUrl ?? undefined,
  }
}

function WalletState({ title, detail, action, onPress }: { title: string; detail?: string; action?: string; onPress?: () => void }) {
  const theme = useAppTheme()
  return <Screen contentStyle={styles.state}><AppText variant="label" color={theme.colors.self}>BOOKING WALLET</AppText><AppText variant="title">{title}</AppText>{detail ? <AppText color={theme.colors.textMuted}>{detail}</AppText> : null}{action && onPress ? <ActionButton label={action} onPress={onPress} secondary intent="self" /> : null}</Screen>
}

export function ErrorBoundary({ retry }: ErrorBoundaryProps) {
  return <WalletState title="Booking wallet is temporarily unavailable" detail="Reload and check the displayed balance and recent top-up status before starting another attempt." action="Try again" onPress={retry} />
}

const styles = StyleSheet.create({
  state: { flexGrow: 1, justifyContent: 'center', gap: 16 },
})
