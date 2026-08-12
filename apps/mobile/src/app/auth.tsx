import { useSignIn, useSignUp, useSSO } from '@clerk/expo'
import * as AuthSession from 'expo-auth-session'
import { router } from 'expo-router'
import * as WebBrowser from 'expo-web-browser'
import { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native'

import { useMobileAuth } from '@/auth/MobileAuth'
import { safeAuthErrorMessage } from '@/auth/errors'
import { googleOAuthNextStep } from '@/auth/googleOAuth'
import { ActionButton } from '@/components/ActionButton'
import { Brand } from '@/components/Brand'
import { Screen } from '@/components/Screen'
import { AppText } from '@/components/Typography'
import { useAppTheme } from '@/theme/ThemeProvider'

type AuthMode = 'sign_in' | 'sign_up'
type AuthStep = 'credentials' | 'client_trust' | 'email_verification'

WebBrowser.maybeCompleteAuthSession()

export default function AuthScreen() {
  const auth = useMobileAuth()
  const theme = useAppTheme()

  if (auth.status === 'loading') return <AuthState title="Preparing sign in" detail="Loading secure account access." loading />
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
  if (auth.status === 'demo') {
    return (
      <AuthState
        title="Sign in is not configured"
        detail="This preview does not include live account access. You can continue exploring the clearly labeled demo experience."
      />
    )
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <ClerkAuthForm />
    </KeyboardAvoidingView>
  )
}

function ClerkAuthForm() {
  const theme = useAppTheme()
  const { signIn, fetchStatus: signInFetchStatus } = useSignIn()
  const { signUp, fetchStatus: signUpFetchStatus } = useSignUp()
  const { startSSOFlow } = useSSO()
  const [mode, setMode] = useState<AuthMode>('sign_in')
  const [step, setStep] = useState<AuthStep>('credentials')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [googleSubmitting, setGoogleSubmitting] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const credentialsBusy = submitting || signInFetchStatus === 'fetching' || signUpFetchStatus === 'fetching'
  const busy = googleSubmitting || credentialsBusy
  const isSignIn = mode === 'sign_in'

  useEffect(() => {
    if (Platform.OS !== 'android') return
    void WebBrowser.warmUpAsync()
    return () => {
      void WebBrowser.coolDownAsync()
    }
  }, [])

  function changeMode(nextMode: AuthMode) {
    setMode(nextMode)
    setStep('credentials')
    setCode('')
    setMessage(null)
    void signIn.reset()
    void signUp.reset()
  }

  async function startGoogleOAuth() {
    setGoogleSubmitting(true)
    setMessage(null)
    try {
      const result = await startSSOFlow({
        strategy: 'oauth_google',
        redirectUrl: AuthSession.makeRedirectUri({ scheme: 'letsbefriends', path: 'auth/callback' }),
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
            if (!session.currentTask) router.replace('/onboarding')
          },
        })
        return
      }
      if (nextStep === 'cancelled') {
        setMessage('Google sign in was canceled.')
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
      setGoogleSubmitting(false)
    }
  }

  async function submitCredentials() {
    const normalizedEmail = email.trim().toLowerCase()
    if (!normalizedEmail.includes('@')) {
      setMessage('Enter a valid email address.')
      return
    }
    if (password.length < 8) {
      setMessage('Password must have at least 8 characters.')
      return
    }

    setSubmitting(true)
    setMessage(null)
    try {
      if (isSignIn) {
        const result = await signIn.password({ emailAddress: normalizedEmail, password })
        if (result.error) {
          setMessage(safeAuthErrorMessage(result.error, 'sign_in'))
          return
        }
        await continueSignIn()
      } else {
        const result = await signUp.password({ emailAddress: normalizedEmail, password })
        if (result.error) {
          setMessage(safeAuthErrorMessage(result.error, 'sign_up'))
          return
        }
        if (signUp.status === 'complete') {
          await finalizeSignUp()
          return
        }
        const verification = await signUp.verifications.sendEmailCode()
        if (verification.error) {
          setMessage(safeAuthErrorMessage(verification.error, 'verification'))
          return
        }
        setStep('email_verification')
        setMessage('Enter the verification code sent to your email.')
      }
    } catch (error) {
      setMessage(safeAuthErrorMessage(error, isSignIn ? 'sign_in' : 'sign_up'))
    } finally {
      setSubmitting(false)
    }
  }

  async function continueSignIn() {
    if (signIn.status === 'complete') {
      const result = await signIn.finalize()
      if (result.error) {
        setMessage(safeAuthErrorMessage(result.error, 'sign_in'))
        return
      }
      router.replace('/onboarding')
      return
    }
    if (signIn.status === 'needs_client_trust' || signIn.status === 'needs_second_factor') {
      const result = await signIn.mfa.sendEmailCode()
      if (result.error) {
        setMessage(safeAuthErrorMessage(result.error, 'verification'))
        return
      }
      setStep('client_trust')
      setMessage('Confirm this device with the code sent to your email.')
      return
    }
    setMessage('This account requires a sign-in step that is not available in this app yet.')
  }

  async function verifyCode() {
    const normalizedCode = code.trim()
    if (normalizedCode.length < 4) {
      setMessage('Enter the complete verification code.')
      return
    }

    setSubmitting(true)
    setMessage(null)
    try {
      if (step === 'client_trust') {
        const result = await signIn.mfa.verifyEmailCode({ code: normalizedCode })
        if (result.error) {
          setMessage(safeAuthErrorMessage(result.error, 'verification'))
          return
        }
        await continueSignIn()
      } else {
        const result = await signUp.verifications.verifyEmailCode({ code: normalizedCode })
        if (result.error) {
          setMessage(safeAuthErrorMessage(result.error, 'verification'))
          return
        }
        if (signUp.status !== 'complete') {
          setMessage('Your account needs an additional sign-up step that is not available in this app yet.')
          return
        }
        await finalizeSignUp()
      }
    } catch (error) {
      setMessage(safeAuthErrorMessage(error, 'verification'))
    } finally {
      setSubmitting(false)
    }
  }

  async function finalizeSignUp() {
    const result = await signUp.finalize()
    if (result.error) {
      setMessage(safeAuthErrorMessage(result.error, 'sign_up'))
      return
    }
    router.replace('/onboarding')
  }

  async function resendCode() {
    setSubmitting(true)
    setMessage(null)
    try {
      const result = step === 'client_trust'
        ? await signIn.mfa.sendEmailCode()
        : await signUp.verifications.sendEmailCode()
      setMessage(result.error
        ? safeAuthErrorMessage(result.error, 'verification')
        : 'A new verification code was sent.')
    } catch (error) {
      setMessage(safeAuthErrorMessage(error, 'verification'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Screen
      contentStyle={styles.content}
      keyboardDismissMode="on-drag"
      keyboardShouldPersistTaps="handled">
      <View style={styles.brand}><Brand compact /></View>
      <View style={styles.header}>
        <AppText variant="label" color={theme.colors.self}>ACCOUNT</AppText>
        <AppText variant="display">
          {step === 'credentials' ? (isSignIn ? 'Welcome back.' : 'Create your account.') : 'Check your email.'}
        </AppText>
        <AppText color={theme.colors.textMuted}>
          {step === 'credentials'
            ? (isSignIn ? 'Sign in with your email and password.' : 'Use email and password to begin your member profile.')
            : 'Enter the code to finish secure account access.'}
        </AppText>
      </View>

      {step === 'credentials' ? (
        <View style={styles.form}>
          <ActionButton
            label={googleSubmitting ? 'Opening Google' : 'Continue with Google'}
            accessibilityHint="Opens Google sign in in your browser"
            onPress={() => void startGoogleOAuth()}
            intent="self"
            secondary
            disabled={busy}
          />
          <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.divider}>
            <View style={[styles.dividerLine, { backgroundColor: theme.colors.border }]} />
            <AppText variant="label" color={theme.colors.textMuted}>OR</AppText>
            <View style={[styles.dividerLine, { backgroundColor: theme.colors.border }]} />
          </View>
          <FormField
            label="Email"
            value={email}
            onChangeText={setEmail}
            editable={!busy}
            keyboardType="email-address"
            autoComplete="email"
            textContentType="emailAddress"
            returnKeyType="next"
          />
          <FormField
            label="Password"
            value={password}
            onChangeText={setPassword}
            editable={!busy}
            secureTextEntry
            autoComplete={isSignIn ? 'current-password' : 'new-password'}
            textContentType={isSignIn ? 'password' : 'newPassword'}
            returnKeyType="done"
            onSubmitEditing={() => { if (!busy) void submitCredentials() }}
          />
          <ActionButton
            label={credentialsBusy ? (isSignIn ? 'Signing in' : 'Creating account') : (isSignIn ? 'Sign in' : 'Create account')}
            onPress={() => void submitCredentials()}
            intent="self"
            disabled={busy}
          />
        </View>
      ) : (
        <View style={styles.form}>
          <FormField
            label="Verification code"
            value={code}
            onChangeText={setCode}
            editable={!busy}
            keyboardType="number-pad"
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
            returnKeyType="done"
            onSubmitEditing={() => { if (!busy) void verifyCode() }}
          />
          <ActionButton
            label={busy ? 'Verifying' : 'Verify code'}
            onPress={() => void verifyCode()}
            intent="self"
            disabled={busy}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Send a new verification code"
            disabled={busy}
            onPress={() => void resendCode()}
            style={styles.textButton}>
            <AppText variant="bodyStrong" color={theme.colors.self}>Send a new code</AppText>
          </Pressable>
        </View>
      )}

      {busy && <ActivityIndicator accessibilityLabel="Authentication in progress" color={theme.colors.self} />}
      {message && (
        <View accessibilityLiveRegion="polite" style={[styles.message, { backgroundColor: theme.colors.selfSoft, borderColor: theme.colors.self }]}>
          <AppText>{message}</AppText>
        </View>
      )}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={isSignIn ? 'Create an account instead' : 'Sign in instead'}
        disabled={busy}
        onPress={() => changeMode(isSignIn ? 'sign_up' : 'sign_in')}
        style={styles.modeButton}>
        <AppText color={theme.colors.textMuted}>{isSignIn ? 'New here?' : 'Already have an account?'}</AppText>
        <AppText variant="bodyStrong" color={theme.colors.self}>{isSignIn ? ' Create account' : ' Sign in'}</AppText>
      </Pressable>
    </Screen>
  )
}

function FormField({ label, ...props }: { label: string } & React.ComponentProps<typeof TextInput>) {
  const theme = useAppTheme()
  return (
    <View style={styles.field}>
      <AppText variant="label">{label}</AppText>
      <TextInput
        accessibilityLabel={label}
        autoCapitalize="none"
        autoCorrect={false}
        placeholderTextColor={theme.colors.textMuted}
        selectionColor={theme.colors.self}
        {...props}
        style={[
          styles.input,
          theme.typography.body,
          { color: theme.colors.text, backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
          props.style,
        ]}
      />
    </View>
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
    <Screen contentStyle={styles.state}>
      <AppText variant="label" color={theme.colors.self}>ACCOUNT</AppText>
      <AppText variant="title">{title}</AppText>
      <AppText color={theme.colors.textMuted}>{detail}</AppText>
      {loading && <ActivityIndicator accessibilityLabel="Loading account" color={theme.colors.self} />}
      {actionLabel && onAction && <ActionButton label={actionLabel} onPress={onAction} intent="self" />}
    </Screen>
  )
}

const styles = StyleSheet.create({
  content: { paddingBottom: 56 },
  brand: { paddingTop: 20 },
  header: { paddingTop: 42, gap: 14 },
  form: { marginTop: 30, gap: 18 },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dividerLine: { flex: 1, height: 1 },
  field: { gap: 8 },
  input: { minHeight: 54, borderWidth: 1, borderRadius: 16, paddingHorizontal: 16 },
  message: { borderWidth: 1, borderRadius: 16, padding: 14, marginTop: 18 },
  textButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  modeButton: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 22 },
  state: { flexGrow: 1, justifyContent: 'center', gap: 16 },
})
