import { DarkTheme, DefaultTheme, router, Stack, ThemeProvider, usePathname } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { useEffect } from 'react'

import { useMobileAuth } from '@/auth/MobileAuth'
import { canAccessMemberRoutes } from '@/auth/routeAccess'
import { MobileBackendProvider } from '@/backend/MobileBackendProvider'
import { SafeAreaRoot } from '@/design-system/templates/SafeAreaRoot'
import { useMobileMember } from '@/member/MobileMember'
import { isExemptOnboardingPath, onboardingDecision } from '@/member/onboarding'
import { AppThemeProvider, useAppTheme } from '@/theme/ThemeProvider'
import { useReducedMotion } from '@/utils/accessibility'
import { AppToastHost } from '@/design-system/molecules/AppToast'
import { ConnectivityBanner } from '@/design-system/molecules/ConnectivityBanner'

export default function RootLayout() {
  return (
    <AppThemeProvider>
      <SafeAreaRoot>
        <MobileBackendProvider>
          <ThemedNavigation />
        </MobileBackendProvider>
      </SafeAreaRoot>
    </AppThemeProvider>
  )
}

function ThemedNavigation() {
  const theme = useAppTheme()
  const reduceMotion = useReducedMotion()
  const dark = theme.scheme === 'dark'

  return (
    <ThemeProvider value={dark ? DarkTheme : DefaultTheme}>
      <StatusBar style={dark ? 'light' : 'dark'} />
      <ConnectivityBanner />
      <AuthenticatedNavigator reduceMotion={reduceMotion} />
      <AppToastHost />
    </ThemeProvider>
  )
}

function AuthenticatedNavigator({ reduceMotion }: { reduceMotion: boolean }) {
  const auth = useMobileAuth()
  const signedIn = canAccessMemberRoutes(auth.status)

  return (
    <>
      <AccountRouteCoordinator />
      <Stack screenOptions={{ headerShown: false, animation: reduceMotion ? 'none' : 'slide_from_right' }}>
        <Stack.Screen name="auth/callback" options={{ animation: 'none' }} />
        <Stack.Screen name="terms-and-conditions" />
        <Stack.Screen name="privacy-policy" />
        <Stack.Screen name="frienday-guide" />
        <Stack.Protected guard={!signedIn}>
          <Stack.Screen name="auth" />
        </Stack.Protected>
        <Stack.Protected guard={signedIn}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="companion-profile/[id]" />
          <Stack.Screen name="member-profile/[id]" />
          <Stack.Screen name="nearby" />
          <Stack.Screen name="onboarding" />
          <Stack.Screen name="profile-edit" />
          <Stack.Screen name="companion-finance" />
          <Stack.Screen name="booking/new" />
          <Stack.Screen name="booking/[id]" />
          <Stack.Screen name="booking-edit/[id]" />
          <Stack.Screen name="companion" />
          <Stack.Screen name="companion-bookings" />
          <Stack.Screen name="companion-booking/[id]" />
          <Stack.Screen name="conversation/[id]" />
          <Stack.Screen name="notifications" />
          <Stack.Screen name="circles/index" />
          <Stack.Screen name="circles/[id]" />
          <Stack.Screen name="post-comments/[id]" />
          <Stack.Screen name="my-posts" />
          <Stack.Screen name="settings" />
          <Stack.Screen name="wallet" />
          <Stack.Screen name="transactions" />
          <Stack.Screen name="safety" />
          <Stack.Screen name="verified" />
        </Stack.Protected>
      </Stack>
    </>
  )
}

function AccountRouteCoordinator() {
  const auth = useMobileAuth()
  const member = useMobileMember()
  const pathname = usePathname()

  useEffect(() => {
    if (auth.status !== 'signed_in' || member.status !== 'ready') return
    if (isExemptOnboardingPath(pathname)) return

    const onboardingComplete = onboardingDecision(member.viewer) === 'complete'
    if (!onboardingComplete && pathname !== '/onboarding') {
      router.replace('/onboarding')
      return
    }
    if (onboardingComplete && (pathname === '/auth' || pathname === '/onboarding')) {
      router.replace('/profile')
    }
  }, [auth.status, member, pathname])

  return null
}
