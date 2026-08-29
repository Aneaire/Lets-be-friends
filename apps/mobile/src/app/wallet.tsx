import { formatPhp } from '@lets-be-friends/shared'
import type { FunctionReturnType } from 'convex/server'
import { useAction, useQuery } from 'convex/react'
import { router, type ErrorBoundaryProps } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import { StyleSheet } from 'react-native'

import { mobileApi, type PaymongoTopUpId } from '@/backend/client'
import { ActionButton } from '@/design-system/atoms/ActionButton'
import { Screen } from '@/design-system/templates/Screen'
import { PageSkeleton } from '@/design-system/templates/PageSkeleton'
import { AppText } from '@/design-system/atoms/Typography'
import {
  formatQrExpiry,
  formatWalletTimestamp,
  isUnambiguousTopUpCreationError,
  parseWalletAmount,
  topUpPresentation,
  walletBalanceRows,
} from '@/data/wallet'
import {
  WalletPresentation,
  type WalletTopUpItem,
} from '@/features/finance/WalletPresentation'
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
  if (wallet === undefined) return <PageSkeleton variant="wallet" />
  if (wallet === null) return <WalletState title="Booking wallet is unavailable" detail="Your wallet could not be connected safely." />
  return <WalletView wallet={wallet} />
}

function WalletView({ wallet }: { wallet: Wallet }) {
  const createTopUp = useAction(mobileApi.paymongo.createMemberTopUp)
  const refreshTopUp = useAction(mobileApi.paymongo.refreshMemberTopUp)
  const [amount, setAmount] = useState('1000')
  const [busy, setBusy] = useState<'create' | string | null>(null)
  const [message, setMessage] = useState('')
  const [pendingCreatedTopUpId, setPendingCreatedTopUpId] = useState<string | null>(null)
  const [clockNow, setClockNow] = useState(() => Date.now())
  const busyRef = useRef(false)
  const activeTopUp = wallet.topUps.find((topUp) => topUpPresentation(topUp.status, topUp.expiresAt, clockNow).active)
  const displayTopUp = activeTopUp ?? wallet.topUps.find((topUp) => topUp.qrImageUrl && topUp.status !== 'paid')
  const waitingForCreatedTopUp = pendingCreatedTopUpId !== null

  useEffect(() => {
    const timer = setInterval(() => setClockNow(Date.now()), 30_000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    if (pendingCreatedTopUpId && wallet.topUps.some((topUp) => String(topUp._id) === pendingCreatedTopUpId)) {
      setPendingCreatedTopUpId(null)
    }
  }, [pendingCreatedTopUpId, wallet.topUps])

  async function create() {
    if (busyRef.current || activeTopUp || waitingForCreatedTopUp || !wallet.enabled) return
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
    } catch (error) {
      if (isUnambiguousTopUpCreationError(error)) {
        setPendingCreatedTopUpId(null)
        setMessage('The QR Ph top-up could not be started. Review the amount and current wallet status before trying again.')
      } else {
        setPendingCreatedTopUpId('unconfirmed')
        setMessage('The top-up result could not be confirmed. Refresh or reload this screen and check recent top-ups before starting another attempt.')
      }
    } finally {
      busyRef.current = false
      setBusy(null)
    }
  }

  async function refresh(topUpId: PaymongoTopUpId) {
    if (busyRef.current) return
    busyRef.current = true
    setBusy(String(topUpId))
    setMessage('')
    try {
      const result = await refreshTopUp({ topUpId })
      const providerStatus = result.providerStatus.toLowerCase()
      setMessage(['succeeded', 'paid'].includes(providerStatus)
        ? 'Refresh requested. Check the refreshed available balance and recent top-up status for the recorded result.'
        : ['failed', 'cancelled', 'expired'].includes(providerStatus)
          ? 'Refresh requested. The provider returned a terminal unpaid status. Check recent top-ups for the recorded result.'
          : 'Refresh requested. Check the refreshed balance and recent top-up status for the latest result.')
    } catch {
      setMessage('The provider refresh could not be confirmed. Reload this screen and rely on the balance and recent top-up status shown there.')
    } finally {
      busyRef.current = false
      setBusy(null)
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
      createLabel={activeTopUp || waitingForCreatedTopUp
        ? 'A QR attempt is still active'
        : 'Create QR Ph top-up'}
      createDisabled={busy !== null || Boolean(activeTopUp) || waitingForCreatedTopUp || !wallet.enabled}
      createBusy={busy === 'create'}
      onCreate={() => void create()}
      currentTopUp={displayTopUp ? walletTopUpItem(displayTopUp, clockNow) : undefined}
      refreshBusy={Boolean(displayTopUp && busy === String(displayTopUp._id))}
      onRefresh={() => {
        if (displayTopUp) void refresh(displayTopUp._id as PaymongoTopUpId)
      }}
      message={message}
      topUps={wallet.topUps.map((topUp) => walletTopUpItem(topUp, clockNow))}
      onReturn={() => router.replace('/profile')}
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
    canRefresh: Boolean(topUp.providerIntentId && presentation.active),
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
