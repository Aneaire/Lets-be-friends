import { BlurView } from 'expo-blur'
import * as Haptics from 'expo-haptics'
import { router } from 'expo-router'
import type { BottomTabBarProps } from 'expo-router/js-tabs'
import { useEffect, useRef, useState, type RefObject } from 'react'
import {
  Animated,
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native'

import { AppIcon } from '@/design-system/atoms/AppIcon'
import { AppText } from '@/design-system/atoms/Typography'
import { useAppTheme } from '@/theme/ThemeProvider'
import { useReducedMotion } from '@/utils/accessibility'
import { useTabBarBlurTarget } from './TabBarBlurTarget'
import {
  sharePostRoute,
  TAB_BAR_BACKGROUND,
  TAB_BAR_BLUR_INTENSITY,
  TAB_BAR_BLUR_REDUCTION_FACTOR,
  TAB_BAR_CREATE_SIZE,
  TAB_BAR_HEIGHT,
  TAB_BAR_TINT_OVERLAY,
  tabBarBottomOffset,
  tabBadgeLabel,
  tabIsFocused,
  visibleTabBarItems,
  type TabBarItem,
} from './tabBarLayout'

const KEYBOARD_HIDE_DISTANCE = 160
const ACTIVE_SCALE = 1.1

function withAlpha(hex: string, alpha: number) {
  const value = hex.replace('#', '')
  if (value.length !== 6) return hex
  const [r, g, b] = [0, 2, 4].map((index) => parseInt(value.slice(index, index + 2), 16))
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

function tabHaptic() {
  if (Platform.OS === 'android') {
    void Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Context_Click).catch(() => undefined)
    return
  }
  if (Platform.OS === 'ios') void Haptics.selectionAsync().catch(() => undefined)
}

function createHaptic() {
  if (Platform.OS === 'android') {
    void Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Confirm).catch(() => undefined)
    return
  }
  if (Platform.OS === 'ios') {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined)
  }
}

function useKeyboardHide(reduceMotion: boolean) {
  const translation = useRef(new Animated.Value(0)).current
  const [hidden, setHidden] = useState(false)

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow'
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide'
    const show = Keyboard.addListener(showEvent, () => {
      setHidden(true)
      Animated.timing(translation, {
        toValue: 1,
        duration: reduceMotion ? 0 : 180,
        useNativeDriver: true,
      }).start()
    })
    const hide = Keyboard.addListener(hideEvent, () => {
      setHidden(false)
      Animated.timing(translation, {
        toValue: 0,
        duration: reduceMotion ? 0 : 220,
        useNativeDriver: true,
      }).start()
    })
    return () => {
      show.remove()
      hide.remove()
    }
  }, [reduceMotion, translation])

  return {
    hidden,
    offset: translation.interpolate({
      inputRange: [0, 1],
      outputRange: [0, KEYBOARD_HIDE_DISTANCE],
    }),
  }
}

