import { formatPhp } from '@lets-be-friends/shared'
import type { FunctionReturnType } from 'convex/server'
import { useAction, useQuery } from 'convex/react'
import { router, type ErrorBoundaryProps } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import { Image, StyleSheet, TextInput, View } from 'react-native'

import { mobileApi, type PaymongoTopUpId } from '@/backend/client'
import { ActionButton } from '@/components/ActionButton'
import { Screen } from '@/components/Screen'
import { AppText } from '@/components/Typography'
import {
  formatQrExpiry,
  formatWalletTimestamp,
  isUnambiguousTopUpCreationError,
  parseWalletAmount,
  topUpPresentation,
  walletBalanceRows,
  type WalletTopUpStatus,
} from '@/data/wallet'
import { useMobileMember } from '@/member/MobileMember'
import { useAppTheme } from '@/theme/ThemeProvider'

type Wallet = NonNullable<FunctionReturnType<typeof mobileApi.finance.memberDashboard>>
type TopUp = Wallet['topUps'][number]

export default function WalletScreen() {
  const member = useMobileMember()
  if (member.status === 'signed_out') return <WalletState title="Sign in to view your booking wallet" action="Sign in" onPress={() => router.replace('/auth')} />
  if (member.status === 'unconfigured') return <WalletState title="Booking wallet needs account services" action="Return to Profile" onPress={() => router.replace('/profile')} />
  if (member.status === 'unavailable' || member.status === 'error') return <WalletState title="Booking wallet is unavailable" detail="Your member account could not be connected safely." />
  if (member.status !== 'ready') return <WalletState title="Loading booking wallet" />
  return <ReadyWalletScreen />
}

function ReadyWalletScreen() {
  const wallet = useQuery(mobileApi.finance.memberDashboard, {})
  if (wallet === undefined) return <WalletState title="Loading booking wallet" />
  if (wallet === null) return <WalletState title="Booking wallet is unavailable" detail="Your wallet could not be connected safely." />
  return <WalletView wallet={wallet} />
}

function WalletView({ wallet }: { wallet: Wallet }) {
  const theme = useAppTheme()
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
    <Screen contentStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.header}>
        <AppText variant="label" color={theme.colors.self}>BOOKING WALLET</AppText>
        <AppText variant="title">Your booking balance</AppText>
        <AppText color={theme.colors.textMuted}>Use available balance for booking requests. Reserved and pending money is not available for a new request.</AppText>
      </View>

      {!wallet.enabled ? (
        <View style={[styles.notice, { backgroundColor: theme.colors.socialSoft, borderColor: theme.colors.social }]}>
          <AppText variant="bodyStrong">New wallet top-ups are unavailable</AppText>
          <AppText variant="caption" color={theme.colors.textMuted}>Existing balances and top-up history remain visible.</AppText>
        </View>
      ) : null}

      <View style={styles.metrics}>
        {walletBalanceRows(wallet).map((row) => (
          <View key={row.key} style={[styles.metric, { backgroundColor: row.key === 'available' ? theme.colors.selfSoft : theme.colors.surface, borderColor: row.key === 'available' ? theme.colors.self : theme.colors.border }]}>
            <AppText variant="caption" color={theme.colors.textMuted}>{row.label}</AppText>
            <AppText variant="heading">{row.value}</AppText>
          </View>
        ))}
      </View>

      <View style={[styles.panel, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
        <View style={styles.copy}>
          <AppText variant="heading">Add balance with QR Ph</AppText>
          <AppText variant="caption" color={theme.colors.textMuted}>Enter PHP 100 to PHP 100,000. Only a provider-confirmed paid intent credits this wallet.</AppText>
        </View>
        <TextInput
          accessibilityLabel="Top-up amount in PHP"
          value={amount}
          onChangeText={(value) => { setAmount(value); setMessage('') }}
          placeholder="1000.00"
          placeholderTextColor={theme.colors.textMuted}
          inputMode="decimal"
          editable={!busy && !activeTopUp && !waitingForCreatedTopUp && wallet.enabled}
          style={[styles.input, theme.typography.body, { color: theme.colors.text, backgroundColor: theme.colors.surfaceRaised, borderColor: theme.colors.border }]}
        />
        <ActionButton
          label={busy === 'create' ? 'Creating QR Ph top-up' : activeTopUp || waitingForCreatedTopUp ? 'A QR attempt is still active' : 'Create QR Ph top-up'}
          onPress={() => void create()}
          intent="self"
          disabled={busy !== null || Boolean(activeTopUp) || waitingForCreatedTopUp || !wallet.enabled}
        />
      </View>

      {displayTopUp ? <CurrentTopUp topUp={displayTopUp} now={clockNow} busy={busy === String(displayTopUp._id)} onRefresh={() => void refresh(displayTopUp._id as PaymongoTopUpId)} /> : null}
      {message ? <AppText accessibilityLiveRegion="polite" color={theme.colors.textMuted}>{message}</AppText> : null}

      <View style={styles.history}>
        <AppText variant="heading">Recent top-ups</AppText>
        {wallet.topUps.length === 0 ? <AppText color={theme.colors.textMuted}>No member-wallet top-ups yet.</AppText> : wallet.topUps.map((topUp) => <TopUpRow key={String(topUp._id)} topUp={topUp} now={clockNow} />)}
      </View>
      <ActionButton label="Return to Profile" onPress={() => router.replace('/profile')} secondary intent="self" />
    </Screen>
  )
}

