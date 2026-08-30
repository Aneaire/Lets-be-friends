import type { ModalProps } from 'react-native'

import { ModalHost, ModalPresentation, type PresentationPrimitiveProps } from './ModalPresentation'

export type BottomSheetPresentationProps = PresentationPrimitiveProps

export type BottomSheetProps = BottomSheetPresentationProps & {
  visible: boolean
  animationType?: NonNullable<ModalProps['animationType']>
}

export function BottomSheetPresentation({ closeLabel = 'Close bottom sheet', ...props }: BottomSheetPresentationProps) {
  return <ModalPresentation {...props} closeLabel={closeLabel} placement="bottom" />
}

export function BottomSheet({ visible, closeLabel = 'Close bottom sheet', animationType = 'slide', ...props }: BottomSheetProps) {
  return (
    <ModalHost
      {...props}
      visible={visible}
      closeLabel={closeLabel}
      placement="bottom"
      animationType={animationType}
    />
  )
}
