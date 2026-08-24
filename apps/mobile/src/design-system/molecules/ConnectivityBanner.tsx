import NetInfo from '@react-native-community/netinfo'
import { useEffect, useState } from 'react'
import { StyleSheet, View } from 'react-native'

import { useAppTheme } from '@/theme/ThemeProvider'

import { AppIcon } from '@/design-system/atoms/AppIcon'
import { AppText } from '@/design-system/atoms/Typography'

export function ConnectivityBanner() {
  const [offline, setOffline] = useState(false)

  useEffect(
    () => NetInfo.addEventListener(
      (state) => setOffline(state.isConnected === false),
    ),
    [],
  )

  return <ConnectivityBannerPresentation offline={offline} />
}

export function ConnectivityBannerPresentation({
  offline,
}: {
  offline: boolean
}) {
  const theme = useAppTheme()

  if (!offline) return null

  return (
    <View
      accessibilityRole="alert"
      accessibilityLiveRegion="assertive"
      style={[
        styles.banner,
        { backgroundColor: theme.colors.inverse },
      ]}>
      <AppIcon
        name="cloud-offline-outline"
        color={theme.colors.inverseText}
        size={18}
      />
      <AppText
        variant="caption"
        color={theme.colors.inverseText}
        style={styles.copy}>
        You are offline. Some updates will appear when you reconnect.
      </AppText>
    </View>
  )
}

const styles = StyleSheet.create({
  banner: {
    minHeight: 40,
    paddingHorizontal: 16,
    paddingVertical: 9,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  copy: { flexShrink: 1 },
})
