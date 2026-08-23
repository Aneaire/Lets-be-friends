import { Image, StyleSheet, View } from 'react-native'

import { AppText } from '@/design-system/atoms/Typography'

const brandMark = require('../../../assets/images/brand-mark.png')

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <View accessibilityLabel="Let's Be Friends" style={[styles.row, compact && styles.compactRow]}>
      <Image source={brandMark} resizeMode="contain" style={[styles.mark, compact && styles.compactMark]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />
      <AppText variant={compact ? 'bodyStrong' : 'heading'} numberOfLines={1}>Let's Be Friends</AppText>
    </View>
  )
}

const styles = StyleSheet.create({
  row: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 10 },
  mark: { width: 28, height: 31 },
  compactRow: { minHeight: 34, gap: 8 },
  compactMark: { width: 22, height: 25 },
})
