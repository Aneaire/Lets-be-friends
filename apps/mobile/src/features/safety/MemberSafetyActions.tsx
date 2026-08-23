import { useMutation, useQuery } from 'convex/react'
import { useRef, useState } from 'react'
import { Alert, StyleSheet, View } from 'react-native'

import { mobileApi, type UserId } from '@/backend/client'
import { safeProductError } from '@/data/productErrors'
import { useAppTheme } from '@/theme/ThemeProvider'

import { ActionButton } from '@/design-system/atoms/ActionButton'
import { useAppToastMessage } from '@/design-system/molecules/AppToast'
import { AppText } from '@/design-system/atoms/Typography'

export function MemberSafetyActions({ userId, displayName }: { userId: string; displayName: string }) {
  const theme = useAppTheme()
  const relationship = useQuery(mobileApi.safety.relationship, { userId: userId as UserId })
  const setBlocked = useMutation(mobileApi.safety.setBlocked)
  const setMuted = useMutation(mobileApi.safety.setMuted)
  const [busy, setBusy] = useState<'block' | 'mute' | null>(null)
  const mutationLock = useRef<'block' | 'mute' | null>(null)
  const [message, setMessage] = useState('')
  useAppToastMessage(message)

  async function updateBlock(blocked: boolean) {
    if (busy || mutationLock.current) return
    mutationLock.current = 'block'
    setBusy('block')
    setMessage('')
    try {
      await setBlocked({ userId: userId as UserId, blocked })
    } catch (error) {
      setMessage(safeProductError('update_safety', error))
    } finally {
      mutationLock.current = null
      setBusy(null)
    }
  }

  async function updateMute(muted: boolean) {
    if (busy || mutationLock.current) return
    mutationLock.current = 'mute'
    setBusy('mute')
    setMessage('')
    try {
      await setMuted({ userId: userId as UserId, muted })
    } catch (error) {
      setMessage(safeProductError('update_safety', error))
    } finally {
      mutationLock.current = null
      setBusy(null)
    }
  }

  function changeBlock() {
    const blocked = Boolean(relationship?.blocked)
    Alert.alert(blocked ? `Unblock ${displayName}?` : `Block ${displayName}?`, blocked ? 'They will be able to contact and discover you again.' : 'New messages, bookings, follows, comments, and discovery between you will stop. Existing booking history, messages, reports, and safety records stay available.', [
      { text: 'Cancel', style: 'cancel' },
      { text: blocked ? 'Unblock' : 'Block member', style: blocked ? 'default' : 'destructive', onPress: () => void updateBlock(!blocked) },
    ])
  }

  const disabled = relationship === undefined || busy !== null
  return <View style={styles.container}><AppText variant="caption" color={theme.colors.textMuted}>Muting removes this member from your feed and noncritical updates. Blocking also stops new contact and booking requests.</AppText><View style={styles.actions}><ActionButton label={busy === 'mute' ? 'Updating' : relationship?.muted ? 'Unmute' : 'Mute'} onPress={() => void updateMute(!relationship?.muted)} disabled={disabled} intent="self" secondary style={styles.action} /><ActionButton label={busy === 'block' ? 'Updating' : relationship?.blocked ? 'Unblock' : 'Block'} onPress={changeBlock} disabled={disabled} intent="danger" secondary style={styles.action} /></View>{relationship?.blockedByOther ? <AppText variant="caption" color={theme.colors.textMuted}>Contact is unavailable for this member connection.</AppText> : null}</View>
}

const styles = StyleSheet.create({ container: { gap: 8 }, actions: { flexDirection: 'row', gap: 8 }, action: { flex: 1, minHeight: 46 } })
