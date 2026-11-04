import { router } from 'expo-router'
import { useMutation, useQuery } from 'convex/react'
import { useState } from 'react'
import { Share, StyleSheet, TextInput, View } from 'react-native'
import {
  formatPhp,
  normalizeReferralCode,
  referralCodeValidationError,
  referralShareUrl,
} from '@lets-be-friends/shared'

import { mobileApi } from '@/backend/client'
import { resolveMobileWebAppConfiguration } from '@/backend/config'
import { ActionButton } from '@/design-system/atoms/ActionButton'
import { AppText } from '@/design-system/atoms/Typography'
import { StateView } from '@/design-system/molecules/StateView'
import { PageSkeleton } from '@/design-system/templates/PageSkeleton'
import { Screen } from '@/design-system/templates/Screen'
import { useMobileMember } from '@/member/MobileMember'
import { useAppTheme } from '@/theme/ThemeProvider'

export default function ReferralsScreen() {
  const member = useMobileMember()
  if (member.status === 'signed_out') {
    return <ReferralState title="Sign in to invite friends" detail="Your referral link is connected to your member account." action="Sign in" onPress={() => router.replace('/auth')} />
  }
  if (member.status === 'unconfigured') {
    return <ReferralState title="Referrals need account services" detail="This build cannot connect to your member account." action="Return to Profile" onPress={() => router.replace('/profile')} />
  }
  if (member.status === 'unavailable' || member.status === 'error') {
    return <ReferralState title="Referrals are unavailable" detail={member.message} action="Return to Profile" onPress={() => router.replace('/profile')} />
  }
  if (member.status !== 'ready') return <PageSkeleton variant="profile" />
  return <ReadyReferrals />
}