function TabBarItemView({
  item,
  focused,
  badge,
  onPress,
}: {
  item: TabBarItem
  focused: boolean
  badge?: string | undefined
  onPress: () => void
}) {
  const theme = useAppTheme()
  const reduceMotion = useReducedMotion()
  const active = useRef(new Animated.Value(focused ? 1 : 0)).current

  useEffect(() => {
    if (reduceMotion) {
      active.setValue(focused ? 1 : 0)
      return
    }
    Animated.spring(active, {
      toValue: focused ? 1 : 0,
      speed: 18,
      bounciness: 6,
      useNativeDriver: true,
    }).start()
  }, [active, focused, reduceMotion])

  const color = focused
    ? item.tone === 'self'
      ? theme.colors.selfText
      : theme.colors.socialText
    : theme.colors.textMuted

  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityLabel={
        item.routeName === 'messages' && badge
          ? `${item.label}, ${badge} unread`
          : item.accessibilityLabel
      }
      accessibilityState={{ selected: focused }}
      hitSlop={6}
      onPress={onPress}
      android_ripple={
        Platform.OS === 'android'
          ? { color: withAlpha(theme.colors.text, 0.08), borderless: true, radius: 30 }
          : undefined
      }
      style={({ pressed }) => [
        styles.item,
        pressed && Platform.OS !== 'android' ? styles.pressed : null,
      ]}
    >
      <Animated.View
        style={{
          transform: [
            {
              scale: active.interpolate({
                inputRange: [0, 1],
                outputRange: [1, ACTIVE_SCALE],
              }),
            },
          ],
        }}
      >
        <AppIcon name={focused ? item.activeIcon : item.icon} color={color} size={22} />
        {badge ? (
          <View
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={[styles.badge, { backgroundColor: theme.colors.socialControl }]}
          >
            <AppText variant="caption" color={theme.colors.accentText} style={styles.badgeText}>
              {badge}
            </AppText>
          </View>
        ) : null}
      </Animated.View>
      <AppText
        numberOfLines={1}
        style={[styles.label, { color: theme.colors.text, opacity: focused ? 1 : 0.82 }]}
      >
        {item.label}
      </AppText>
    </Pressable>
  )
}

