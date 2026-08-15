import { useMutation, useQuery } from 'convex/react'
import * as Linking from 'expo-linking'
import { router, useLocalSearchParams } from 'expo-router'
import { StyleSheet, View } from 'react-native'

import { mobileApi, type UserId } from '@/backend/client'
import type { FunctionReturnType } from 'convex/server'
import { ActionButton } from '@/components/ActionButton'
import { AppHeader } from '@/components/AppHeader'
import { Avatar } from '@/components/Avatar'
import { MemberSafetyActions } from '@/components/MemberSafetyActions'
import { Screen, Section } from '@/components/Screen'
import { AppText } from '@/components/Typography'
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
  return <Screen contentStyle={styles.content}><AppHeader title="Safety Center" back onBack={() => router.canGoBack() ? router.back() : router.replace('/profile')} /><View style={[styles.hero, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}><AppText variant="label" color={theme.colors.selfText}>TRUST FIRST</AppText><AppText variant="title">Plan clearly. Meet safely.</AppText><AppText color={theme.colors.textMuted}>Keep first meetings public, share the plan with someone you trust, and use in-app messages so important context stays with the booking.</AppText></View>{targetUserId ? <Section><AppText variant="heading">Manage {targetName}</AppText><MemberSafetyActions userId={targetUserId} displayName={targetName} /></Section> : null}<Section><AppText variant="heading">Before an in-person session</AppText><Guidance text="Confirm the public meeting place and expected end time in messages." /><Guidance text="Arrange your own transportation and keep personal addresses private." /><Guidance text="Leave if the plan changes or you feel uncomfortable. You do not need to justify leaving." /><Guidance text="Report concerning behavior from the profile, conversation, or booking so the safety team receives the right context." /></Section><Section><AppText variant="heading">Blocked and muted members</AppText>{preferences === undefined ? <AppText color={theme.colors.textMuted}>Loading your safety settings.</AppText> : preferences.length ? preferences.map((item: FunctionReturnType<typeof mobileApi.safety.mine>[number]) => <View key={String(item.userId)} style={[styles.member, { borderBottomColor: theme.colors.border }]}><Avatar uri={item.profileImageUrl ?? undefined} name={item.displayName} size={42} /><View style={styles.memberCopy}><AppText variant="bodyStrong">{item.displayName}</AppText><AppText variant="caption" color={theme.colors.textMuted}>{[item.blockedAt ? 'Blocked' : '', item.mutedAt ? 'Muted' : ''].filter(Boolean).join(' · ')}</AppText></View>{item.blockedAt ? <ActionButton label="Unblock" onPress={() => void setBlocked({ userId: item.userId as UserId, blocked: false })} intent="danger" secondary style={styles.compact} /> : <ActionButton label="Unmute" onPress={() => void setMuted({ userId: item.userId as UserId, muted: false })} intent="self" secondary style={styles.compact} />}</View>) : <AppText color={theme.colors.textMuted}>You have not blocked or muted anyone.</AppText>}</Section><Section><AppText variant="heading">Immediate help</AppText><AppText color={theme.colors.textMuted}>If you or someone else is in immediate danger, contact local emergency services. In the Philippines, the national emergency number is 911.</AppText><ActionButton label="Call 911" onPress={() => void Linking.openURL('tel:911')} intent="danger" secondary icon="call-outline" /></Section></Screen>
}

function Guidance({ text }: { text: string }) { const theme = useAppTheme(); return <View style={styles.guidance}><View style={[styles.bullet, { backgroundColor: theme.colors.self }]} /><AppText style={styles.guidanceText}>{text}</AppText></View> }

const styles = StyleSheet.create({ content: { paddingHorizontal: 16, paddingBottom: 56 }, state: { paddingHorizontal: 16, gap: 18 }, hero: { borderWidth: 1, borderRadius: 20, padding: 18, gap: 8 }, guidance: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: 10 }, guidanceText: { flex: 1 }, bullet: { width: 7, height: 7, borderRadius: 4, marginTop: 8 }, member: { minHeight: 64, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 }, memberCopy: { flex: 1, gap: 2 }, compact: { minHeight: 42, paddingHorizontal: 12 } })
