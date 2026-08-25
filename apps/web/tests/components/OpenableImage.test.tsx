// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { OpenableImage } from '../../src/design-system/molecules/OpenableImage'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  document.body.style.overflow = ''
})

function stubImmediateAnimationFrame() {
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    callback(0)
    return 1
  })
  vi.stubGlobal('cancelAnimationFrame', vi.fn())
}

describe('OpenableImage', () => {
  it('opens the full image by click and restores focus after close', () => {
    stubImmediateAnimationFrame()
    render(
      <OpenableImage
        src="https://example.test/preview.jpg"
        fullSrc="https://example.test/full.jpg"
        alt="A shared photo"
      />,
    )

    const trigger = screen.getByRole('button', { name: 'Open image: A shared photo' })
    trigger.focus()
    fireEvent.click(trigger)

    const dialog = screen.getByRole('dialog', { name: 'A shared photo' })
    expect(dialog.querySelector('img')?.getAttribute('src')).toBe('https://example.test/full.jpg')
    fireEvent.click(screen.getByRole('button', { name: 'Close image' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(trigger)
  })

  it('opens with Enter or Space and closes with Escape', () => {
    stubImmediateAnimationFrame()
    render(<OpenableImage src="https://example.test/photo.jpg" alt="Post image" />)
    const trigger = screen.getByRole('button', { name: 'Open image: Post image' })

    fireEvent.keyDown(trigger, { key: 'Enter' })
    expect(screen.getByRole('dialog', { name: 'Post image' })).toBeTruthy()
    fireEvent.keyDown(screen.getByRole('button', { name: 'Close image' }), { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()

    fireEvent.keyDown(trigger, { key: ' ' })
    expect(screen.getByRole('dialog', { name: 'Post image' })).toBeTruthy()
  })
})
