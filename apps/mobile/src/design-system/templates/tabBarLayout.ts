import { createContext, useContext } from 'react'

import type { AppIconName } from '@/design-system/atoms/AppIcon'

export const TAB_BAR_HEIGHT = 58
export const TAB_BAR_BOTTOM_GAP = 2
export const TAB_BAR_CREATE_SIZE = 56
export const TAB_BAR_CONTENT_GAP = 16

/**
 * Floating bar stays translucent so content visibly blurs behind it.
 * Alphas are intentionally low; the native blur provides legibility, not
 * an opaque fill. Keep both themes neutral black/white.
 */
export const TAB_BAR_BACKGROUND = {
  light: 'rgba(255, 255, 255, 0.18)',
  dark: 'rgba(30, 30, 30, 0.28)',
} as const

export const TAB_BAR_TINT_OVERLAY = {
  light: 'rgba(255, 255, 255, 0.04)',
  dark: 'rgba(30, 30, 30, 0.06)',
} as const

export const TAB_BAR_BLUR_INTENSITY = {
  ios: 85,
  android: 100,
} as const

export const TAB_BAR_BLUR_REDUCTION_FACTOR = 1

export type TabBarItem = {
  routeName: string
  label: string
  accessibilityLabel: string
  icon: AppIconName
  activeIcon: AppIconName
  tone: 'social' | 'self'
}

/**
 * Four frequent destinations sit around the raised Create action. Bookings
 * stays registered as a tab route so it remains deep-linkable and reachable
 * from the quick actions and the Profile screen, but it is not one of the four
 * visible destinations.
 */
export const TAB_BAR_ITEMS: TabBarItem[] = [
  {
    routeName: 'index',
    label: 'Home',
    accessibilityLabel: 'Home tab',
    icon: 'home-outline',
    activeIcon: 'home',
    tone: 'social',
  },
  {
    routeName: 'explore',
    label: 'Explore',
    accessibilityLabel: 'Explore Companions tab',
    icon: 'compass-outline',
    activeIcon: 'compass',
    tone: 'social',
  },
  {
    routeName: 'messages',
    label: 'Messages',
    accessibilityLabel: 'Messages tab',
    icon: 'chatbubbles-outline',
    activeIcon: 'chatbubbles',
    tone: 'social',
  },
  {
    routeName: 'profile',
    label: 'Profile',
    accessibilityLabel: 'Profile and settings tab',
    icon: 'person-circle-outline',
    activeIcon: 'person-circle',
    tone: 'self',
  },
]

export function tabBarBottomOffset(bottomInset: number) {
  // Sit close to the gesture area instead of leaving a second gap below the
  // safe inset. The 10px reduction keeps the bar clear of the home indicator
  // while pulling it visually closer to the bottom edge.
  return Math.max(bottomInset - 10, 6) + TAB_BAR_BOTTOM_GAP
}

export function tabBarContentInset(bottomInset: number) {
  return tabBarBottomOffset(bottomInset) + TAB_BAR_HEIGHT + TAB_BAR_CONTENT_GAP
}

export function visibleTabBarItems(routeNames: readonly string[]) {
  const available = new Set(routeNames)
  return TAB_BAR_ITEMS.filter((item) => available.has(item.routeName))
}

export function tabBadgeLabel(count: number) {
  if (count <= 0) return undefined
  return count > 99 ? '99+' : String(count)
}

export function tabIsFocused(routeName: string, focusedRouteName: string | undefined) {
  if (routeName === focusedRouteName) return true
  // Bookings is reached from Profile, so the Profile tab stays lit there.
  return routeName === 'profile' && focusedRouteName === 'bookings'
}

export function sharePostRoute(now: number) {
  return { pathname: '/' as const, params: { compose: String(now) } }
}

export const QUICK_ACTION_ROUTES = {
  sharePost: sharePostRoute,
  findCompanion: () => '/nearby' as const,
  viewBookings: () => '/bookings' as const,
}

const TabBarInsetContext = createContext(0)

export const TabBarInsetProvider = TabBarInsetContext.Provider

export function useTabBarInset() {
  return useContext(TabBarInsetContext)
}
