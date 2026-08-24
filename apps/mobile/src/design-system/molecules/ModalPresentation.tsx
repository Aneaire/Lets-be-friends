import { useContext, useId, type ReactNode } from 'react'
import { Modal, Pressable, ScrollView, StyleSheet, View, type AccessibilityRole, type ModalProps } from 'react-native'
import { SafeAreaInsetsContext } from 'react-native-safe-area-context'

import { IconButton } from '@/design-system/atoms/IconButton'
import { AppText } from '@/design-system/atoms/Typography'
import { useAppTheme } from '@/theme/ThemeProvider'
import { density } from '@/theme/tokens'
import { useReducedMotion } from '@/utils/accessibility'

export type ModalPlacement = 'center' | 'bottom'

const dialogRole = 'dialog' as AccessibilityRole

export type ModalPresentationProps = {
  title: string
  description?: string
  children?: ReactNode
  footer?: ReactNode
  onClose: () => void
  closeLabel: string
  busy?: boolean
  scrollable?: boolean
  placement: ModalPlacement
}

export type PresentationPrimitiveProps = Omit<ModalPresentationProps, 'closeLabel' | 'placement'> & {
  closeLabel?: string
}

type ModalHostProps = ModalPresentationProps & {
  visible: boolean
  animationType: NonNullable<ModalProps['animationType']>
}

export function ModalPresentation({
  title,
  description,
  children,
  footer,
  onClose,
  closeLabel,
  busy = false,
  scrollable = true,
  placement,
}: ModalPresentationProps) {
  const theme = useAppTheme()
  const insets = useContext(SafeAreaInsetsContext)
  const titleId = useId()
  const descriptionId = useId()
  const isBottomSheet = placement === 'bottom'
  const horizontalPadding = {
    paddingLeft: Math.max(density.sheetPadding, (insets?.left ?? 0) + density.cardGap),
    paddingRight: Math.max(density.sheetPadding, (insets?.right ?? 0) + density.cardGap),
  }
  const bottomPadding = isBottomSheet
    ? Math.max(density.sheetPadding, (insets?.bottom ?? 0) + density.cardGap)
    : density.sheetPadding

  return (
    <View
      style={[
        styles.scrim,
        isBottomSheet ? styles.bottomPlacement : styles.centerPlacement,
        {
          backgroundColor: theme.colors.scrim,
          paddingTop: Math.max(density.sheetPadding, (insets?.top ?? 0) + density.cardGap),
          paddingBottom: isBottomSheet ? 0 : Math.max(density.sheetPadding, (insets?.bottom ?? 0) + density.cardGap),
          paddingLeft: isBottomSheet ? 0 : Math.max(density.screenGutter, (insets?.left ?? 0) + density.cardGap),
          paddingRight: isBottomSheet ? 0 : Math.max(density.screenGutter, (insets?.right ?? 0) + density.cardGap),
        },
      ]}>
      <Pressable
        accessible={false}
        importantForAccessibility="no"
        disabled={busy}
        onPress={onClose}
        style={StyleSheet.absoluteFill}
      />
      <View
        accessibilityRole={dialogRole}
        accessibilityLabelledBy={titleId}
        accessibilityState={{ busy }}
        accessibilityViewIsModal
        aria-busy={busy || undefined}
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        importantForAccessibility="yes"
        onAccessibilityEscape={busy ? undefined : onClose}
        style={[
          styles.surface,
          isBottomSheet ? styles.bottomSheet : styles.dialog,
          { backgroundColor: theme.colors.surfaceRaised, borderColor: theme.colors.border },
        ]}>
        {isBottomSheet ? <View style={[styles.handle, { backgroundColor: theme.colors.borderStrong }]} /> : null}
        <View
          style={[
            styles.header,
            isBottomSheet && styles.bottomSheetHeader,
            horizontalPadding,
            !children && !footer && { paddingBottom: bottomPadding },
          ]}>
          <View style={styles.copy}>
            <AppText nativeID={titleId} variant="heading">{title}</AppText>
            {description ? <AppText nativeID={descriptionId} variant="caption" color={theme.colors.textMuted}>{description}</AppText> : null}
          </View>
          <IconButton label={closeLabel} icon="close-outline" disabled={busy} onPress={onClose} />
        </View>
        {children ? scrollable ? (
          <ScrollView
            style={styles.body}
            contentContainerStyle={[
              styles.bodyContent,
              horizontalPadding,
              !footer && { paddingBottom: bottomPadding },
            ]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator>
            {children}
          </ScrollView>
        ) : (
          <View
            style={[
              styles.body,
              styles.bodyContent,
              horizontalPadding,
              !footer && { paddingBottom: bottomPadding },
            ]}
          >
            {children}
          </View>
        ) : null}
        {footer ? (
          <View
            style={[
              styles.footer,
              horizontalPadding,
              { borderTopColor: theme.colors.border, paddingBottom: bottomPadding },
            ]}>
            {footer}
          </View>
        ) : null}
      </View>
    </View>
  )
}

export function ModalHost({
  visible,
  animationType,
  busy = false,
  onClose,
  ...presentationProps
}: ModalHostProps) {
  const reduceMotion = useReducedMotion()

  return (
    <Modal
      visible={visible}
      transparent
      animationType={reduceMotion ? 'none' : animationType}
      presentationStyle="overFullScreen"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={() => { if (!busy) onClose() }}>
      <ModalPresentation {...presentationProps} busy={busy} onClose={onClose} />
    </Modal>
  )
}

const styles = StyleSheet.create({
  scrim: { flex: 1 },
  centerPlacement: { alignItems: 'center', justifyContent: 'center' },
  bottomPlacement: { justifyContent: 'flex-end' },
  surface: { width: '100%', maxHeight: '100%', borderWidth: 1, overflow: 'hidden' },
  dialog: { maxWidth: 520, borderRadius: 18 },
  bottomSheet: { maxHeight: '92%', borderBottomWidth: 0, borderTopLeftRadius: 18, borderTopRightRadius: 18 },
  handle: { width: 38, height: 4, borderRadius: 2, alignSelf: 'center', marginTop: 8, marginBottom: 2 },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: density.cardGap, paddingTop: density.sheetPadding, paddingBottom: density.compactCardPadding },
  bottomSheetHeader: { paddingTop: density.cardGap },
  copy: { flex: 1, minWidth: 0, gap: density.textPairGap },
  body: { minHeight: 0, flexShrink: 1 },
  bodyContent: { paddingTop: density.textStackGap },
  footer: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: density.compactCardPadding },
})
