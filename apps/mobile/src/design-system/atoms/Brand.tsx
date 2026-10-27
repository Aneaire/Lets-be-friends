import { Image, StyleSheet, View } from 'react-native'

import { AppText } from '@/design-system/atoms/Typography'

const brandMark = require('../../../assets/images/brand-mark.png')

export const BRAND_TAGLINE = 'Everyday help, useful ideas, and real connections'

const sizes = {
  sm: { mark: { width: 22, height: 25 }, rowGap: 8, stackGap: 6, minHeight: 34, text: 'bodyStrong' as const },
  md: { mark: { width: 28, height: 31 }, rowGap: 10, stackGap: 8, minHeight: 48, text: 'heading' as const },
  lg: { mark: { width: 76, height: 84 }, rowGap: 16, stackGap: 14, minHeight: 92, text: 'title' as const },
}

export function BrandMark({ width = 28, height = 31 }: { width?: number; height?: number }) {
  return (
    <Image
      source={brandMark}
      resizeMode="contain"
      style={{ width, height }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    />
  )
}

export function Brand({ size = 'md', layout = 'row' }: { size?: 'sm' | 'md' | 'lg'; layout?: 'row' | 'stacked' }) {
  const preset = sizes[size]
  const stacked = layout === 'stacked'

  return (
    <View
      accessibilityLabel="Let's Be Friends"
      style={[
        stacked ? styles.stacked : styles.row,
        stacked ? { gap: preset.stackGap } : { minHeight: preset.minHeight, gap: preset.rowGap },
      ]}
    >
      <View style={styles.mark}><BrandMark {...preset.mark} /></View>
      <AppText variant={preset.text} numberOfLines={1}>Let's Be Friends</AppText>
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  stacked: { alignItems: 'center' },
  mark: { flexShrink: 0 },
})
