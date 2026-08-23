import { Modal, Pressable, StyleSheet, View } from 'react-native'
import { AppIcon, type AppIconName } from '../atoms/AppIcon'
import { AppText } from '../atoms/Typography'
import { useAppTheme } from '@/theme/ThemeProvider'
import { density } from '@/theme/tokens'

export type ActionSheetItem = { label: string; icon: AppIconName; tone?: 'neutral' | 'self' | 'social' | 'danger'; disabled?: boolean; onPress: () => void }

export function ActionSheetPresentation({ title, items, onClose }: { title: string; items: ActionSheetItem[]; onClose: () => void }) {
  const theme = useAppTheme()
  return <View style={[styles.sheet, { backgroundColor: theme.colors.surfaceRaised, borderColor: theme.colors.border }]}><View style={[styles.handle, { backgroundColor: theme.colors.borderStrong }]} /><AppText variant="bodyStrong">{title}</AppText>{items.map((item) => { const color = item.tone === 'danger' ? theme.colors.danger : item.tone === 'self' ? theme.colors.selfText : item.tone === 'social' ? theme.colors.socialText : theme.colors.text; return <Pressable key={item.label} accessibilityRole="button" accessibilityLabel={item.label} accessibilityState={{ disabled: item.disabled }} disabled={item.disabled} onPress={item.onPress} style={({ pressed }) => [styles.item, { borderColor: theme.colors.border }, pressed && styles.pressed, item.disabled && styles.disabled]}><AppIcon name={item.icon} size={20} color={color} /><AppText variant="bodyStrong" color={color}>{item.label}</AppText></Pressable> })}<Pressable accessibilityRole="button" accessibilityLabel="Cancel" onPress={onClose} style={({ pressed }) => [styles.cancel, { borderColor: theme.colors.border }, pressed && styles.pressed]}><AppText variant="bodyStrong">Cancel</AppText></Pressable></View>
}

export function ActionSheet({ visible, title, items, onClose }: { visible: boolean; title: string; items: ActionSheetItem[]; onClose: () => void }) { const theme = useAppTheme(); return <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}><View style={[styles.scrim, { backgroundColor: theme.colors.scrim }]}><Pressable accessibilityRole="button" accessibilityLabel="Close options" onPress={onClose} style={StyleSheet.absoluteFill} /><ActionSheetPresentation title={title} items={items.map((item) => ({ ...item, onPress: () => { onClose(); item.onPress() } }))} onClose={onClose} /></View></Modal> }

const styles = StyleSheet.create({ scrim: { flex: 1, justifyContent: 'flex-end' }, sheet: { borderWidth: 1, borderTopLeftRadius: 18, borderTopRightRadius: 18, paddingHorizontal: density.sheetPadding, paddingTop: 8, paddingBottom: 18, gap: density.textSectionGap }, handle: { width: 38, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 2 }, item: { minHeight: density.compactControlHeight, borderWidth: 1, borderRadius: 12, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 9 }, cancel: { minHeight: density.compactControlHeight, borderWidth: 1, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }, pressed: { opacity: 0.68 }, disabled: { opacity: 0.5 } })
