import { useSSO } from '@clerk/expo'
import * as AuthSession from 'expo-auth-session'
import { router } from 'expo-router'
import * as WebBrowser from 'expo-web-browser'
import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { ActivityIndicator, Platform, StyleSheet, View } from 'react-native'

import { useMobileAuth } from '@/auth/MobileAuth'
import { safeAuthErrorMessage } from '@/auth/errors'
import { GOOGLE_OAUTH_REDIRECT_OPTIONS, googleOAuthNextStep } from '@/auth/googleOAuth'
import { ActionButton } from '@/design-system/atoms/ActionButton'
import { hideAppToast, showAppToast, type AppToastTone } from '@/design-system/molecules/AppToast'
import { Brand, BRAND_TAGLINE } from '@/design-system/atoms/Brand'
import { Screen } from '@/design-system/templates/Screen'
import { PageSkeleton } from '@/design-system/templates/PageSkeleton'
import { AppText } from '@/design-system/atoms/Typography'
import { useAppTheme } from '@/theme/ThemeProvider'

WebBrowser.maybeCompleteAuthSession()

export default function AuthScreen() {
  const auth = useMobileAuth()

  if (auth.status === 'loading') return <PageSkeleton variant="auth" />
  if (auth.status === 'signed_in') {
    return (
      <AuthState
        title="You are signed in"
        detail="Continue to your member account."
        actionLabel="Continue"
        onAction={() => router.replace('/onboarding')}
      />
    )
  }
  if (auth.status === 'needs_task') {
    return (
      <AuthState
        title="One more account step is required"
        detail="Your account requires an additional security step before you can continue."
        actionLabel="Sign out"
        onAction={() => void auth.signOut()}
      />
    )
  }
  if (auth.status === 'setup_error') {
    return <AuthState title="Account services unavailable" detail="Sign in is unavailable in this build." />
  }
  if (auth.status === 'unconfigured') {
    return (
      <AuthState
        title="Account services unavailable"
        detail="This build cannot connect to sign-in services. Connect account services before continuing."
      />
    )
  }

  return <GoogleAuthForm />
}

function GoogleAuthForm() {
  const theme = useAppTheme()
  const { startSSOFlow } = useSSO()
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessageState] = useState<{ text: string; tone: AppToastTone } | null>(null)

  const setMessage = useCallback((text: string | null, tone: AppToastTone = 'error') => {
    setMessageState(text ? { text, tone } : null)
  }, [])

  useEffect(() => {
    if (Platform.OS !== 'android') return
    void WebBrowser.warmUpAsync()
    return () => {
      void WebBrowser.coolDownAsync()
    }
  }, [])

  useEffect(() => {
    if (message) showAppToast(message.text, message.tone)
    else hideAppToast()
  }, [message])

  useEffect(() => () => hideAppToast(), [])

  async function startGoogleOAuth() {
    if (submitting) return
    setSubmitting(true)
    setMessage(null)
    try {
      const result = await startSSOFlow({
        strategy: 'oauth_google',
        redirectUrl: AuthSession.makeRedirectUri(GOOGLE_OAUTH_REDIRECT_OPTIONS),
      })
      const nextStep = googleOAuthNextStep(result)

      if (nextStep === 'activate_session') {
        if (!result.createdSessionId || !result.setActive) {
          setMessage('Google sign in could not be completed. Please try again.')
          return
        }
        await result.setActive({
          session: result.createdSessionId,
          navigate: async ({ session }) => {
            if (!session.currentTask) router.replace('/auth/callback' as never)
          },
        })
        return
      }
      if (nextStep === 'cancelled') {
        setMessage('Google sign in was canceled.', 'info')
        return
      }
      if (nextStep === 'additional_requirements') {
        setMessage('Your account requires an additional security step that is not available in this app yet.')
        return
      }
      setMessage('Google sign in could not be completed. Please try again.')
    } catch (error) {
      setMessage(safeAuthErrorMessage(error, 'sign_in'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthFrame>
      <View style={styles.action}>
        <ActionButton
          label="Continue with Google"
          accessibilityHint="Opens Google sign in in your browser"
          onPress={() => void startGoogleOAuth()}
          intent="self"
          icon="logo-google"
          loading={submitting}
          disabled={submitting}
        />
        <AppText variant="caption" color={theme.colors.textMuted} style={styles.centeredText}>
          We never ask for a password.
        </AppText>
      </View>
    </AuthFrame>
  )
}

function AuthFrame({ children }: { children: ReactNode }) {
  const theme = useAppTheme()

  return (
    <Screen contentStyle={styles.content}>
      <View style={styles.column}>
        <View style={styles.brandBlock}>
          <Brand size="lg" layout="stacked" />
          <AppText variant="caption" color={theme.colors.textMuted} style={styles.centeredText}>{BRAND_TAGLINE}</AppText>
        </View>
        {children}
      </View>
    </Screen>
  )
}

function AuthState({
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
    <AuthFrame>
      <View style={styles.stateBlock}>
        <View style={styles.stateCopy}>
          <AppText variant="title" accessibilityRole="header" style={styles.centeredText}>{title}</AppText>
          <AppText color={theme.colors.textMuted} style={styles.centeredText}>{detail}</AppText>
        </View>
        {loading ? <ActivityIndicator accessibilityLabel="Loading account" color={theme.colors.self} /> : null}
        {actionLabel && onAction ? <ActionButton label={actionLabel} onPress={onAction} intent="self" style={styles.stretch} /> : null}
      </View>
    </AuthFrame>
  )
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, paddingBottom: 32 },
  column: { flexGrow: 1, width: '100%', maxWidth: 420, alignSelf: 'center', justifyContent: 'center', alignItems: 'center', gap: 32 },
  brandBlock: { alignItems: 'center', gap: 8 },
  action: { width: '100%', gap: 14 },
  stateBlock: { width: '100%', alignItems: 'center', gap: 20 },
  stateCopy: { gap: 10 },
  centeredText: { textAlign: 'center' },
  stretch: { alignSelf: 'stretch' },
})
