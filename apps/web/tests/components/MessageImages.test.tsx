// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MessageImageGallery, MessageImageViewer, type MessageImage } from '../../src/design-system/molecules/MessageImages'

afterEach(cleanup)

const image: MessageImage = {
  storageId: 'image-1',
  url: 'https://example.test/image.png',
  fileName: 'session-photo.png',
}

describe('MessageImages', () => {
  it('opens a message image through an in-app control', () => {
    const onOpen = vi.fn()
    render(<MessageImageGallery images={[image]} onOpen={onOpen} />)

    fireEvent.click(screen.getByRole('button', { name: 'Open session-photo.png' }))

    expect(onOpen).toHaveBeenCalledWith(image)
    expect(screen.queryByRole('link')).toBeNull()
  })

  it('closes the image viewer with Escape', () => {
    const onClose = vi.fn()
    render(<MessageImageViewer image={image} onClose={onClose} />)

    expect(screen.getByRole('dialog')).toBeTruthy()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledOnce()
  })
})
