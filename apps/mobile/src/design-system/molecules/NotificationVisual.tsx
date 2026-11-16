import { StyleSheet, View } from 'react-native'

import { notificationInitials, notificationVisualIcon } from '@/data/notifications'
import { AppIcon } from '@/design-system/atoms/AppIcon'
import { Avatar } from '@/design-system/atoms/Avatar'
import { AppText } from '@/design-system/atoms/Typography'
import { useAppTheme } from '@/theme/ThemeProvider'

export type NotificationActor = {
  displayName: string
  profileImageUrl?: string
}

export type NotificationVisualTone = 'neutral' | 'self' | 'social' | 'danger'

const MAX_STACKED_ACTORS = 3

/**
 * The identity rail for a notification row. A single actor shows one portrait.
 * An aggregated notification stacks up to three portraits, most recent first,
 * with the newest portrait in front. Notifications without an actor fall back
 * to a neutral system chip. A small badge names the reason for the update.
 */
export function NotificationVisual({
  actors,
  kind,
  tone = 'neutral',
  size = 42,
  ringColor,
}: {
  actors?: NotificationActor[]
  kind?: string
  tone?: NotificationVisualTone
  size?: number
  ringColor: string
}) {
  const theme = useAppTheme()
  const accent = tone === 'social'
    ? theme.colors.socialControl
    : tone === 'self'
      ? theme.colors.selfControl
      : tone === 'danger'
        ? theme.colors.danger
        : theme.colors.inverse
  const badgeTextColor = tone === 'neutral' ? theme.colors.inverseText : theme.colors.accentText
  const icon = notificationVisualIcon(kind)
  const visibleActors = (actors ?? []).filter((actor) => actor.displayName).slice(0, MAX_STACKED_ACTORS)
  const ringWidth = 2
  const slot = size + ringWidth * 2
  const hasInitialsFallback = visibleActors.some((actor) => !actor.profileImageUrl)
  const step = Math.round(slot * (hasInitialsFallback ? 0.42 : 0.34))
  const initialsShift = Math.max(0, Math.round((slot - step) / 2) - 1)
  const initialsFontSize = Math.max(11, Math.round(size * 0.29))
  const width = visibleActors.length > 1
    ? step * (visibleActors.length - 1) + slot
    : slot

  if (!visibleActors.length) {
    return (
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={[
          styles.system,
          {
            width: slot,
            height: slot,
            borderRadius: slot / 2,
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.border,
          },
        ]}>
        <AppIcon name={icon} color={accent} size={Math.round(size * 0.46)} />
      </View>
    )
  }

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.stack, { width, height: slot }]}>
      {visibleActors.map((actor, index) => (
        <View
          key={`${actor.displayName}-${index}`}
          style={[
            styles.slot,
            {
              left: index * step,
              width: slot,
              height: slot,
              borderRadius: slot / 2,
              backgroundColor: ringColor,
              zIndex: visibleActors.length - index,
            },
          ]}>
          {actor.profileImageUrl ? (
            <Avatar uri={actor.profileImageUrl} name={actor.displayName} size={size} />
          ) : (
            <View
              style={[
                styles.initials,
                {
                  width: size,
                  height: size,
                  borderRadius: size / 2,
                  backgroundColor: theme.colors.border,
                  borderColor: theme.colors.borderStrong,
                },
              ]}>
              <AppText
                variant="label"
                color={theme.colors.text}
                style={[
                  { fontSize: initialsFontSize, letterSpacing: 0.2 },
                  index > 0 ? { transform: [{ translateX: initialsShift }] } : undefined,
                ]}>
                {notificationInitials(actor.displayName)}
              </AppText>
            </View>
          )}
        </View>
      ))}
      <View
        style={[
          styles.badge,
          {
            backgroundColor: accent,
            borderColor: ringColor,
          },
        ]}>
        <AppIcon name={icon} color={badgeTextColor} size={10} />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  stack: { position: 'relative' },
  slot: { position: 'absolute', top: 0, alignItems: 'center', justifyContent: 'center' },
  system: { borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  initials: { borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  badge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
})
