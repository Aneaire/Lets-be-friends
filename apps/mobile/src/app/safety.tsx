import { useMutation, useQuery } from 'convex/react'
import * as Linking from 'expo-linking'
import { router, useLocalSearchParams } from 'expo-router'
import { useRef, useState } from 'react'
import { StyleSheet, View } from 'react-native'

import { mobileApi, type UserId } from '@/backend/client'
import type { FunctionReturnType } from 'convex/server'
import { ActionButton } from '@/design-system/atoms/ActionButton'
import { AppHeader } from '@/design-system/molecules/AppHeader'
import { IdentityRow } from '@/design-system/molecules/IdentityRow'
import { MemberSafetyActions } from '@/features/safety/MemberSafetyActions'
import { useAppToastMessage } from '@/design-system/molecules/AppToast'
import { Screen, Section } from '@/design-system/templates/Screen'
import { AppText } from '@/design-system/atoms/Typography'
import { safeProductError } from '@/data/productErrors'
import { useMobileMember } from '@/member/MobileMember'
import { useAppTheme } from '@/theme/ThemeProvider'

export default function SafetyCenterScreen() {
  const member = useMobileMember()
  const params = useLocalSearchParams<{ userId?: string; name?: string }>()
  if (member.status !== 'ready') return <Screen contentStyle={styles.state}><AppHeader title="Safety Center" back onBack={() => router.back()} /><AppText variant="title">Sign in to manage safety settings</AppText></Screen>
  return <SafetyCenter targetUserId={typeof params.userId === 'string' ? params.userId : undefined} targetName={typeof params.name === 'string' ? params.name : 'Member'} />
}

function SafetyCenter({ targetUserId, targetName }: { targetUserId?: string; targetName: string }) {
  const theme = useAppTheme()
  const preferences = useQuery(mobileApi.safety.mine, {})
  const setBlocked = useMutation(mobileApi.safety.setBlocked)
  const setMuted = useMutation(mobileApi.safety.setMuted)
  const [busyUserId, setBusyUserId] = useState<string | null>(null)
  const mutationLock = useRef<string | null>(null)
  const [message, setMessage] = useState('')
  useAppToastMessage(message)

  async function clearPreference(item: FunctionReturnType<typeof mobileApi.safety.mine>[number]) {
    const id = String(item.userId)
    if (busyUserId || mutationLock.current) return
    mutationLock.current = id
    setBusyUserId(id)
    setMessage('')
    try {
      if (item.blockedAt) await setBlocked({ userId: item.userId as UserId, blocked: false })
      else await setMuted({ userId: item.userId as UserId, muted: false })
    } catch (error) {
      setMessage(safeProductError('update_safety', error))
    } finally {
      mutationLock.current = null
      setBusyUserId(null)
    }
  }

  return <Screen contentStyle={styles.content}><AppHeader title="Safety Center" back onBack={() => router.canGoBack() ? router.back() : router.replace('/profile')} /><View style={[styles.hero, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}><AppText variant="label" color={theme.colors.selfText}>TRUST FIRST</AppText><AppText variant="title">Plan clearly. Meet safely.</AppText><AppText color={theme.colors.textMuted}>Keep first meetings public, share the plan with someone you trust, and use in-app messages so important context stays with the booking.</AppText></View>{targetUserId ? <Section><AppText variant="heading">Manage {targetName}</AppText><MemberSafetyActions userId={targetUserId} displayName={targetName} /></Section> : null}<Section><AppText variant="heading">Before an in-person session</AppText><Guidance text="Confirm the public meeting place and expected end time in messages." /><Guidance text="Arrange your own transportation and keep personal addresses private." /><Guidance text="Leave if the plan changes or you feel uncomfortable. You do not need to justify leaving." /><Guidance text="Report concerning behavior from the profile, conversation, or booking so the safety team receives the right context." /></Section><Section><AppText variant="heading">Blocked and muted members</AppText>{preferences === undefined ? <AppText color={theme.colors.textMuted}>Loading your safety settings.</AppText> : preferences.length ? preferences.map((item: FunctionReturnType<typeof mobileApi.safety.mine>[number]) => <View key={String(item.userId)} style={[styles.member, { borderBottomColor: theme.colors.border }]}><IdentityRow name={item.displayName} imageUrl={item.profileImageUrl} avatarSize={42} meta={[item.blockedAt ? 'Blocked' : '', item.mutedAt ? 'Muted' : ''].filter(Boolean).join(' · ')} action={<ActionButton label={busyUserId === String(item.userId) ? 'Updating' : item.blockedAt ? 'Unblock' : 'Unmute'} onPress={() => void clearPreference(item)} disabled={busyUserId !== null} intent={item.blockedAt ? 'danger' : 'self'} secondary style={styles.compact} />} /></View>) : <AppText color={theme.colors.textMuted}>You have not blocked or muted anyone.</AppText>}</Section><Section><AppText variant="heading">Immediate help</AppText><AppText color={theme.colors.textMuted}>If you or someone else is in immediate danger, contact local emergency services. In the Philippines, the national emergency number is 911.</AppText><ActionButton label="Call 911" onPress={() => void Linking.openURL('tel:911')} intent="danger" secondary icon="call-outline" /></Section></Screen>
}

function Guidance({ text }: { text: string }) { const theme = useAppTheme(); return <View style={styles.guidance}><View style={[styles.bullet, { backgroundColor: theme.colors.self }]} /><AppText style={styles.guidanceText}>{text}</AppText></View> }

const styles = StyleSheet.create({ content: { paddingHorizontal: 16, paddingBottom: 40 }, state: { paddingHorizontal: 16, gap: 16 }, hero: { borderWidth: 1, borderRadius: 16, padding: 14, gap: 8 }, guidance: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: 10 }, guidanceText: { flex: 1 }, bullet: { width: 7, height: 7, borderRadius: 4, marginTop: 8 }, member: { minHeight: 64, borderBottomWidth: StyleSheet.hairlineWidth, justifyContent: 'center', paddingVertical: 8 }, compact: { minHeight: 42, paddingHorizontal: 12 } })
