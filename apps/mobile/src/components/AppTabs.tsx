import { useQuery } from 'convex/react'
import { Tabs } from 'expo-router'
import { Image, type ColorValue, type ImageSourcePropType } from 'react-native'

import { mobileApi } from '@/backend/client'
import { aggregateUnreadCount } from '@/data/messageViewModels'
import { useMobileMember } from '@/member/MobileMember'
import { useAppTheme } from '@/theme/ThemeProvider'

const tabIcons = {
  index: require('../../assets/images/tab-home.png') as ImageSourcePropType,
  explore: require('../../assets/images/tab-explore.png') as ImageSourcePropType,
  messages: require('../../assets/images/tab-messages.png') as ImageSourcePropType,
  profile: require('../../assets/images/tab-profile.png') as ImageSourcePropType,
} as const

function TabIcon({ source, color, size }: { source: ImageSourcePropType; color: ColorValue; size: number }) {
  return <Image source={source} resizeMode="contain" style={{ width: size, height: size, tintColor: color }} />
}

export default function AppTabs() {
  const member = useMobileMember()
  return member.status === 'ready' ? <ReadyMemberTabs /> : <TabsView />
}

function ReadyMemberTabs() {
  const conversations = useQuery(mobileApi.conversations.list, {})
  return <TabsView unreadCount={conversations ? aggregateUnreadCount(conversations) : 0} />
}

function TabsView({ unreadCount = 0 }: { unreadCount?: number }) {
  const theme = useAppTheme()

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.social,
        tabBarInactiveTintColor: theme.colors.textMuted,
        tabBarHideOnKeyboard: true,
        tabBarStyle: {
          backgroundColor: theme.colors.surfaceRaised,
          borderTopColor: theme.colors.border,
          minHeight: 68,
          paddingTop: 6,
          paddingBottom: 6,
        },
        tabBarBadgeStyle: { backgroundColor: theme.colors.social, color: theme.colors.accentText },
        tabBarLabelStyle: theme.typography.caption,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarAccessibilityLabel: 'Home tab',
          tabBarIcon: ({ color, size }) => <TabIcon source={tabIcons.index} color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: 'Explore',
          tabBarAccessibilityLabel: 'Explore Companions tab',
          tabBarIcon: ({ color, size }) => <TabIcon source={tabIcons.explore} color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: 'Messages',
          tabBarAccessibilityLabel: unreadCount ? `Messages tab, ${unreadCount} unread` : 'Messages tab',
          tabBarBadge: unreadCount > 0 ? unreadCount : undefined,
          tabBarIcon: ({ color, size }) => <TabIcon source={tabIcons.messages} color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarAccessibilityLabel: 'Profile and settings tab',
          tabBarActiveTintColor: theme.colors.self,
          tabBarIcon: ({ color, size }) => <TabIcon source={tabIcons.profile} color={color} size={size} />,
        }}
      />
    </Tabs>
  )
}
