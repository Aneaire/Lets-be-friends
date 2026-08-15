import { StyleSheet, View } from 'react-native'

import {
  bookingLifecyclePresentation,
  type BookingLifecycleInput,
} from '@/data/bookingLifecycle'
import { useAppTheme } from '@/theme/ThemeProvider'

import { AppText } from './Typography'

export function BookingLifecycleDetails(props: BookingLifecycleInput) {
  const theme = useAppTheme()
  const presentation = bookingLifecyclePresentation(props)

  return (
    <View style={styles.section}>
      <AppText variant="heading">Lifecycle and settlement</AppText>
      {presentation.cancellation ? (
        <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <AppText variant="bodyStrong">Cancellation</AppText>
          {presentation.cancellation.actor ? <Fact label="Cancelled by" value={presentation.cancellation.actor} /> : null}
          {presentation.cancellation.time ? <Fact label="Cancelled at" value={presentation.cancellation.time} /> : null}
          {presentation.cancellation.reason ? <Fact label="Reason" value={presentation.cancellation.reason} /> : null}
        </View>
      ) : null}
      <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
        <AppText variant="bodyStrong">Completion confirmations</AppText>
        <AppText variant="caption" color={theme.colors.textMuted}>Each participant confirms completion separately. The review window opens after both confirmations.</AppText>
        <Fact label="Member" value={presentation.completion.member} />
        <Fact label="Companion" value={presentation.completion.companion} />
      </View>
      {presentation.settlement ? (
        <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <AppText variant="bodyStrong">Settlement</AppText>
          <Fact label="State" value={presentation.settlement.label} />
          {presentation.settlement.eligibleAt ? <Fact label="Eligible at" value={presentation.settlement.eligibleAt} /> : null}
          {presentation.settlement.blockedAt ? <Fact label="Blocked at" value={presentation.settlement.blockedAt} /> : null}
          {presentation.settlement.resolvedAt ? <Fact label="Resolved at" value={presentation.settlement.resolvedAt} /> : null}
          <AppText variant="caption" color={theme.colors.textMuted}>{presentation.settlement.explanation}</AppText>
        </View>
      ) : null}
    </View>
  )
}

function Fact({ label, value }: { label: string; value: string }) {
  const theme = useAppTheme()
  return (
    <View style={styles.fact}>
      <AppText variant="caption" color={theme.colors.textMuted}>{label}</AppText>
      <AppText variant="bodyStrong">{value}</AppText>
    </View>
  )
}

const styles = StyleSheet.create({
  section: { gap: 10 },
  card: { borderWidth: 1, borderRadius: 18, padding: 16, gap: 9 },
  fact: { gap: 3 },
})
