import { Redirect } from 'expo-router'

import { useMobileAuth } from '@/auth/MobileAuth'
import { authCallbackDestination } from '@/auth/routeAccess'
import { HomeFeedLoadingScreen } from '@/features/social/HomeFeedLoadingScreen'

export default function AuthCallbackScreen() {
  const auth = useMobileAuth()
  const destination = authCallbackDestination(auth.status)

  return destination ? <Redirect href={destination} /> : <HomeFeedLoadingScreen />
}
