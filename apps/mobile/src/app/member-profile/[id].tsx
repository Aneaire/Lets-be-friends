import { useMutation, useQuery } from 'convex/react'
import { router, useLocalSearchParams, type ErrorBoundaryProps } from 'expo-router'
import { useRef, useState } from 'react'
import { StyleSheet, View } from 'react-native'

import { useMobileAuth } from '@/auth/MobileAuth'
import { mobileApi, type UserId } from '@/backend/client'
import { useMobileBackendConfiguration } from '@/backend/MobileBackendProvider'
import { ActionButton } from '@/design-system/atoms/ActionButton'
import { AppHeader } from '@/design-system/molecules/AppHeader'
import { useAppToastMessage } from '@/design-system/molecules/AppToast'
import { Avatar } from '@/design-system/atoms/Avatar'
import { Chip } from '@/design-system/atoms/Chip'
import { MemberSafetyActions } from '@/features/safety/MemberSafetyActions'
import { ReportAction } from '@/features/safety/ReportAction'
import { Screen, Section } from '@/design-system/templates/Screen'
import { StateView } from '@/design-system/molecules/StateView'
import { AppText } from '@/design-system/atoms/Typography'
import { useMobileMember } from '@/member/MobileMember'
import { useAppTheme } from '@/theme/ThemeProvider'

export default function MemberProfileScreen() {
  const params = useLocalSearchParams<{ id?: string }>()
  const configuration = useMobileBackendConfiguration()
  const id = typeof params.id === 'string' ? params.id : ''

  if (configuration.status !== 'configured') return <ProfileState title="Member profiles need member services" detail="This build cannot connect to public profiles." />
  if (!id) return <ProfileState title="Profile unavailable" detail="This profile link is incomplete." />
  return <ConnectedMemberProfile id={id} />
}

function ConnectedMemberProfile({ id }: { id: string }) {
  const theme = useAppTheme()
  const auth = useMobileAuth()
  const member = useMobileMember()
  const profile = useQuery(mobileApi.users.publicProfile, { userId: id as UserId })
  const toggleFollow = useMutation(mobileApi.social.toggleFollow)
  const startConversation = useMutation(mobileApi.conversations.start)
  const [following, setFollowing] = useState<boolean | null>(null)
  const [busy, setBusy] = useState<'follow' | 'message' | null>(null)
  const actionLock = useRef<'follow' | 'message' | null>(null)
  const [message, setMessage] = useState('')
  useAppToastMessage(message)

  if (profile === undefined) return <ProfileState title="Loading public profile" detail="Checking the member directory." loading />
  if (profile === null) return <ProfileState title="Profile unavailable" detail="This member profile is no longer available." action="Return to Explore" onPress={() => router.replace('/explore')} />

  const userProfile = profile
  const signedIn = member.status === 'ready'
  const ownProfile = userProfile.isViewer
  const isFollowing = following ?? userProfile.following

  async function follow() {
    if (!signedIn || ownProfile || busy || actionLock.current) return
    actionLock.current = 'follow'
    setBusy('follow')
    setMessage('')
    try {
      setFollowing(await toggleFollow({ userId: userProfile._id }))
    } catch {
      setMessage('Following could not be updated. Please try again.')
    } finally {
      actionLock.current = null
      setBusy(null)
    }
  }

  async function openConversation() {
    if (!signedIn || ownProfile || busy || actionLock.current) return
    actionLock.current = 'message'
    setBusy('message')
    setMessage('')
    try {
      const conversationId = await startConversation({ otherUserId: userProfile._id })
      router.push({ pathname: '/conversation/[id]', params: { id: String(conversationId) } })
    } catch {
      setMessage('A conversation could not be opened. Please try again.')
    } finally {
      actionLock.current = null
      setBusy(null)
    }
  }

  return (
    <Screen contentStyle={styles.content}>
      <AppHeader title="Member profile" back onBack={goBackOrExplore} />
      <View style={styles.identity}>
        <Avatar uri={userProfile.profileImageUrl ?? undefined} name={userProfile.displayName} size={88} />
        <View style={styles.identityCopy}>
          <AppText variant="title">{userProfile.displayName}</AppText>
          {userProfile.username ? <AppText color={theme.colors.textMuted}>@{userProfile.username}</AppText> : null}
          <AppText variant="caption" color={theme.colors.textMuted}>{userProfile.identityVerified ? 'Identity checked' : 'Not identity checked'}</AppText>
        </View>
      </View>

      <AppText color={theme.colors.textMuted}>{userProfile.bio || 'This member has not added a bio yet.'}</AppText>

      <View style={styles.actions}>
        {ownProfile ? <ActionButton label="Edit profile" onPress={() => router.push('/profile-edit')} intent="self" style={styles.action} /> : signedIn ? <>
          <ActionButton label={busy === 'message' ? 'Opening' : 'Message'} onPress={() => void openConversation()} disabled={busy !== null} intent="social" secondary style={styles.action} />
          <ActionButton label={busy === 'follow' ? 'Updating' : isFollowing ? 'Following' : 'Follow'} onPress={() => void follow()} disabled={busy !== null} intent="social" style={styles.action} />
        </> : <ActionButton label="Sign in to connect" onPress={() => router.push('/auth')} disabled={auth.status !== 'signed_out'} intent="social" style={styles.action} />}
      </View>

      <Section>
        <AppText variant="heading">Interested in</AppText>
        {userProfile.onboardingCategories.length ? <View style={styles.chips}>{userProfile.onboardingCategories.map((category) => <Chip key={category} label={category} />)}</View> : <AppText color={theme.colors.textMuted}>No interests have been added yet.</AppText>}
      </Section>

      {signedIn && !ownProfile ? <Section style={styles.safety}>
        <ReportAction targetType="user" targetId={String(userProfile._id)} label="Report this member" />
        <MemberSafetyActions userId={String(userProfile._id)} displayName={userProfile.displayName} />
      </Section> : null}
    </Screen>
  )
}

function ProfileState({ title, detail, action, onPress, loading = false }: { title: string; detail?: string; action?: string; onPress?: () => void; loading?: boolean }) {
  return <Screen scroll={false} contentStyle={styles.state}><StateView eyebrow="MEMBER" title={title} detail={detail} actionLabel={action} onAction={onPress} loading={loading} /></Screen>
}

export function ErrorBoundary({ retry }: ErrorBoundaryProps) {
  return <ProfileState title="This member profile could not be loaded" detail="The public profile is temporarily unavailable." action="Try again" onPress={retry} />
}

function goBackOrExplore() {
  if (router.canGoBack()) router.back()
  else router.replace('/explore')
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingBottom: 40 },
  state: { paddingHorizontal: 16 },
  identity: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 18 },
  identityCopy: { flex: 1, gap: 4 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 18 },
  action: { flex: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  safety: { gap: 12 },
})
