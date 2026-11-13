import { Tabs } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { AppTabBar } from './AppTabBar'
import { TabBarBlurTargetProvider } from './TabBarBlurTarget'
import { TabBarInsetProvider, tabBarContentInset } from './tabBarLayout'

export function AppTabsPresentation({ signedIn, unreadCount = 0 }: { signedIn: boolean; unreadCount?: number }) {
  const insets = useSafeAreaInsets()
  const contentInset = tabBarContentInset(insets.bottom)

  return (
    <TabBarBlurTargetProvider>
      <TabBarInsetProvider value={contentInset}>
        <Tabs
          screenOptions={{ headerShown: false }}
          tabBar={(props) => (
            <AppTabBar
              {...props}
              showCreate={signedIn}
              unreadCount={unreadCount}
            />
          )}>
          <Tabs.Screen name="index" options={{ title: 'Home' }} />
          <Tabs.Screen name="explore" options={{ title: 'Explore Companions' }} />
          <Tabs.Protected guard={signedIn}>
            <Tabs.Screen name="bookings" options={{ title: 'Bookings' }} />
            <Tabs.Screen name="messages" options={{ title: 'Messages' }} />
          </Tabs.Protected>
          <Tabs.Screen name="profile" options={{ title: 'Profile and settings' }} />
        </Tabs>
      </TabBarInsetProvider>
    </TabBarBlurTargetProvider>
  )
}
