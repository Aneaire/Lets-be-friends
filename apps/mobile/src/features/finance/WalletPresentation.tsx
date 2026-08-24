import { Image, StyleSheet, TextInput, View } from 'react-native'

import { ActionButton } from '@/design-system/atoms/ActionButton'
import { AppText } from '@/design-system/atoms/Typography'
import { Screen } from '@/design-system/templates/Screen'
import { useAppTheme } from '@/theme/ThemeProvider'
import { density } from '@/theme/tokens'

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
  canRefresh: boolean
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
  refreshBusy = false,
  onRefresh,
  message,
  topUps,
  onReturn,
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
  refreshBusy?: boolean
  onRefresh: () => void
  message?: string
  topUps: readonly WalletTopUpItem[]
  onReturn: () => void
}) {
  const theme = useAppTheme()

  return (
    <Screen contentStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.header}>
        <AppText variant="label" color={theme.colors.selfText}>BOOKING WALLET</AppText>
        <AppText variant="title">Your booking balance</AppText>
        <AppText color={theme.colors.textMuted}>
          Use available balance for booking requests. Reserved and pending money is not available for a new request.
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
            Enter PHP 100 to PHP 100,000. Only a provider-confirmed paid intent credits this wallet.
          </AppText>
        </View>
        <TextInput
          accessibilityLabel="Top-up amount in PHP"
          value={amount}
          onChangeText={onAmountChange}
          placeholder="1000.00"
          placeholderTextColor={theme.colors.textMuted}
          inputMode="decimal"
          editable={!createDisabled}
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

      {currentTopUp ? (
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
            <Image
              accessibilityLabel={`QR Ph code for ${currentTopUp.amountLabel} top-up`}
              source={{ uri: currentTopUp.qrImageUrl }}
              resizeMode="contain"
              style={styles.qr}
            />
          ) : null}
          {currentTopUp.canRefresh ? (
            <ActionButton
              label="Refresh provider status"
              onPress={onRefresh}
              loading={refreshBusy}
              secondary
              intent="self"
            />
          ) : null}
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
        <AppText variant="heading">Recent top-ups</AppText>
        {topUps.length === 0 ? (
          <AppText color={theme.colors.textMuted}>No member-wallet top-ups yet.</AppText>
        ) : topUps.map((topUp) => (
          <View key={topUp.id} style={[styles.row, { borderColor: theme.colors.border }]}>
            <View style={styles.rowCopy}>
              <AppText variant="bodyStrong">{topUp.amountLabel}</AppText>
              <AppText variant="caption" color={theme.colors.textMuted}>{topUp.createdLabel}</AppText>
            </View>
            <AppText
              variant="caption"
              color={topUp.payable ? theme.colors.socialText : theme.colors.textMuted}>
              {topUp.statusLabel}
            </AppText>
          </View>
        ))}
      </View>
      <ActionButton label="Return to Profile" onPress={onReturn} secondary intent="self" />
    </Screen>
  )
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
  history: { gap: density.cardGap },
  row: { borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: density.compactCardPadding, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: density.cardPadding },
  rowCopy: { flex: 1, gap: density.textPairGap },
})
