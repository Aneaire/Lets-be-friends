import { StyleSheet, View } from 'react-native'
import type { ReactNode } from 'react'
import { Avatar } from '../atoms/Avatar'
import { AppText } from '../atoms/Typography'
import { useAppTheme } from '@/theme/ThemeProvider'
import { density } from '@/theme/tokens'

export function IdentityRow({ name, imageUrl, meta, action, avatarSize = 40 }: { name: string; imageUrl?: string | null; meta?: string; action?: ReactNode; avatarSize?: number }) {
  const theme = useAppTheme()
  return <View style={styles.row}><Avatar uri={imageUrl ?? undefined} name={name} size={avatarSize} /><View style={styles.copy}><AppText variant="bodyStrong" numberOfLines={1}>{name}</AppText>{meta ? <AppText variant="caption" color={theme.colors.textMuted} numberOfLines={1}>{meta}</AppText> : null}</View>{action}</View>
}
const styles = StyleSheet.create({ row: { minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: density.cardGap }, copy: { flex: 1, minWidth: 0, gap: density.textPairGap } })
