import { Pressable, StyleSheet, View } from 'react-native'

import { ActionButton } from '../atoms/ActionButton'
import { AppIcon, type AppIconName } from '../atoms/AppIcon'
import { AppText } from '../atoms/Typography'
import { useAppTheme } from '@/theme/ThemeProvider'
import { density } from '@/theme/tokens'

import { BottomSheet, BottomSheetPresentation } from './BottomSheet'

export type ActionSheetItem = {
  label: string
  icon: AppIconName
  tone?: 'neutral' | 'self' | 'social' | 'danger'
  disabled?: boolean
  onPress: () => void
}

type ActionSheetPresentationProps = {
  title: string
  description?: string
  items: ActionSheetItem[]
  busy?: boolean
  onClose: () => void
}

function ActionSheetItems({ items, busy = false }: Pick<ActionSheetPresentationProps, 'items' | 'busy'>) {
  const theme = useAppTheme()

  return (
    <View style={styles.list}>
      {items.map((item) => {
        const disabled = busy || item.disabled === true
        const color = item.tone === 'danger'
          ? theme.colors.danger
          : item.tone === 'self'
            ? theme.colors.selfText
            : item.tone === 'social'
              ? theme.colors.socialText
              : theme.colors.text

        return (
          <Pressable
            key={item.label}
            accessibilityRole="button"
            accessibilityLabel={item.label}
            accessibilityState={{ disabled }}
            disabled={disabled}
            onPress={item.onPress}
            style={({ pressed }) => [
              styles.item,
              { borderBottomColor: theme.colors.border },
              pressed && styles.pressed,
              disabled && styles.disabled,
            ]}>
            <AppIcon name={item.icon} size={20} color={color} />
            <AppText variant="bodyStrong" color={color} style={styles.itemLabel}>{item.label}</AppText>
            <AppIcon name="chevron-forward" size={18} color={color} />
          </Pressable>
        )
      })}
    </View>
  )
}

export function ActionSheetPresentation({ title, description, items, busy = false, onClose }: ActionSheetPresentationProps) {
  return (
    <BottomSheetPresentation
      title={title}
      description={description}
      closeLabel="Close options"
      busy={busy}
      onClose={onClose}
      footer={<ActionButton label="Cancel" intent="neutral" secondary disabled={busy} onPress={onClose} />}>
      <ActionSheetItems items={items} busy={busy} />
    </BottomSheetPresentation>
  )
}

export function ActionSheet({ visible, title, description, items, busy = false, onClose }: ActionSheetPresentationProps & { visible: boolean }) {
  return (
    <BottomSheet
      visible={visible}
      animationType="slide"
      title={title}
      description={description}
      closeLabel="Close options"
      busy={busy}
      onClose={onClose}
      footer={<ActionButton label="Cancel" intent="neutral" secondary disabled={busy} onPress={onClose} />}>
      <ActionSheetItems
        items={items.map((item) => ({
          ...item,
          onPress: () => {
            onClose()
            item.onPress()
          },
        }))}
        busy={busy}
      />
    </BottomSheet>
  )
}

const styles = StyleSheet.create({
  list: { gap: 0 },
  item: {
    minHeight: density.compactControlHeight,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  itemLabel: { flex: 1, minWidth: 0 },
  pressed: { opacity: 0.68 },
  disabled: { opacity: 0.5 },
})
