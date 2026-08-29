import { Redirect } from 'expo-router'

import { useMobileAuth } from '@/auth/MobileAuth'
import { authCallbackDestination } from '@/auth/routeAccess'
import { StartupLoadingScreen } from '@/design-system/templates/StartupLoadingScreen'

export default function AuthCallbackScreen() {
  const auth = useMobileAuth()
  const destination = authCallbackDestination(auth.status)

  return destination ? <Redirect href={destination} /> : <StartupLoadingScreen />
}
