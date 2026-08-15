import { useMutation, useQuery } from 'convex/react'
import { Alert, StyleSheet, View } from 'react-native'

import { mobileApi, type UserId } from '@/backend/client'
import { useAppTheme } from '@/theme/ThemeProvider'

import { ActionButton } from './ActionButton'
import { AppText } from './Typography'

export function MemberSafetyActions({ userId, displayName }: { userId: string; displayName: string }) {
  const theme = useAppTheme()
  const relationship = useQuery(mobileApi.safety.relationship, { userId: userId as UserId })
  const setBlocked = useMutation(mobileApi.safety.setBlocked)
  const setMuted = useMutation(mobileApi.safety.setMuted)

  function changeBlock() {
    const blocked = Boolean(relationship?.blocked)
    Alert.alert(blocked ? `Unblock ${displayName}?` : `Block ${displayName}?`, blocked ? 'They will be able to contact and discover you again.' : 'New messages, bookings, follows, comments, and discovery between you will stop. Existing booking history, messages, reports, and safety records stay available.', [
      { text: 'Cancel', style: 'cancel' },
      { text: blocked ? 'Unblock' : 'Block member', style: blocked ? 'default' : 'destructive', onPress: () => void setBlocked({ userId: userId as UserId, blocked: !blocked }) },
    ])
  }

  return <View style={styles.container}><AppText variant="caption" color={theme.colors.textMuted}>Muting removes this member from your feed and noncritical updates. Blocking also stops new contact and booking requests.</AppText><View style={styles.actions}><ActionButton label={relationship?.muted ? 'Unmute' : 'Mute'} onPress={() => void setMuted({ userId: userId as UserId, muted: !relationship?.muted })} intent="self" secondary style={styles.action} /><ActionButton label={relationship?.blocked ? 'Unblock' : 'Block'} onPress={changeBlock} intent="danger" secondary style={styles.action} /></View>{relationship?.blockedByOther ? <AppText variant="caption" color={theme.colors.textMuted}>Contact is unavailable for this member connection.</AppText> : null}</View>
}

const styles = StyleSheet.create({ container: { gap: 8 }, actions: { flexDirection: 'row', gap: 8 }, action: { flex: 1, minHeight: 46 } })
