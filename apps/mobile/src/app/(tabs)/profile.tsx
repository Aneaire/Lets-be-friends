import * as Linking from 'expo-linking'
import { router, type ErrorBoundaryProps } from 'expo-router'
import { useState } from 'react'
import { useQuery } from 'convex/react'
import { StyleSheet } from 'react-native'

import { useMobileAuth } from '@/auth/MobileAuth'
import { buildMobileWebHandoffUrl, resolveMobileWebAppConfiguration } from '@/backend/config'
import { mobileApi } from '@/backend/client'
import { useAppToastMessage } from '@/design-system/molecules/AppToast'
import { SignedInProfileContent } from '@/member/ProfileContent'
import { ownReviewsQueryArgs } from '@/member/memberContent'
import { useMobileMember } from '@/member/MobileMember'
import { buildProfileScreenModel } from '@/member/profileScreenModel'
import { Screen } from '@/design-system/templates/Screen'
import { PageSkeleton } from '@/design-system/templates/PageSkeleton'
import { StateView } from '@/design-system/molecules/StateView'
import { AppText } from '@/design-system/atoms/Typography'

export default function ProfileScreen() {
  const auth = useMobileAuth()
  const member = useMobileMember()

  if (auth.status === 'unconfigured') return <ProfileState title="Account services unavailable" detail="This build cannot connect to your member profile." />
  if (auth.status === 'setup_error') return <ProfileState title="Account services unavailable" detail="Account access is unavailable in this build." />
  if (auth.status === 'loading') return <PageSkeleton variant="profile" />
  if (auth.status === 'signed_out') return <SignedOutProfile />
  if (auth.status === 'needs_task') return <SignedInUnavailableProfile title="Member profile unavailable" message="Complete the required account security step before continuing." signOut={auth.signOut} />
  if (member.status === 'loading' || member.status === 'syncing') return <PageSkeleton variant="profile" />
  if (member.status === 'unavailable' || member.status === 'error') return <SignedInUnavailableProfile title="Member profile unavailable" message={member.message} signOut={auth.signOut} />
  if (member.status !== 'ready') return <ProfileState title="Member profile unavailable" detail="Sign in again to reconnect your member profile." />

  return <ReadyProfile viewer={member.viewer} verification={member.verification} />
}

export function ReadyProfile({
  viewer,
  verification,
}: {
  viewer: Extract<ReturnType<typeof useMobileMember>, { status: 'ready' }>['viewer']
  verification: Extract<ReturnType<typeof useMobileMember>, { status: 'ready' }>['verification']
}) {
  const [message, setMessage] = useState('')
  useAppToastMessage(message)
  const [openingVerification, setOpeningVerification] = useState(false)
  const verificationUrl = buildMobileWebHandoffUrl(resolveMobileWebAppConfiguration(), { intent: 'member', mobileReturn: 'profile' })
  const application = useQuery(mobileApi.companions.myApplication, {})
  const posts = useQuery(mobileApi.social.byUser, { userId: viewer._id })
  const reviews = useQuery(mobileApi.reviews.forCompanion, ownReviewsQueryArgs(application))

  if (application === undefined) return <PageSkeleton variant="profile" />

  const model = buildProfileScreenModel({ viewer, verification, application, posts, reviews })

  async function openVerification() {
    if (model.verificationAction === 'none' || openingVerification) return
    if (!verificationUrl) {
      setMessage('Identity verification on the web is unavailable in this build.')
      return
    }
    setOpeningVerification(true)
    setMessage('')
    try {
      await Linking.openURL(verificationUrl)
    } catch {
      setMessage('Identity verification on the web could not be opened. Please try again.')
    } finally {
      setOpeningVerification(false)
    }
  }

  return (
    <SignedInProfileContent
      displayName={model.displayName}
      username={model.username}
      bio={model.bio}
      imageUrl={model.imageUrl}
      interests={model.interests}
      memberSince={model.memberSince}
      roleLabel={model.roleLabel}
      verificationLabel={model.verificationLabel}
      verificationDetail={model.verificationDetail}
      verificationApproved={model.verificationApproved}
      verificationAction={model.verificationAction}
      openingVerification={openingVerification}
      discoveryArea={model.discoveryArea}
      companion={model.companion}
      hasApplication={model.hasApplication}
      fullyVerified={model.fullyVerified}
      posts={model.posts}
      reviews={model.reviews}
      reviewsStatus={model.reviewsStatus}
      rating={model.rating}
      reviewCount={model.reviewCount}
      onEditProfile={() => router.push('/profile-edit' as never)}
      onOpenBookings={() => router.push('/bookings' as never)}
      onOpenCompanion={() => router.push('/companion')}
      onOpenVerification={() => void openVerification()}
      onCreateBooking={() => router.push('/explore')}
      onOpenPublicProfile={() => {
        if (model.companion?.publicProfileId) router.push({ pathname: '/companion-profile/[id]', params: { id: model.companion.publicProfileId } })
      }}
      onOpenSettings={() => router.push('/settings' as never)}
    />
  )
}

function SignedOutProfile() {
  return (
    <Screen scroll={false} contentStyle={styles.state}>
      <StateView
        eyebrow="YOUR ACCOUNT"
        title="Bring your member profile with you"
        detail="Sign in to view and edit your real profile, account status, bookings, wallet, and notification settings."
        actionLabel="Sign in"
        onAction={() => router.push('/auth')}
        intent="self"
      />
    </Screen>
  )
}

function SignedInUnavailableProfile({ title, message, signOut }: { title: string; message: string; signOut: () => Promise<void> }) {
  const [signingOut, setSigningOut] = useState(false)
  const [signOutError, setSignOutError] = useState(false)
  return (
    <ProfileState
      title={title}
      detail={message}
      actionLabel={signingOut ? 'Signing out' : 'Sign out'}
      onAction={() => {
        if (signingOut) return
        setSigningOut(true)
        setSignOutError(false)
        void signOut().catch(() => setSignOutError(true)).finally(() => setSigningOut(false))
      }}
      footer={signOutError ? 'Sign out could not be completed. Please try again.' : undefined}
    />
  )
}

function ProfileState({ title, detail, loading = false, actionLabel, onAction, footer }: {
  title: string
  detail: string
  loading?: boolean
  actionLabel?: string
  onAction?: () => void
  footer?: string
}) {
  return (
    <Screen scroll={false} contentStyle={styles.state}>
      <StateView eyebrow="YOUR ACCOUNT" title={title} detail={detail} loading={loading} actionLabel={actionLabel} onAction={onAction} intent="self" />
      {footer ? <AppText accessibilityRole="alert" variant="caption">{footer}</AppText> : null}
    </Screen>
  )
}

export function ErrorBoundary({ retry }: ErrorBoundaryProps) {
  return (
    <ProfileState
      title="Profile is temporarily unavailable"
      detail="Your posts and reviews could not be loaded. No profile changes were made."
      actionLabel="Try again"
      onAction={retry}
    />
  )
}

const styles = StyleSheet.create({
  state: { paddingHorizontal: 16 },
})
