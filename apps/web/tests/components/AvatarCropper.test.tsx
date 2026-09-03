// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AvatarCropper } from '../../src/features/profile/AvatarCropper'
import { defaultAvatarCrop, type AvatarCrop } from '../../src/features/profile/avatarCrop'

beforeEach(() => {
  vi.stubGlobal('URL', {
    createObjectURL: vi.fn(() => 'blob:avatar-preview'),
    revokeObjectURL: vi.fn(),
  })
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

function CropperExample() {
  const [crop, setCrop] = useState<AvatarCrop>(defaultAvatarCrop)
  return (
    <AvatarCropper
      file={new File(['photo'], 'portrait.png', { type: 'image/png' })}
      crop={crop}
      onChange={setCrop}
    />
  )
}

describe('AvatarCropper', () => {
  it('previews the selected image and supports keyboard positioning', () => {
    render(<CropperExample />)
    const preview = screen.getByRole('group', { name: /Avatar preview/ })
    const image = preview.querySelector('img')!
    Object.defineProperties(image, {
      naturalWidth: { configurable: true, value: 1200 },
      naturalHeight: { configurable: true, value: 800 },
    })
    fireEvent.load(image)

    expect(image.getAttribute('src')).toBe('blob:avatar-preview')
    expect(image.style.width).toBe('360px')
    expect(image.style.height).toBe('240px')

    fireEvent.keyDown(preview, { key: 'ArrowRight' })
    expect(image.style.transform).toContain('1.5px')
  })

  it('zooms and resets the selected framing', () => {
    render(<CropperExample />)
    const zoom = screen.getByRole('slider', { name: 'Zoom profile photo' })

    fireEvent.change(zoom, { target: { value: '2.5' } })
    expect(screen.getByText('2.5×')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Reset' }))
    expect(screen.getByText('1.0×')).toBeTruthy()
  })

  it('moves the image when the preview is dragged', () => {
    render(<CropperExample />)
    const preview = screen.getByRole('group', { name: /Avatar preview/ })
    const image = preview.querySelector('img')!
    Object.defineProperties(image, {
      naturalWidth: { configurable: true, value: 1200 },
      naturalHeight: { configurable: true, value: 800 },
    })
    fireEvent.load(image)

    fireEvent.pointerDown(preview, { pointerId: 1, clientX: 100, clientY: 100 })
    fireEvent.pointerMove(preview, { pointerId: 1, clientX: 130, clientY: 100 })
    fireEvent.pointerUp(preview, { pointerId: 1 })

    expect(image.style.transform).toContain('30px')
  })
})
