import type { RefObject } from 'react'
import { Modal, StyleSheet, View } from 'react-native'

import { PostImageViewer, type PostViewerImage } from '@/features/social/PostImageViewer'

export function ModalPostImageViewer({ image, blurTarget, onClose }: {
  image: PostViewerImage | null
  blurTarget: RefObject<View | null>
  onClose: () => void
}) {
  if (!image) return null

  return (
    <Modal
      visible
      transparent
      animationType="none"
      onRequestClose={onClose}
      accessibilityViewIsModal
    >
      <View style={styles.viewport}>
        <PostImageViewer image={image} blurTarget={blurTarget} onClose={onClose} />
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  viewport: { flex: 1 },
})
