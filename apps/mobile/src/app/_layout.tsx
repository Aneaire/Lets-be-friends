import { DarkTheme, DefaultTheme, router, Stack, ThemeProvider, usePathname } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { useEffect } from 'react'
import { useColorScheme } from 'react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'

import { useMobileAuth } from '@/auth/MobileAuth'
import { MobileBackendProvider } from '@/backend/MobileBackendProvider'
import { useMobileMember } from '@/member/MobileMember'
import { onboardingDecision } from '@/member/onboarding'
import { AppThemeProvider } from '@/theme/ThemeProvider'
import { useReducedMotion } from '@/utils/accessibility'

export default function RootLayout() {
  const scheme = useColorScheme()
  const reduceMotion = useReducedMotion()
  const dark = scheme === 'dark'

  return (
    <SafeAreaProvider>
      <MobileBackendProvider>
        <AppThemeProvider>
          <ThemeProvider value={dark ? DarkTheme : DefaultTheme}>
            <StatusBar style={dark ? 'light' : 'dark'} />
            <AccountRouteCoordinator />
            <Stack screenOptions={{ headerShown: false, animation: reduceMotion ? 'none' : 'slide_from_right' }}>
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="auth" />
              <Stack.Screen name="onboarding" />
              <Stack.Screen name="companion-profile/[id]" />
              <Stack.Screen name="booking/new" />
              <Stack.Screen name="booking/[id]" />
              <Stack.Screen name="booking-edit/[id]" />
              <Stack.Screen name="bookings" />
              <Stack.Screen name="companion" />
              <Stack.Screen name="companion-bookings" />
              <Stack.Screen name="companion-booking/[id]" />
              <Stack.Screen name="conversation/[id]" />
              <Stack.Screen name="wallet" />
            </Stack>
          </ThemeProvider>
        </AppThemeProvider>
      </MobileBackendProvider>
    </SafeAreaProvider>
  )
}

function AccountRouteCoordinator() {
  const auth = useMobileAuth()
  const member = useMobileMember()
  const pathname = usePathname()

  useEffect(() => {
    if (auth.status !== 'signed_in' || member.status !== 'ready') return

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
