import { useState } from 'react'
import { Image, Pressable, StyleSheet, TextInput, View } from 'react-native'

import { ActionButton } from '@/design-system/atoms/ActionButton'
import { Skeleton } from '@/design-system/atoms/Skeleton'
import { AppText } from '@/design-system/atoms/Typography'
import { Screen } from '@/design-system/templates/Screen'
import type { WalletActivityRow } from '@/data/walletActivity'
import { useAppTheme } from '@/theme/ThemeProvider'
import { density } from '@/theme/tokens'
import { WalletActivityList } from './WalletActivityList'

export type WalletBalanceItem = {
  key: 'available' | 'reserved' | 'pending'
  label: string
  value: string
}

export type WalletTopUpItem = {
  id: string
  amountLabel: string
  createdLabel: string
  statusLabel: string
  detail: string
  active: boolean
  payable: boolean
  expiryLabel?: string
  qrImageUrl?: string
}

export function WalletPresentation({
  enabled,
  balances,
  amount,
  onAmountChange,
  createLabel,
  createDisabled,
  createBusy = false,
  onCreate,
  currentTopUp,
  amountEditable = true,
  qrPreparing = false,
  saveQrBusy = false,
  onSaveQr,
  message,
  activity,
  activityLoading = false,
  onOpenBooking,
  onOpenTransactions,
  onReturn,
  onOpenWithdrawals,
}: {
  enabled: boolean
  balances: readonly WalletBalanceItem[]
  amount: string
  onAmountChange: (value: string) => void
  createLabel: string
  createDisabled: boolean
  createBusy?: boolean
  onCreate: () => void
  currentTopUp?: WalletTopUpItem
  amountEditable?: boolean
  qrPreparing?: boolean
  saveQrBusy?: boolean
  onSaveQr: (qrImageUrl: string) => void
  message?: string
  activity: readonly WalletActivityRow[]
  activityLoading?: boolean
  onOpenBooking?: (bookingId: string) => void
  onOpenTransactions?: () => void
  onReturn: () => void
  onOpenWithdrawals: () => void
}) {
  const theme = useAppTheme()

  return (
    <Screen contentStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.header}>
        <AppText variant="label" color={theme.colors.selfText}>WALLET</AppText>
        <AppText variant="title">Your wallet balance</AppText>
        <AppText color={theme.colors.textMuted}>
          Use available funds for bookings or withdraw them. Reserved and pending money stays locked.
        </AppText>
      </View>

      {!enabled ? (
        <View style={[styles.notice, { backgroundColor: theme.colors.selfSoft, borderColor: theme.colors.selfText }]}>
          <AppText variant="bodyStrong">New wallet top-ups are unavailable</AppText>
          <AppText variant="caption" color={theme.colors.textMuted}>
            Existing balances and top-up history remain visible.
          </AppText>
        </View>
      ) : null}

      <View style={styles.metrics}>
        {balances.map((balance) => (
          <View
            key={balance.key}
            style={[
              styles.metric,
              {
                backgroundColor: balance.key === 'available'
                  ? theme.colors.selfSoft
                  : theme.colors.background,
                borderColor: balance.key === 'available'
                  ? theme.colors.selfText
                  : theme.colors.border,
              },
            ]}>
            <AppText variant="caption" color={theme.colors.textMuted}>{balance.label}</AppText>
            <AppText variant="heading">{balance.value}</AppText>
          </View>
        ))}
      </View>

      <View style={[styles.section, { borderTopColor: theme.colors.border }]}>
        <View style={styles.copy}>
          <AppText variant="heading">Add balance with QR Ph</AppText>
          <AppText variant="caption" color={theme.colors.textMuted}>
            Enter PHP 1 to PHP 100,000. Only a provider-confirmed paid intent credits this wallet.
          </AppText>
        </View>
        <TextInput
          accessibilityLabel="Top-up amount in PHP"
          value={amount}
          onChangeText={onAmountChange}
          placeholder="1000.00"
          placeholderTextColor={theme.colors.textMuted}
          inputMode="decimal"
          editable={amountEditable && enabled && !createBusy}
          style={[
            styles.input,
            theme.typography.body,
            {
              color: theme.colors.text,
              backgroundColor: theme.colors.surfaceRaised,
              borderColor: theme.colors.border,
            },
          ]}
        />
        <ActionButton
          label={createLabel}
          onPress={onCreate}
          intent="self"
          disabled={createDisabled}
          loading={createBusy}
        />
      </View>

      {qrPreparing ? <QrLoading /> : currentTopUp ? (
        <View style={[styles.section, { borderTopColor: theme.colors.border }]}>
          <View style={styles.currentHeader}>
            <View style={styles.copy}>
              <AppText variant="heading">Current QR attempt</AppText>
              <AppText variant="bodyStrong">{currentTopUp.amountLabel}</AppText>
            </View>
            <View style={[
              styles.status,
              { backgroundColor: currentTopUp.payable ? theme.colors.socialSoft : theme.colors.selfSoft },
            ]}>
              <AppText
                variant="caption"
                color={currentTopUp.payable ? theme.colors.socialText : theme.colors.selfText}>
                {currentTopUp.statusLabel}
              </AppText>
            </View>
          </View>
          <AppText variant="caption" color={theme.colors.textMuted}>{currentTopUp.detail}</AppText>
          {currentTopUp.expiryLabel ? (
            <AppText variant="caption" color={theme.colors.textMuted}>{currentTopUp.expiryLabel}</AppText>
          ) : null}
          {currentTopUp.payable && currentTopUp.qrImageUrl ? (
            <WalletQrImage key={`${currentTopUp.id}:${currentTopUp.qrImageUrl}`} imageUrl={currentTopUp.qrImageUrl} amountLabel={currentTopUp.amountLabel} saving={saveQrBusy} onSave={() => onSaveQr(currentTopUp.qrImageUrl!)} />
          ) : currentTopUp.active && currentTopUp.statusLabel === 'Preparing QR' ? <QrLoading /> : null}

        </View>
      ) : null}

      {message ? (
        <AppText
          accessibilityLiveRegion="polite"
          color={theme.colors.textMuted}>
          {message}
        </AppText>
      ) : null}

      <View style={styles.history}>
        <View style={styles.historyHeader}>
          <View style={styles.copy}>
            <AppText variant="heading">Recent transactions</AppText>
            <AppText variant="caption" color={theme.colors.textMuted}>
              Holds, payments, top-ups, and refunds from your wallet.
            </AppText>
          </View>
          {!activityLoading && activity.length > 0 && onOpenTransactions ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="View more transactions"
              onPress={onOpenTransactions}
              style={({ pressed }) => [styles.viewMore, pressed && styles.pressed]}>
              <AppText variant="label" color={theme.colors.socialText}>VIEW MORE</AppText>
            </Pressable>
          ) : null}
        </View>
        {activityLoading
          ? <AppText
              variant="caption"
              color={theme.colors.textMuted}
              accessibilityLiveRegion="polite">
              Loading transactions
            </AppText>
          : (
              <WalletActivityList
                rows={activity}
                onOpenBooking={onOpenBooking}
              />
            )}
      </View>
      <ActionButton label="Withdraw funds" onPress={onOpenWithdrawals} intent="self" />
      <ActionButton label="Return to Profile" onPress={onReturn} secondary intent="self" />
    </Screen>
  )
}

