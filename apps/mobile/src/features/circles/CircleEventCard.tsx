import { Image, StyleSheet, View } from 'react-native'

import { AppText } from '@/design-system/atoms/Typography'
import { useAppTheme } from '@/theme/ThemeProvider'

import { circleEventLocationLine, formatCircleEventWhen, type CircleEventItem } from './circlePresentation'

export function CircleEventCard({ event, actions }: { event: CircleEventItem; actions?: React.ReactNode }) {
  const theme = useAppTheme()
  const locationLine = circleEventLocationLine(event)
  return (
    <View
      accessibilityRole="text"
      accessibilityLabel={`${event.title}, ${formatCircleEventWhen(event.startsAt)}${event.state === 'cancelled' ? ', cancelled' : ''}`}
      style={[styles.card, { backgroundColor: theme.colors.surfaceRaised, borderColor: theme.colors.border }]}>
      {event.thumbnailUrl ? (
        <Image source={{ uri: event.thumbnailUrl }} style={styles.thumbnail} accessibilityLabel={`${event.title} event thumbnail`} />
      ) : null}
      <View style={styles.copy}>
        <View style={styles.titleRow}>
          <AppText variant="bodyStrong" style={styles.title}>{event.title}</AppText>
          {event.state === 'cancelled' ? (
            <AppText variant="caption" color={theme.colors.warning}>Cancelled</AppText>
          ) : null}
        </View>
        <AppText variant="caption" color={theme.colors.textMuted}>{formatCircleEventWhen(event.startsAt)}</AppText>
        {locationLine ? (
          <AppText variant="caption" color={theme.colors.textMuted}>{locationLine}</AppText>
        ) : null}
        <AppText numberOfLines={3}>{event.details}</AppText>
        <AppText variant="caption" color={theme.colors.textMuted}>Organized by {event.organizerDisplayName}</AppText>
        {actions ? <View style={styles.actions}>{actions}</View> : null}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 16, padding: 12, gap: 10 },
  thumbnail: { width: '100%', aspectRatio: 16 / 9, borderRadius: 12 },
  copy: { gap: 4 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { flex: 1 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
})
