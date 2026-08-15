import { Image, StyleSheet, View } from 'react-native'

import { AppText } from './Typography'

const brandMark = require('../../assets/images/brand-mark.png')

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <View accessibilityLabel="Let's Be Friends" style={styles.row}>
      <Image source={brandMark} resizeMode="contain" style={styles.mark} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />
      <AppText variant={compact ? 'bodyStrong' : 'heading'}>Let's Be Friends</AppText>
    </View>
  )
}

const styles = StyleSheet.create({
  row: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 10 },
  mark: { width: 28, height: 31 },
})