function QrLoading() {
  return <View accessibilityLabel="Preparing QR code" accessibilityLiveRegion="polite" style={styles.qrLoading}>
    <AppText variant="caption">Preparing your QR code...</AppText>
    <Skeleton style={{ width: '100%', aspectRatio: 1, height: undefined }} radius={14} />
  </View>
}

export function WalletQrImage({ imageUrl, amountLabel, saving, onSave }: { imageUrl: string; amountLabel: string; saving: boolean; onSave: () => void }) {
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [attempt, setAttempt] = useState(0)
  return <View style={styles.qrLoading}>
    <View style={styles.qrFrame}>
      {state === 'loading' ? <View accessibilityLabel="Loading QR image" style={StyleSheet.absoluteFill}><Skeleton style={{ width: '100%', aspectRatio: 1, height: undefined }} radius={14} /></View> : null}
      <Image key={attempt} accessibilityLabel={`QR Ph code for ${amountLabel} top-up`} source={{ uri: imageUrl }} resizeMode="contain" onLoad={() => setState('ready')} onError={() => setState('error')} style={[styles.qr, state !== 'ready' && { opacity: 0 }]} />
    </View>
    {state === 'error' ? <><AppText>The QR image could not be loaded.</AppText><ActionButton label="Retry image" onPress={() => { setState('loading'); setAttempt((value) => value + 1) }} secondary intent="self" /></> : null}
    <ActionButton label="Save QR" icon="download-outline" onPress={onSave} disabled={state !== 'ready'} loading={saving} secondary intent="self" />
  </View>
}

const styles = StyleSheet.create({
  content: { paddingTop: density.contentGap, paddingBottom: density.screenBottom, gap: density.contentGap },
  header: { gap: density.textSectionGap },
  notice: { borderWidth: 1, borderRadius: 14, padding: density.cardPadding, gap: density.textStackGap },
  metrics: { gap: density.cardGap },
  metric: { borderLeftWidth: 3, paddingVertical: density.cardGap, paddingHorizontal: density.cardPadding, gap: density.textStackGap },
  section: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: density.contentGap, gap: density.cardGap },
  copy: { flex: 1, gap: density.textStackGap },
  input: { minHeight: density.controlHeight, borderWidth: 1, borderRadius: density.controlRadius, paddingHorizontal: density.screenGutter },
  currentHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: density.compactCardPadding },
  status: { borderRadius: 999, paddingHorizontal: density.cardGap, paddingVertical: density.textPairGap },
  qr: { width: '100%', aspectRatio: 1, borderRadius: 14, backgroundColor: '#FFFFFF' },
  qrLoading: { gap: density.cardGap },
  qrFrame: { width: '100%', aspectRatio: 1 },
  history: { gap: density.cardGap },
  historyHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: density.cardGap },
  viewMore: { minHeight: 44, justifyContent: 'center', alignItems: 'center', paddingHorizontal: density.cardGap },
  pressed: { opacity: 0.7 },
})
