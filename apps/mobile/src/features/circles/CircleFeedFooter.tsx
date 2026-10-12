import { StyleSheet, View } from 'react-native'

import { ActionButton } from '@/design-system/atoms/ActionButton'
import { AppText } from '@/design-system/atoms/Typography'
import { useAppTheme } from '@/theme/ThemeProvider'

/**
 * Circle feed pagination footer. Paging is driven by near-end ScrollView
 * events from the workspace Screen (see `shouldRequestCircleFeedPage`); this
 * footer never triggers loads on mount. The button stays as the explicit and
 * assistive-technology path for the next settled `CanLoadMore` page.
 */
export function CircleFeedFooter({ status, loadLabel, onLoadMore }: {
  status: 'LoadingFirstPage' | 'CanLoadMore' | 'LoadingMore' | 'Exhausted' | string
  loadLabel: string
  onLoadMore: () => void
}) {
  const theme = useAppTheme()

  if (status === 'LoadingMore') {
    return (
      <View style={styles.footer}>
        <AppText variant="caption" color={theme.colors.textMuted}>Loading more discussions.</AppText>
      </View>
    )
  }
  if (status !== 'CanLoadMore') return null
  return (
    <View style={styles.footer}>
      <ActionButton label={loadLabel} intent="social" secondary onPress={onLoadMore} />
    </View>
  )
}

const styles = StyleSheet.create({
  footer: { paddingTop: 12 },
})
