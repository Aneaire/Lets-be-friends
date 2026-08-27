import { Redirect } from 'expo-router'

import { useMobileAuth } from '@/auth/MobileAuth'
import { HomeFeedLoadingScreen } from '@/features/social/HomeFeedLoadingScreen'

export default function AuthCallbackScreen() {
  const auth = useMobileAuth()
  if (auth.status === 'signed_in') return <Redirect href="/" />
  return <HomeFeedLoadingScreen />
}
