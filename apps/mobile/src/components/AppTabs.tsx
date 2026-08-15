import { useQuery } from 'convex/react'
import { Tabs } from 'expo-router'
import type { ComponentProps } from 'react'
import { Pressable, StyleSheet, type ColorValue } from 'react-native'

import { mobileApi } from '@/backend/client'
import { aggregateUnreadCount } from '@/data/messageViewModels'
import { useMobileMember } from '@/member/MobileMember'
import { useAppTheme } from '@/theme/ThemeProvider'

import { AppIcon, type AppIconName } from './AppIcon'

function TabIcon({ name, color, size }: { name: AppIconName; color: ColorValue; size: number }) {
  return <AppIcon name={name} color={color} size={size} />
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
        tabBarShowLabel: false,
        tabBarButton: ({ style, ...props }) => <Pressable {...(props as ComponentProps<typeof Pressable>)} style={({ pressed }) => [style, pressed && styles.pressed]} />,
        tabBarStyle: {
          backgroundColor: theme.colors.surfaceRaised,
          borderTopColor: theme.colors.border,
          minHeight: 56,
          paddingTop: 5,
          paddingBottom: 5,
        },
        tabBarBadgeStyle: { backgroundColor: theme.colors.social, color: theme.colors.accentText },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarAccessibilityLabel: 'Home tab',
          tabBarIcon: ({ color, size, focused }) => <TabIcon name={focused ? 'home' : 'home-outline'} color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: 'Explore',
          tabBarAccessibilityLabel: 'Explore Companions tab',
          tabBarIcon: ({ color, size, focused }) => <TabIcon name={focused ? 'compass' : 'compass-outline'} color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="bookings"
        options={{
          title: 'Bookings',
          tabBarAccessibilityLabel: 'Bookings tab',
          tabBarIcon: ({ color, size, focused }) => <TabIcon name={focused ? 'calendar' : 'calendar-outline'} color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: 'Messages',
          tabBarAccessibilityLabel: unreadCount ? `Messages tab, ${unreadCount} unread` : 'Messages tab',
          tabBarBadge: unreadCount > 0 ? unreadCount : undefined,
          tabBarIcon: ({ color, size, focused }) => <TabIcon name={focused ? 'chatbubbles' : 'chatbubbles-outline'} color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarAccessibilityLabel: 'Profile and settings tab',
          tabBarActiveTintColor: theme.colors.self,
          tabBarIcon: ({ color, size, focused }) => <TabIcon name={focused ? 'person-circle' : 'person-circle-outline'} color={color} size={size} />,
        }}
      />
    </Tabs>
  )
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.58 },
})
