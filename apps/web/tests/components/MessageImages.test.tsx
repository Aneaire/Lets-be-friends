// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MessageImageGallery, MessageImageViewer, type MessageImage } from '../../src/design-system/molecules/MessageImages'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  document.body.style.overflow = ''
})

const image: MessageImage = {
  storageId: 'image-1',
  url: 'https://example.test/image.png',
  fileName: 'session-photo.png',
}

function stubImmediateAnimationFrame() {
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    callback(0)
    return 1
  })
  vi.stubGlobal('cancelAnimationFrame', vi.fn())
}

describe('MessageImages', () => {
  it('opens a message image through an in-app control', () => {
    const onOpen = vi.fn()
    render(<MessageImageGallery images={[image]} onOpen={onOpen} />)

    fireEvent.click(screen.getByRole('button', { name: 'Open session-photo.png' }))

    expect(onOpen).toHaveBeenCalledWith(image)
    expect(screen.queryByRole('link')).toBeNull()
  })

  it('uses the shared dialog focus, portal, backdrop, and restoration behavior', () => {
    stubImmediateAnimationFrame()

    function ViewerExample() {
      const [open, setOpen] = useState(false)
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>Open image</button>
          {open ? <MessageImageViewer image={image} onClose={() => setOpen(false)} /> : null}
        </>
      )
    }

    render(<ViewerExample />)
    const opener = screen.getByRole('button', { name: 'Open image' })
    opener.focus()
    fireEvent.click(opener)

    const dialog = screen.getByRole('dialog', { name: 'session-photo.png' })
    const close = screen.getByRole('button', { name: 'Close image' })
    const backdrop = dialog.parentElement!
    expect(backdrop.parentElement).toBe(document.body)
    expect(document.body.style.overflow).toBe('hidden')
    expect(document.activeElement).toBe(close)

    fireEvent.keyDown(close, { key: 'Tab' })
    expect(document.activeElement).toBe(close)
    fireEvent.keyDown(close, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(close)

    fireEvent.pointerDown(dialog)
    expect(screen.getByRole('dialog', { name: 'session-photo.png' })).toBeTruthy()

    fireEvent.pointerDown(backdrop)
    expect(screen.queryByRole('dialog', { name: 'session-photo.png' })).toBeNull()
    expect(document.activeElement).toBe(opener)
    expect(document.body.style.overflow).toBe('')
  })

  it('closes the image viewer with Escape', () => {
    stubImmediateAnimationFrame()
    const onClose = vi.fn()
    render(<MessageImageViewer image={image} onClose={onClose} />)

    const close = screen.getByRole('button', { name: 'Close image' })
    expect(document.activeElement).toBe(close)
    fireEvent.keyDown(close, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledOnce()
  })
})
