import { ActivityIndicator, StyleSheet, View } from 'react-native'

import { ActionButton } from '@/design-system/atoms/ActionButton'
import { AppText } from '@/design-system/atoms/Typography'
import { useAppTheme } from '@/theme/ThemeProvider'
import { density } from '@/theme/tokens'

export type MemberSafetyRelationship = {
  blocked: boolean
  muted: boolean
  blockedByOther: boolean
}

export function memberBlockConfirmationCopy(
  displayName: string,
  blocked: boolean,
) {
  return blocked
    ? {
        title: `Unblock ${displayName}?`,
        description: 'They will be able to contact and discover you again.',
        confirmLabel: 'Unblock member',
        intent: 'neutral' as const,
      }
    : {
        title: `Block ${displayName}?`,
        description: 'New messages, bookings, follows, comments, and discovery between you will stop. Existing booking history, messages, reports, and safety records stay available.',
        confirmLabel: 'Block member',
        intent: 'danger' as const,
      }
}

export function MemberSafetyActionsPresentation({
  relationship,
  busy = null,
  message = '',
  onToggleMute,
  onChangeBlock,
}: {
  relationship?: MemberSafetyRelationship
  busy?: 'block' | 'mute' | null
  message?: string
  onToggleMute: () => void
  onChangeBlock: () => void
}) {
  const theme = useAppTheme()
  const loading = relationship === undefined
  const inactive = loading || busy !== null

  return (
    <View style={styles.container}>
      <AppText variant="caption" color={theme.colors.textMuted}>
        Muting removes this member from your feed and noncritical updates. Blocking also stops new contact and booking requests.
      </AppText>

      {loading ? (
        <ActivityIndicator
          accessibilityLabel="Checking member safety controls"
          color={theme.colors.textMuted}
          style={styles.indicator}
        />
      ) : (
        <View style={styles.actions}>
          <ActionButton
            label={relationship.muted ? 'Unmute' : 'Mute'}
            onPress={onToggleMute}
            disabled={inactive}
            loading={busy === 'mute'}
            intent="neutral"
            secondary
            style={styles.action}
          />
          <ActionButton
            label={relationship.blocked ? 'Unblock member' : 'Block member'}
            onPress={onChangeBlock}
            disabled={inactive}
            loading={busy === 'block'}
            intent={relationship.blocked ? 'neutral' : 'danger'}
            secondary
            style={styles.action}
          />
        </View>
      )}

      {relationship?.blockedByOther ? (
        <AppText variant="caption" color={theme.colors.textMuted}>
          Contact is unavailable for this member connection.
        </AppText>
      ) : null}
      {message ? (
        <AppText
          accessibilityRole="alert"
          variant="caption"
          color={theme.colors.danger}>
          {message}
        </AppText>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { gap: density.cardGap },
  indicator: { alignSelf: 'flex-start', minHeight: density.controlHeight },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: density.cardGap },
  action: { flexGrow: 1, flexBasis: 140 },
})
