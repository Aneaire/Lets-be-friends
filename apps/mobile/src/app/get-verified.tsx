import { useQuery } from 'convex/react'
import * as Linking from 'expo-linking'
import { router, type ErrorBoundaryProps } from 'expo-router'
import { useRef, useState } from 'react'

import { mobileApi } from '@/backend/client'
import { buildMobileWebHandoffUrl, resolveMobileWebAppConfiguration } from '@/backend/config'
import { ActionButton } from '@/design-system/atoms/ActionButton'
import { AppText } from '@/design-system/atoms/Typography'
import { StatusBadge } from '@/design-system/atoms/StatusBadge'
import { AppHeader } from '@/design-system/molecules/AppHeader'
import { StateView } from '@/design-system/molecules/StateView'
import { PageSkeleton } from '@/design-system/templates/PageSkeleton'
import { Screen, Section } from '@/design-system/templates/Screen'
import { getVerifiedModel } from '@/features/verification/getVerifiedModel'
import { useMobileMember } from '@/member/MobileMember'
import { useAppTheme } from '@/theme/ThemeProvider'

export default function GetVerifiedScreen() {
  const member = useMobileMember()
  if (member.status === 'loading' || member.status === 'syncing') return <PageSkeleton variant="profile" />
  if (member.status !== 'ready') return <Screen><StateView title="Sign in to check your verification" actionLabel="Return to Profile" onAction={() => router.replace('/profile')} intent="self" /></Screen>
  return <ReadyGetVerified key={String(member.viewer._id)} member={member} />
}

function ReadyGetVerified({ member }: { member: Extract<ReturnType<typeof useMobileMember>, { status: 'ready' }> }) {
  const theme = useAppTheme()
  const application = useQuery(mobileApi.companions.myApplication, {})
  const openingRef = useRef(false)
  const [opening, setOpening] = useState(false)
  const [error, setError] = useState('')
  if (application === undefined) return <PageSkeleton variant="profile" />
  const model = getVerifiedModel({ ...member.viewer, verification: member.verification, applicationStatus: application?.status })
  async function openIdentity() {
    if (openingRef.current) return
    if (model.identity.action === 'none') { router.push('/verified'); return }
    const url = buildMobileWebHandoffUrl(resolveMobileWebAppConfiguration(), { intent: 'member', mobileReturn: 'profile' })
    if (!url) { setError('Identity verification on the web is unavailable in this build.'); return }
    openingRef.current = true
    setOpening(true)
    setError('')
    try { await Linking.openURL(url) } catch { setError('Identity verification could not be opened. Please try again.') } finally { openingRef.current = false; setOpening(false) }
  }
  return <Screen contentStyle={{ gap: 20 }}>
    <AppHeader title="Get verified" back onBack={() => router.canGoBack() ? router.back() : router.replace('/profile')} />
    <AppText variant="label" color={theme.colors.selfText}>TRUST AND SAFETY</AppText>
    <AppText variant="title">Get verified</AppText>
    <AppText>Confirm who you are, then create a Companion profile if you want to offer your Strengths. We save your progress after each step.</AppText>
    <AppText accessibilityRole="text">{model.completedSteps}/2 steps complete</AppText>
    <Section>
      <AppText variant="heading">1. Identity check</AppText>
      <StatusBadge label={model.identity.label} tone={model.identity.tone} />
      <AppText color={theme.colors.textMuted}>{model.identity.guidance}</AppText>
      {member.viewer.identityEligible ? <AppText>Your identity and safety review are approved.</AppText> : null}
      {member.viewer.identityEligible ? null : <ActionButton label={opening ? 'Opening identity check' : model.identityActionLabel} intent="self" onPress={() => void openIdentity()} disabled={opening} />}
      {error ? <AppText accessibilityRole="alert" color={theme.colors.danger}>{error}</AppText> : null}
    </Section>
    <Section>
      <AppText variant="heading">2. Companion profile</AppText>
      <StatusBadge label={model.companionLabel} tone={model.companionDone ? 'success' : 'self'} />
      <AppText color={theme.colors.textMuted}>{model.companionDone ? member.viewer.identityEligible ? 'Your Companion profile is saved and appears in discovery.' : 'Your Companion profile is saved. It appears in discovery once identity is approved.' : 'Share your activities, session format, availability, and profile details. Identity verification is the only review step.'}</AppText>
      {!model.companionUnlocked ? <AppText>Submit your identity check for safety review first. Your profile stays hidden from discovery until your identity check is approved.</AppText> : null}
      <ActionButton label={model.companionActionLabel} intent="self" disabled={!model.companionUnlocked} onPress={() => router.push('/companion')} />
    </Section>
    <Section>
      <AppText variant="heading">Earn with your everyday Strengths</AppText>
      <AppText>Approved Companions can accept bookings and earn from completed experiences. You receive the full listed service subtotal.</AppText>
      <AppText color={theme.colors.textMuted}>Withdraw available wallet funds to a verified bank or e-wallet account through PayMongo InstaPay.</AppText>
    </Section>
  </Screen>
}

export function ErrorBoundary({ retry }: ErrorBoundaryProps) {
  return <Screen><StateView title="Verification status is unavailable" actionLabel="Try again" onAction={retry} intent="self" /></Screen>
}