function CreateButton({
  onPress,
  dark,
}: {
  onPress: () => void
  dark: boolean
}) {
  const theme = useAppTheme()
  const reduceMotion = useReducedMotion()
  const scale = useRef(new Animated.Value(1)).current

  const animate = (toValue: number) => {
    if (reduceMotion) return
    Animated.spring(scale, {
      toValue,
      speed: 30,
      bounciness: 4,
      useNativeDriver: true,
    }).start()
  }

  return (
    <Animated.View style={[styles.createWrap, { transform: [{ scale }] }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Create a post"
        accessibilityHint="Opens the post composer on Home."
        onPressIn={() => animate(0.92)}
        onPressOut={() => animate(1)}
        onPress={onPress}
        android_ripple={
          Platform.OS === 'android'
            ? { color: 'rgba(255, 255, 255, 0.22)', borderless: true, radius: TAB_BAR_CREATE_SIZE / 2 }
            : undefined
        }
        style={[
          styles.createButton,
          Platform.OS === 'android' ? styles.createButtonAndroid : null,
          {
            backgroundColor: theme.colors.socialControl,
            shadowColor: theme.colors.social,
            shadowOpacity: dark ? 0.45 : 0.3,
          },
        ]}
      >
        <AppIcon name="add" color={theme.colors.accentText} size={28} />
      </Pressable>
    </Animated.View>
  )
}

export function AppTabBar({
  state,
  navigation,
  insets,
  showCreate,
  unreadCount,
  blurTarget,
}: BottomTabBarProps & {
  showCreate: boolean
  unreadCount: number
  blurTarget?: RefObject<View | null>
}) {
  const theme = useAppTheme()
  const reduceMotion = useReducedMotion()
  const keyboard = useKeyboardHide(reduceMotion)
  const contextBlurTarget = useTabBarBlurTarget()
  const activeBlurTarget = blurTarget ?? contextBlurTarget
  const dark = theme.scheme === 'dark'
  const items = visibleTabBarItems(state.routes.map((route) => route.name))
  const focusedRoute = state.routes[state.index]
  const half = Math.ceil(items.length / 2)
  const leftItems = showCreate ? items.slice(0, half) : items
  const rightItems = showCreate ? items.slice(half) : []
  const bottom = tabBarBottomOffset(insets.bottom)

  const renderItem = (item: TabBarItem) => {
    const route = state.routes.find((candidate) => candidate.name === item.routeName)
    if (!route) return null
    const routeFocused = route.name === focusedRoute?.name
    const visuallyFocused = tabIsFocused(item.routeName, focusedRoute?.name)
    const badge = item.routeName === 'messages' ? tabBadgeLabel(unreadCount) : undefined
    return (
      <TabBarItemView
        key={item.routeName}
        item={item}
        focused={visuallyFocused}
        badge={badge}
        onPress={() => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          })
          if (!routeFocused && !event.defaultPrevented) {
            tabHaptic()
            navigation.navigate(route.name)
          }
        }}
      />
    )
  }

  return (
    <Animated.View
      pointerEvents={keyboard.hidden ? 'none' : 'box-none'}
      style={[
        styles.overlay,
        { bottom, transform: [{ translateY: keyboard.offset }] },
      ]}
    >
      <View
        style={[
          styles.pillShadow,
          {
            backgroundColor: dark ? TAB_BAR_BACKGROUND.dark : TAB_BAR_BACKGROUND.light,
          },
          Platform.OS === 'ios' ? styles.pillShadowIos : styles.pillShadowAndroid,
          dark ? styles.pillShadowDark : null,
        ]}
      >
        <View
          style={[
            styles.pill,
            {
              height: TAB_BAR_HEIGHT,
              borderColor: dark ? 'rgba(255, 255, 255, 0.16)' : 'rgba(9, 9, 9, 0.12)',
              backgroundColor: 'transparent',
            },
          ]}
        >
          <BlurView
            pointerEvents="none"
            tint={dark ? 'systemUltraThinMaterialDark' : 'systemUltraThinMaterialLight'}
            intensity={Platform.OS === 'ios' ? TAB_BAR_BLUR_INTENSITY.ios : TAB_BAR_BLUR_INTENSITY.android}
            blurReductionFactor={TAB_BAR_BLUR_REDUCTION_FACTOR}
            {...(Platform.OS === 'android' && activeBlurTarget
              ? { blurTarget: activeBlurTarget, blurMethod: 'dimezisBlurViewSdk31Plus' as const }
              : {})}
            style={StyleSheet.absoluteFill}
          />
          <View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFill,
              {
                backgroundColor: dark ? TAB_BAR_TINT_OVERLAY.dark : TAB_BAR_TINT_OVERLAY.light,
              },
            ]}
          />
          <View role="tablist" style={styles.row}>
            {leftItems.map(renderItem)}
            {showCreate ? <View style={styles.createSpacer} /> : null}
            {rightItems.map(renderItem)}
          </View>
        </View>
      </View>
      {showCreate ? (
        <CreateButton
          dark={dark}
          onPress={() => {
            createHaptic()
            const request = sharePostRoute(Date.now())
            if (focusedRoute?.name === 'index') {
              router.setParams(request.params)
              return
            }
            router.navigate(request)
          }}
        />
      ) : null}
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 30,
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  pillShadow: {
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
    borderRadius: 999,
  },
  pill: {
    overflow: 'hidden',
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  pillShadowIos: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.16,
    shadowRadius: 24,
  },
  pillShadowDark: {
    shadowOpacity: 0.5,
  },
  pillShadowAndroid: {
    elevation: 14,
  },
  row: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  item: {
    flex: 1,
    height: TAB_BAR_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    borderRadius: 999,
  },
  pressed: {
    opacity: 0.62,
  },
  label: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
    letterSpacing: 0.1,
    textAlign: 'center',
  },
  badge: {
    position: 'absolute',
    top: -5,
    right: -11,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  badgeText: {
    fontSize: 13,
    lineHeight: 15,
    fontWeight: '800',
  },
  createSpacer: {
    width: TAB_BAR_CREATE_SIZE + 10,
  },
  createWrap: {
    position: 'absolute',
    top: -18,
    left: '50%',
    marginLeft: -(TAB_BAR_CREATE_SIZE / 2),
    width: TAB_BAR_CREATE_SIZE,
    height: TAB_BAR_CREATE_SIZE,
  },
  createButton: {
    width: TAB_BAR_CREATE_SIZE,
    height: TAB_BAR_CREATE_SIZE,
    borderRadius: TAB_BAR_CREATE_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 18,
    elevation: 10,
  },
  createButtonAndroid: {
    overflow: 'hidden',
  },
})