function ReadyReferrals() {
  const theme = useAppTheme()
  const referral = useQuery(mobileApi.referrals.myReferral, {})
  const ensureReferralCode = useMutation(mobileApi.referrals.ensureReferralCode)
  const attributeReferral = useMutation(mobileApi.referrals.attributeReferral)
  const [busy, setBusy] = useState(false)
  const [codeInput, setCodeInput] = useState('')
  const [message, setMessage] = useState('')

  if (referral === undefined) return <PageSkeleton variant="profile" />
  if (referral === null) {
    return <ReferralState title="Referrals are unavailable" detail="Your referral details could not be loaded." action="Return to Profile" onPress={() => router.replace('/profile')} />
  }

  const referralCode = referral.code
  const web = resolveMobileWebAppConfiguration()
  const shareUrl = referralCode && web.status === 'configured'
    ? referralShareUrl(web.url, referralCode)
    : undefined
  const rewardedBookings = referral.referrals.reduce((total, item) => total + item.rewardedBookings, 0)

  async function createCode() {
    if (busy) return
    setBusy(true)
    setMessage('')
    try {
      await ensureReferralCode({})
      setMessage('Your referral link is ready to share.')
    } catch {
      setMessage('Your referral link could not be created. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  async function shareLink() {
    if (!referralCode) return
    setMessage('')
    try {
      await Share.share({
        message: shareUrl
          ? `Join me on Let's Be Friends: ${shareUrl}`
          : `Join me on Let's Be Friends. Use my referral code ${referralCode}.`,
      })
    } catch {
      setMessage('The share sheet could not be opened.')
    }
  }

  async function submitCode() {
    if (busy) return
    const code = normalizeReferralCode(codeInput)
    const validationError = referralCodeValidationError(code)
    if (validationError) {
      setMessage(validationError)
      return
    }
    setBusy(true)
    setMessage('')
    try {
      await attributeReferral({ code })
      setCodeInput('')
      setMessage('Referral code added. It will apply to your first completed bookings.')
    } catch {
      setMessage('That referral code could not be added. It may already be linked, or your first booking may already exist.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Screen contentStyle={styles.content}>
      <View style={styles.header}>
        <AppText variant="label" color={theme.colors.socialText}>INVITE FRIENDS</AppText>
        <AppText variant="title">Share a good thing</AppText>
        <AppText color={theme.colors.textMuted}>
          Earn 68% of our service fee on each friend's first 3 completed bookings. Friends pay the normal price.
        </AppText>
      </View>

      {message ? <AppText accessibilityLiveRegion="polite" color={theme.colors.textMuted}>{message}</AppText> : null}

      {!referral.code ? (
        <View style={[styles.card, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}>
          <AppText variant="heading">Create your referral link</AppText>
          <AppText variant="caption" color={theme.colors.textMuted}>
            Share one link. When a friend completes a booking, your credit lands in your wallet after settlement.
          </AppText>
          <ActionButton label="Create my referral link" onPress={() => void createCode()} intent="social" loading={busy} />
        </View>
      ) : (
        <View style={[styles.card, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}>
          <AppText variant="heading">Your referral code</AppText>
          <AppText variant="title" color={theme.colors.socialText}>{referral.code}</AppText>
          {shareUrl ? <AppText variant="caption" color={theme.colors.textMuted}>{shareUrl}</AppText> : null}
          <ActionButton label="Share my link" onPress={() => void shareLink()} intent="social" />
        </View>
      )}

      <View style={styles.metrics}>
        <Metric label="Friends joined" value={String(referral.referrals.length)} />
        <Metric label="Rewarded bookings" value={String(rewardedBookings)} />
        <Metric label="Credit earned" value={formatPhp(referral.totalEarnedCentavos)} />
      </View>

      {referral.referrals.length > 0 ? (
        <View style={[styles.card, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}>
          <AppText variant="heading">Your referrals</AppText>
          {referral.referrals.map((item) => (
            <View key={item._id} style={[styles.row, { borderTopColor: theme.colors.border }]}>
              <View style={styles.rowCopy}>
                <AppText variant="bodyStrong">{item.referredDisplayName}</AppText>
                <AppText variant="caption" color={theme.colors.textMuted}>
                  {item.rewardedBookings} of {item.totalRewardedBookings} bookings rewarded
                </AppText>
              </View>
              <AppText variant="caption" color={theme.colors.textMuted}>{item.status}</AppText>
            </View>
          ))}
        </View>
      ) : null}

      {referral.referredBy ? (
        <View style={[styles.card, { borderColor: theme.colors.border, backgroundColor: theme.colors.surfaceRaised }]}>
          <AppText variant="heading">You joined with {referral.referredBy.referrerDisplayName}'s code</AppText>
          <AppText variant="caption" color={theme.colors.textMuted}>
            {referral.referredBy.rewardedBookings} of {referral.referredBy.totalRewardedBookings} rewarded bookings on your account.
          </AppText>
        </View>
      ) : (
        <View style={[styles.card, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}>
          <AppText variant="heading">Have a friend's code?</AppText>
          <AppText variant="caption" color={theme.colors.textMuted}>
            Add it before your first booking. One code per account.
          </AppText>
          <TextInput
            accessibilityLabel="Referral code"
            value={codeInput}
            onChangeText={(value) => setCodeInput(value.toUpperCase())}
            placeholder="ABCD1234"
            placeholderTextColor={theme.colors.textMuted}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={12}
            editable={!busy}
            style={[
              styles.input,
              theme.typography.body,
              {
                color: theme.colors.text,
                backgroundColor: theme.colors.surfaceRaised,
                borderColor: theme.colors.border,
              },
            ]}
          />
          <ActionButton label="Add referral code" onPress={() => void submitCode()} intent="social" loading={busy} disabled={!codeInput.trim()} />
        </View>
      )}

      <ActionButton label="Return to Profile" onPress={() => router.replace('/profile')} secondary intent="self" />
    </Screen>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  const theme = useAppTheme()
  return (
    <View style={[styles.metric, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}>
      <AppText variant="caption" color={theme.colors.textMuted}>{label}</AppText>
      <AppText variant="heading">{value}</AppText>
    </View>
  )
}

function ReferralState({ title, detail, action, onPress }: { title: string; detail?: string; action?: string; onPress?: () => void }) {
  return (
    <Screen scroll={false} contentStyle={styles.state}>
      <StateView eyebrow="INVITE FRIENDS" title={title} detail={detail} actionLabel={action} onAction={onPress} intent="social" />
    </Screen>
  )
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingBottom: 32, gap: 16 },
  header: { gap: 6 },
  card: { borderWidth: 1, borderRadius: 18, padding: 16, gap: 10 },
  metrics: { gap: 8 },
  metric: { borderWidth: 1, borderRadius: 14, padding: 12, gap: 4 },
  row: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10, marginTop: 4, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  rowCopy: { flex: 1, gap: 2 },
  input: { minHeight: 48, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12 },
  state: { paddingHorizontal: 16 },
})
