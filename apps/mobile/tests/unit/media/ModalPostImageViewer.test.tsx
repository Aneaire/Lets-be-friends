import { isValidElement, createRef, type ReactNode } from 'react'
import { Modal, View } from 'react-native'

import { ModalPostImageViewer } from '@/features/media/ModalPostImageViewer'
import { PostImageViewer } from '@/features/social/PostImageViewer'

type TestElement = {
  type: unknown
  props: Record<string, unknown> & { children?: ReactNode }
}

function asElement(value: unknown): TestElement {
  if (!isValidElement(value)) throw new Error('Expected a React element')
  return value as unknown as TestElement
}

describe('modal post image viewer', () => {
  it('stays unmounted while no image is open', () => {
    expect(ModalPostImageViewer({ image: null, blurTarget: createRef<View>(), onClose: jest.fn() })).toBeNull()
  })

  it('hosts the existing image viewer in a viewport modal and closes from the system action', () => {
    const onClose = jest.fn()
    const blurTarget = createRef<View>()
    const image = { url: 'https://example.com/photo.jpg', index: 0, total: 1 }
    const modal = asElement(ModalPostImageViewer({ image, blurTarget, onClose }))

    expect(modal.type).toBe(Modal)
    expect(modal.props.visible).toBe(true)
    expect(modal.props.accessibilityViewIsModal).toBe(true)
    ;(modal.props.onRequestClose as () => void)()
    expect(onClose).toHaveBeenCalledTimes(1)

    const viewport = asElement(modal.props.children)
    const viewer = asElement(viewport.props.children)
    expect(viewer.type).toBe(PostImageViewer)
    expect(viewer.props.image).toBe(image)
    expect(viewer.props.blurTarget).toBe(blurTarget)
  })
})
