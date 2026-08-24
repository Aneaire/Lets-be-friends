import { ModalHost, ModalPresentation, type PresentationPrimitiveProps } from './ModalPresentation'

export type DialogPresentationProps = PresentationPrimitiveProps

export type DialogProps = DialogPresentationProps & {
  visible: boolean
}

export function DialogPresentation({ closeLabel = 'Close dialog', ...props }: DialogPresentationProps) {
  return <ModalPresentation {...props} closeLabel={closeLabel} placement="center" />
}

export function Dialog({ visible, closeLabel = 'Close dialog', ...props }: DialogProps) {
  return (
    <ModalHost
      {...props}
      visible={visible}
      closeLabel={closeLabel}
      placement="center"
      animationType="fade"
    />
  )
}
