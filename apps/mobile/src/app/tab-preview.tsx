import { useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { AppText } from '@/design-system/atoms/Typography'
import { AppTabBar } from '@/design-system/templates/AppTabBar'
import { TabBarBlurTarget, TabBarBlurTargetProvider } from '@/design-system/templates/TabBarBlurTarget'
import { useAppTheme } from '@/theme/ThemeProvider'

const routes = [
  { key: 'index', name: 'index' },
  { key: 'explore', name: 'explore' },
  { key: 'messages', name: 'messages' },
  { key: 'profile', name: 'profile' },
]

export default function TabPreviewScreen() {
  const theme = useAppTheme()
  const insets = useSafeAreaInsets()
  const [index, setIndex] = useState(0)

  return (
    <View style={styles.root}>
      <TabBarBlurTargetProvider>
        <TabBarBlurTarget>
          <View style={[styles.content, { paddingTop: insets.top + 8 }]}>
            <View style={[styles.previewPill, { borderColor: theme.colors.social, backgroundColor: theme.colors.socialSoft }]}>
              <AppText variant="label" color={theme.colors.socialText}>TAB BAR PREVIEW</AppText>
            </View>
            <AppText variant="title">Home</AppText>
            <AppText color={theme.colors.textMuted}>
              Sample content for checking the bar position. Sign in to load the real feed.
            </AppText>
            <View style={[styles.card, { borderColor: theme.colors.border, backgroundColor: theme.colors.surfaceRaised }]}>
              <AppText variant="bodyStrong">Maya Santos</AppText>
              <AppText variant="caption" color={theme.colors.textMuted}>Makati · 2h</AppText>
              <AppText>Looking for a museum buddy this weekend. Any recommendations?</AppText>
            </View>
            <View style={[styles.card, { borderColor: theme.colors.border, backgroundColor: theme.colors.surfaceRaised }]}>
              <AppText variant="bodyStrong">Alex Rivera</AppText>
              <AppText variant="caption" color={theme.colors.textMuted}>Cebu · 4h</AppText>
              <AppText>Quiet coffee walk and a bookshop stop. Who is around?</AppText>
            </View>
            <View style={[styles.feature, { borderColor: theme.colors.border, backgroundColor: theme.colors.surfaceRaised }]}>
              <AppText color={theme.colors.textMuted} style={styles.featureCopy}>
                A sample experience card sitting behind the glass bar.
              </AppText>
              <AppText variant="title" color={theme.colors.text} style={styles.blurCheck}>
                BLUR CHECK
              </AppText>
            </View>
          </View>
        </TabBarBlurTarget>
        <AppTabBar
          state={{ index, routes } as never}
          descriptors={{} as never}
          navigation={{
            emit: () => ({ defaultPrevented: false }),
            navigate: (name: string) => setIndex(Math.max(0, routes.findIndex((route) => route.name === name))),
          } as never}
          insets={insets}
          showCreate
          unreadCount={3}
        />
      </TabBarBlurTargetProvider>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { flex: 1, gap: 12, padding: 16, paddingBottom: 0 },
  previewPill: { alignSelf: 'flex-start', borderRadius: 999, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 4 },
  card: { gap: 6, borderRadius: 16, borderWidth: 1, padding: 14 },
  feature: { height: 220, justifyContent: 'flex-end', gap: 6, borderRadius: 18, borderWidth: 2, marginTop: 'auto', padding: 16, paddingBottom: 40 },
  featureCopy: { opacity: 0.82 },
  blurCheck: { letterSpacing: 1 },
})
