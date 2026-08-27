import { StyleSheet, View } from 'react-native'

import { Brand } from '@/design-system/atoms/Brand'
import { FeedSkeleton, HomeHeaderActionsSkeleton, PostComposerSkeleton } from '@/design-system/atoms/Skeleton'
import { AppText } from '@/design-system/atoms/Typography'
import { SegmentedControl } from '@/design-system/molecules/SegmentedControl'
import { Screen } from '@/design-system/templates/Screen'
import { useAppTheme } from '@/theme/ThemeProvider'

const loadingFeedFilters = [
  { value: 'for_you', label: 'For you' },
  { value: 'following', label: 'Following' },
  { value: 'saved', label: 'Saved' },
] as const

export function HomeFeedLoadingScreen() {
  const theme = useAppTheme()

  return (
    <Screen scroll={false} contentStyle={styles.screen}>
      <View style={styles.content}>
        <View style={styles.topBar}>
          <View style={styles.titleCopy}>
            <Brand compact />
            <AppText variant="caption" color={theme.colors.textMuted} numberOfLines={1}>
              Everyday help, useful ideas, and real connections
            </AppText>
          </View>
          <HomeHeaderActionsSkeleton />
        </View>
        <PostComposerSkeleton />
        <SegmentedControl
          label="Loading community feed"
          options={loadingFeedFilters.map((option) => ({ ...option }))}
          value="for_you"
          onChange={() => undefined}
          tone="social"
          style={styles.feedFilter}
        />
        <View style={styles.feed}>
          <FeedSkeleton />
          <FeedSkeleton />
          <FeedSkeleton />
        </View>
      </View>
    </Screen>
  )
}

const styles = StyleSheet.create({
  screen: { paddingHorizontal: 0, paddingBottom: 0 },
  content: { paddingHorizontal: 14, paddingBottom: 32 },
  topBar: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  titleCopy: { flex: 1, minWidth: 0, gap: 1 },
  feedFilter: { marginVertical: 10 },
  feed: { gap: 8 },
})
