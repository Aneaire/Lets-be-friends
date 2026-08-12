import { normalizeUsername, usernameBaseFromDisplayName, usernameValidationError } from '@lets-be-friends/shared'
import { useMutation, useQuery } from 'convex/react'
import { router } from 'expo-router'
import { useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native'

import { useMobileAuth } from '@/auth/MobileAuth'
import { mobileApi } from '@/backend/client'
import { ActionButton } from '@/components/ActionButton'
import { Screen } from '@/components/Screen'
import { AppText } from '@/components/Typography'
import { useMobileMember } from '@/member/MobileMember'
import { onboardingDecision } from '@/member/onboarding'
import { useAppTheme } from '@/theme/ThemeProvider'

type OnboardingGoal = 'member' | 'friend_host'

export default function OnboardingScreen() {
  const auth = useMobileAuth()
  const member = useMobileMember()

  if (auth.status === 'signed_out') {
    return (
      <OnboardingState
        title="Sign in to continue"
        detail="Your welcome guide is connected to your member account."
        actionLabel="Sign in"
        onAction={() => router.replace('/auth')}
      />
    )
  }
  if (auth.status === 'demo') {
    return <OnboardingState title="Demo mode" detail="Live member onboarding is unavailable in this preview." />
  }
  if (auth.status === 'setup_error') return <OnboardingState title="Account services unavailable" detail="Live member onboarding is unavailable in this build." />
  if (auth.status === 'loading' || member.status === 'loading' || member.status === 'syncing') {
    return <OnboardingState title="Preparing your account" detail="Securely connecting your member profile." loading />
  }
  if (member.status === 'unavailable' || member.status === 'error') {
    return <OnboardingState title="Member setup is unavailable" detail={member.message} />
  }
  if (member.status !== 'ready') {
    return <OnboardingState title="Sign in to continue" detail="Your member account is not available yet." />
  }

  return <ConnectedOnboarding viewer={member.viewer} onSignOut={auth.signOut} />
}

function ConnectedOnboarding({
  viewer,
  onSignOut,
}: {
  viewer: Extract<ReturnType<typeof useMobileMember>, { status: 'ready' }>['viewer']
  onSignOut: () => Promise<void>
}) {
  const theme = useAppTheme()
  const decision = onboardingDecision(viewer)
  const [usernameInput, setUsernameInput] = useState(() => viewer.username || usernameBaseFromDisplayName(viewer.displayName))
  const [goal, setGoal] = useState<OnboardingGoal>(viewer.onboardingGoal || 'member')
  const [submitting, setSubmitting] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const normalizedUsername = normalizeUsername(usernameInput)
  const validationError = viewer.username ? null : usernameValidationError(normalizedUsername)
  const availability = useQuery(
    mobileApi.users.usernameAvailability,
    !viewer.username && !validationError ? { username: normalizedUsername } : 'skip',
  )
  const claimUsername = useMutation(mobileApi.users.claimUsername)
  const completeOnboarding = useMutation(mobileApi.users.completeOnboarding)
  const usernameReady = Boolean(viewer.username || (!validationError && availability?.available))
  const availabilityColor = usernameReady
    ? theme.colors.self
    : validationError || availability?.available === false
      ? theme.colors.danger
      : theme.colors.textMuted
  const availabilityMessage = useMemo(() => {
    if (viewer.username) return 'Your permanent username is already set.'
    if (validationError) return validationError
    if (availability === undefined) return 'Checking username availability.'
    if (!availability.available) return availability.validationError || 'That username is already taken.'
    return `@${availability.username} is available.`
  }, [availability, validationError, viewer.username])

  useEffect(() => {
    if (decision === 'complete') router.replace('/profile')
  }, [decision])

  async function finishOnboarding() {
    if (!usernameReady || submitting) return

    setSubmitting(true)
    setMessage(null)
    try {
      if (!viewer.username) await claimUsername({ username: normalizedUsername })
      await completeOnboarding({ goal })
      setSubmitted(true)
      setMessage('Your welcome guide is complete. Opening your profile.')
    } catch {
      setMessage('Your welcome guide could not be saved. Please review your choices and try again.')
    } finally {
      setSubmitting(false)
    }
  }

  async function signOutToSwitchAccount() {
    if (submitting || signingOut) return

    setSigningOut(true)
    setMessage(null)
    try {
      await onSignOut()
      router.replace('/auth')
    } catch {
      setMessage('Sign out could not be completed. Please try again.')
      setSigningOut(false)
    }
  }

  return (
    <Screen contentStyle={styles.content} keyboardDismissMode="on-drag">
      <View style={styles.header}>
        <AppText variant="label" color={theme.colors.self}>WELCOME GUIDE</AppText>
        <AppText variant="display" style={styles.heroTitle}>Make this profile yours.</AppText>
        <AppText color={theme.colors.textMuted} style={styles.heroCopy}>
          Claim your permanent username and choose how you want to start.
        </AppText>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <AppText variant="heading">Choose your username</AppText>
          <AppText variant="caption" color={theme.colors.textMuted}>
            This is permanent once you claim it.
          </AppText>
        </View>
        <View style={[styles.usernameRow, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <AppText variant="bodyStrong" color={theme.colors.self}>@</AppText>
          <TextInput
            accessibilityLabel="Permanent username"
            autoCapitalize="none"
            autoComplete="username-new"
            autoCorrect={false}
            editable={!viewer.username && !submitting && !submitted}
            maxLength={24}
            onChangeText={setUsernameInput}
            returnKeyType="done"
            selectionColor={theme.colors.self}
            value={viewer.username || usernameInput}
            style={[styles.usernameInput, theme.typography.body, { color: theme.colors.text }]}
          />
        </View>
        <AppText
          accessibilityLiveRegion="polite"
          variant="caption"
          color={availabilityColor}
          style={styles.availability}>
          {availabilityMessage}
        </AppText>
        {!viewer.username && availability && !availability.available && !availability.validationError && (
          <AppText variant="caption" color={theme.colors.textMuted}>
            If this username is yours, sign out below and use the Google account that originally claimed it.
          </AppText>
        )}
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <AppText variant="heading">Choose your starting point</AppText>
          <AppText variant="caption" color={theme.colors.textMuted}>
            You can explore either path later.
          </AppText>
        </View>
        <GoalChoice
          label="Join as a member"
          detail="Explore verified Friend Hosts and get ready to book."
          selected={goal === 'member'}
          onPress={() => setGoal('member')}
          disabled={submitting || submitted}
        />
        <GoalChoice
          label="Become a Friend Host"
          detail="Save your interest now. Applications will open in a later update."
          selected={goal === 'friend_host'}
          onPress={() => setGoal('friend_host')}
          disabled={submitting || submitted}
        />
      </View>

      <View style={styles.actions}>
        <ActionButton
          label={submitting || submitted ? 'Saving welcome guide' : 'Complete welcome guide'}
          onPress={() => void finishOnboarding()}
          intent="self"
          disabled={!usernameReady || submitting || submitted}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Sign out and use another account"
          accessibilityHint="Returns to sign in so you can choose a different Google account"
          accessibilityState={{ disabled: submitting || submitted || signingOut }}
          disabled={submitting || submitted || signingOut}
          hitSlop={8}
          onPress={() => void signOutToSwitchAccount()}
          style={({ pressed }) => [styles.signOutLink, pressed && styles.pressed]}>
          {signingOut && <ActivityIndicator accessibilityLabel="Signing out" color={theme.colors.danger} size="small" />}
          <AppText variant="caption" color={theme.colors.danger} style={styles.signOutText}>
            {signingOut ? 'Signing out' : 'Sign out and use another account'}
          </AppText>
        </Pressable>
      </View>
      {(submitting || submitted) && (
        <ActivityIndicator
          accessibilityLabel="Saving welcome guide"
          color={theme.colors.self}
        />
      )}
      {message && (
        <View accessibilityLiveRegion="polite" style={[styles.message, { backgroundColor: theme.colors.selfSoft, borderColor: theme.colors.self }]}>
          <AppText>{message}</AppText>
        </View>
      )}
    </Screen>
  )
}

function GoalChoice({
  label,
  detail,
  selected,
  onPress,
  disabled,
}: {
  label: string
  detail: string
  selected: boolean
  onPress: () => void
  disabled: boolean
}) {
  const theme = useAppTheme()
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityHint={detail}
      accessibilityState={{ checked: selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.goal,
        { backgroundColor: selected ? theme.colors.selfSoft : theme.colors.surface, borderColor: selected ? theme.colors.self : theme.colors.border },
        pressed && styles.pressed,
      ]}>
      <View style={[styles.radio, { borderColor: selected ? theme.colors.self : theme.colors.borderStrong }]}>
        {selected && <View style={[styles.radioDot, { backgroundColor: theme.colors.self }]} />}
      </View>
      <View style={styles.goalCopy}>
        <AppText variant="bodyStrong">{label}</AppText>
        <AppText variant="caption" color={theme.colors.textMuted}>{detail}</AppText>
      </View>
    </Pressable>
  )
}

function OnboardingState({
  title,
  detail,
  loading = false,
  actionLabel,
  onAction,
}: {
  title: string
  detail: string
  loading?: boolean
  actionLabel?: string
  onAction?: () => void
}) {
  const theme = useAppTheme()
  return (
    <Screen contentStyle={styles.state}>
      <AppText variant="label" color={theme.colors.self}>WELCOME GUIDE</AppText>
      <AppText variant="title">{title}</AppText>
      <AppText color={theme.colors.textMuted}>{detail}</AppText>
      {loading && <ActivityIndicator accessibilityLabel="Loading member profile" color={theme.colors.self} />}
      {actionLabel && onAction && <ActionButton label={actionLabel} onPress={onAction} intent="self" />}
    </Screen>
  )
}

const styles = StyleSheet.create({
  content: { paddingBottom: 44 },
  header: { paddingTop: 24, gap: 10 },
  heroTitle: { fontSize: 38, lineHeight: 40, letterSpacing: -1.2, maxWidth: 360 },
  heroCopy: { fontSize: 15, lineHeight: 22, maxWidth: 340 },
  section: { marginTop: 28, gap: 10 },
  sectionHeader: { gap: 3, marginBottom: 2 },
  usernameRow: { minHeight: 54, borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center' },
  usernameInput: { flex: 1, minHeight: 52, paddingHorizontal: 6 },
  availability: { fontWeight: '600' },
  goal: { minHeight: 68, borderWidth: 1, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 12 },
  radio: { width: 22, height: 22, borderWidth: 2, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 10, height: 10, borderRadius: 5 },
  goalCopy: { flex: 1, gap: 1 },
  actions: { marginTop: 30, gap: 3 },
  signOutLink: { minHeight: 44, alignSelf: 'center', paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  signOutText: { fontWeight: '600', textAlign: 'center' },
  message: { borderWidth: 1, borderRadius: 16, padding: 14 },
  pressed: { opacity: 0.76 },
  state: { flexGrow: 1, justifyContent: 'center', gap: 16 },
})
