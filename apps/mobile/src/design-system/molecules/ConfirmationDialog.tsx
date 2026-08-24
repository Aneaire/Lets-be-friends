import type { ReactNode } from 'react'
import { StyleSheet, View } from 'react-native'

import { ActionButton } from '@/design-system/atoms/ActionButton'
import { density } from '@/theme/tokens'

import { Dialog, DialogPresentation, type DialogPresentationProps } from './Dialog'

export type ConfirmationDialogPresentationProps = {
  onClose: () => void
  onConfirm: () => void | Promise<void>
  title: string
  description: string
  confirmLabel: string
  cancelLabel?: string
  busyLabel?: string
  intent?: 'neutral' | 'social' | 'self' | 'danger'
  busy?: boolean
  children?: ReactNode
}

export type ConfirmationDialogProps = ConfirmationDialogPresentationProps & {
  visible: boolean
}

type ConfirmationContentProps = ConfirmationDialogPresentationProps & {
  visible?: boolean
}

function ConfirmationActions({
  onClose,
  onConfirm,
  confirmLabel,
  cancelLabel,
  busyLabel,
  intent,
  busy,
}: Required<Pick<ConfirmationDialogPresentationProps, 'onClose' | 'onConfirm' | 'confirmLabel' | 'cancelLabel' | 'busyLabel' | 'intent' | 'busy'>>) {
  return (
    <View style={styles.actions}>
      <ActionButton
        label={busy ? busyLabel : confirmLabel}
        intent={intent}
        loading={busy}
        onPress={() => { void onConfirm() }}
      />
      <ActionButton
        label={cancelLabel}
        intent="neutral"
        secondary
        disabled={busy}
        onPress={onClose}
      />
    </View>
  )
}

function ConfirmationContent({
  visible,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel,
  cancelLabel = 'Cancel',
  busyLabel = 'Working',
  intent = 'danger',
  busy = false,
  children,
}: ConfirmationContentProps) {
  const dialogProps: DialogPresentationProps = {
    onClose,
    title,
    description,
    closeLabel: 'Close confirmation',
    busy,
    footer: (
      <ConfirmationActions
        onClose={onClose}
        onConfirm={onConfirm}
        confirmLabel={confirmLabel}
        cancelLabel={cancelLabel}
        busyLabel={busyLabel}
        intent={intent}
        busy={busy}
      />
    ),
    children,
  }

  return visible === undefined
    ? <DialogPresentation {...dialogProps} />
    : <Dialog {...dialogProps} visible={visible} />
}

export function ConfirmationDialogPresentation(props: ConfirmationDialogPresentationProps) {
  return <ConfirmationContent {...props} />
}

export function ConfirmationDialog({ visible, ...props }: ConfirmationDialogProps) {
  return <ConfirmationContent {...props} visible={visible} />
}

const styles = StyleSheet.create({
  actions: { gap: density.cardGap },
})
