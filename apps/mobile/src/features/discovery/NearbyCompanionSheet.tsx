import { StyleSheet, View } from 'react-native'

import { ActionButton } from '@/design-system/atoms/ActionButton'
import { Avatar } from '@/design-system/atoms/Avatar'
import { Chip } from '@/design-system/atoms/Chip'
import { AppText } from '@/design-system/atoms/Typography'
import { VerifiedBadge } from '@/design-system/atoms/VerifiedBadge'
import { BottomSheet } from '@/design-system/molecules/BottomSheet'
import type { DiscoveryCompanionViewModel } from '@/data/companionViewModels'
import { nearbyCompanionMeta, nearbyCompanionRating, nearbyCompanionStrengths } from '@/features/discovery/nearbyMapSelection'
import { useAppTheme } from '@/theme/ThemeProvider'
import { density } from '@/theme/tokens'

export type NearbyCompanionSheetProps = {
  visible: boolean
  /** Kept after closing so the sheet can animate out with its content. */
  companion: DiscoveryCompanionViewModel | null
  signedIn: boolean
  messaging?: boolean
  onMessage: () => void
  onViewProfile: () => void
  onClose: () => void
}

export function NearbyCompanionSheet({ visible, companion, signedIn, messaging = false, onMessage, onViewProfile, onClose }: NearbyCompanionSheetProps) {
  const theme = useAppTheme()
  const rating = companion ? nearbyCompanionRating(companion) : ''
  const strengths = companion ? nearbyCompanionStrengths(companion) : []
  const canMessage = Boolean(companion?.userId) && signedIn

  return (
    <BottomSheet
      visible={visible}
      title={companion?.name ?? 'Nearby Companion'}
      description={companion ? nearbyCompanionMeta(companion) : undefined}
      closeLabel="Close Companion details"
      busy={messaging}
      onClose={onClose}
      footer={companion ? (
        <View style={styles.actions}>
          <ActionButton
            label="Message"
            icon="chatbubble-outline"
            intent="social"
            loading={messaging}
            disabled={!canMessage}
            accessibilityHint={canMessage ? undefined : 'Sign in to message this Companion.'}
            onPress={onMessage}
            style={styles.action}
          />
          <ActionButton
            label="View profile"
            icon="person-outline"
            intent="neutral"
            secondary
            disabled={messaging}
            onPress={onViewProfile}
            style={styles.action}
          />
        </View>
      ) : undefined}>
      {companion ? (
        <View style={styles.body}>
          <View style={styles.identity}>
            <Avatar uri={companion.imageUrl} name={companion.name} size={72} />
            <View style={styles.identityCopy}>
              <View style={styles.metaRow}>
                {companion.verified ? <VerifiedBadge /> : null}
                <AppText variant="caption" color={theme.colors.textMuted}>{rating}</AppText>
              </View>
              {companion.rateLabel ? <AppText variant="caption" color={theme.colors.socialText} style={styles.rate}>{companion.rateLabel}</AppText> : null}
            </View>
          </View>
          {strengths.length > 0 ? (
            <View style={styles.strengths}>
              {strengths.map((strength) => <Chip key={strength} label={strength} />)}
            </View>
          ) : null}
          {companion.intro ? <AppText numberOfLines={4}>{companion.intro}</AppText> : null}
          <AppText variant="caption" color={theme.colors.textMuted}>Approximate area only. Exact meeting locations are shared after a booking is confirmed.</AppText>
        </View>
      ) : null}
    </BottomSheet>
  )
}

const styles = StyleSheet.create({
  body: { gap: density.contentGap },
  identity: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  identityCopy: { flex: 1, gap: density.textSectionGap, alignItems: 'flex-start' },
  metaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', columnGap: 8, rowGap: density.textPairGap },
  rate: { fontWeight: '700' },
  strengths: { flexDirection: 'row', flexWrap: 'wrap', gap: density.cardGap },
  actions: { flexDirection: 'row', gap: density.cardGap },
  action: { flex: 1 },
})