function CurrentTopUp({ topUp, now, busy, onRefresh }: { topUp: TopUp; now: number; busy: boolean; onRefresh: () => void }) {
  const theme = useAppTheme()
  const presentation = topUpPresentation(topUp.status, topUp.expiresAt, now)
  return (
    <View style={[styles.panel, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
      <View style={styles.currentHeader}>
        <View style={styles.copy}>
          <AppText variant="heading">Current QR attempt</AppText>
          <AppText variant="bodyStrong">{formatPhp(topUp.amountCentavos)}</AppText>
        </View>
        <View style={[styles.status, { backgroundColor: presentation.payable ? theme.colors.socialSoft : theme.colors.selfSoft }]}>
          <AppText variant="caption" color={presentation.payable ? theme.colors.social : theme.colors.self}>{presentation.label}</AppText>
        </View>
      </View>
      <AppText variant="caption" color={theme.colors.textMuted}>{presentation.detail}</AppText>
      {topUp.status === 'awaiting_payment' && topUp.expiresAt !== undefined ? <AppText variant="caption" color={theme.colors.textMuted}>{formatQrExpiry(topUp.expiresAt, now)}</AppText> : null}
      {presentation.payable && topUp.qrImageUrl ? (
        <Image accessibilityLabel={`QR Ph code for ${formatPhp(topUp.amountCentavos)} top-up`} source={{ uri: topUp.qrImageUrl }} resizeMode="contain" style={styles.qr} />
      ) : null}
      {topUp.providerIntentId && presentation.active ? <ActionButton label={busy ? 'Refreshing provider status' : 'Refresh provider status'} onPress={onRefresh} disabled={busy} secondary intent="self" /> : null}
    </View>
  )
}

function TopUpRow({ topUp, now }: { topUp: TopUp; now: number }) {
  const theme = useAppTheme()
  const presentation = topUpPresentation(topUp.status, topUp.expiresAt, now)
  return (
    <View style={[styles.row, { borderColor: theme.colors.border }]}>
      <View style={styles.rowCopy}>
        <AppText variant="bodyStrong">{formatPhp(topUp.amountCentavos)}</AppText>
        <AppText variant="caption" color={theme.colors.textMuted}>{formatWalletTimestamp(topUp.createdAt)}</AppText>
      </View>
      <AppText variant="caption" color={presentation.payable ? theme.colors.social : theme.colors.textMuted}>{presentation.label}</AppText>
    </View>
  )
}

function WalletState({ title, detail, action, onPress }: { title: string; detail?: string; action?: string; onPress?: () => void }) {
  const theme = useAppTheme()
  return <Screen contentStyle={styles.state}><AppText variant="label" color={theme.colors.self}>BOOKING WALLET</AppText><AppText variant="title">{title}</AppText>{detail ? <AppText color={theme.colors.textMuted}>{detail}</AppText> : null}{action && onPress ? <ActionButton label={action} onPress={onPress} secondary intent="self" /> : null}</Screen>
}

export function ErrorBoundary({ retry }: ErrorBoundaryProps) {
  return <WalletState title="Booking wallet is temporarily unavailable" detail="Reload and check the displayed balance and recent top-up status before starting another attempt." action="Try again" onPress={retry} />
}

const styles = StyleSheet.create({
  content: { paddingTop: 24, paddingBottom: 64, gap: 18 },
  state: { flexGrow: 1, justifyContent: 'center', gap: 16 },
  header: { gap: 7 },
  notice: { borderWidth: 1, borderRadius: 18, padding: 16, gap: 4 },
  metrics: { gap: 10 },
  metric: { borderWidth: 1, borderRadius: 18, padding: 16, gap: 4 },
  panel: { borderWidth: 1, borderRadius: 20, padding: 16, gap: 12 },
  copy: { flex: 1, gap: 4 },
  input: { minHeight: 52, borderWidth: 1, borderRadius: 16, paddingHorizontal: 16 },
  currentHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  status: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  qr: { width: '100%', aspectRatio: 1, borderRadius: 16, backgroundColor: '#FFFFFF' },
  history: { gap: 10 },
  row: { borderBottomWidth: 1, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 14 },
  rowCopy: { flex: 1, gap: 2 },
})
