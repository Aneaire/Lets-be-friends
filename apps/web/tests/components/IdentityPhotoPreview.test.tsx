// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { IdentityPhotoSummary } from '../../src/features/identity/IdentityPhotoPreview'

const originalCreateObjectURL = URL.createObjectURL
const originalRevokeObjectURL = URL.revokeObjectURL

function photo(name: string) {
  return new File([name], name, { type: 'image/jpeg' })
}

describe('identity photo summary', () => {
  beforeEach(() => {
    URL.createObjectURL = vi.fn(() => 'blob:identity-photo') as unknown as typeof URL.createObjectURL
    URL.revokeObjectURL = vi.fn() as unknown as typeof URL.revokeObjectURL
  })

  afterEach(() => {
    cleanup()
    URL.createObjectURL = originalCreateObjectURL
    URL.revokeObjectURL = originalRevokeObjectURL
  })

  it('renders each chosen photo so the member can check the images before sending them', () => {
    const view = render(<IdentityPhotoSummary front={photo('id-front.jpg')} back={photo('id-back.jpg')} selfie={new Blob(['selfie'], { type: 'image/jpeg' })} />)

    // The caption names each photo, so the images stay decorative for a screen reader.
    expect(view.container.querySelectorAll('img')).toHaveLength(3)
    expect(screen.getByText('Front of ID')).toBeTruthy()
    expect(screen.getByText('Back of ID')).toBeTruthy()
    expect(screen.getByText('Current selfie')).toBeTruthy()
    expect(screen.getByText('Photos for review')).toBeTruthy()
    expect(view.container.querySelector('img')?.getAttribute('src')).toBe('blob:identity-photo')
  })

  it('omits a photo the member has not provided yet', () => {
    const view = render(<IdentityPhotoSummary front={photo('id-front.jpg')} back={null} selfie={null} />)

    expect(view.container.querySelectorAll('img')).toHaveLength(1)
    expect(screen.getByText('Front of ID')).toBeTruthy()
    expect(screen.queryByText('Back of ID')).toBeNull()
    expect(screen.queryByText('Current selfie')).toBeNull()
  })

  it('renders nothing when no photo is held in the member session', () => {
    const view = render(<IdentityPhotoSummary front={null} back={null} selfie={null} />)

    expect(view.container.firstChild).toBeNull()
  })

  it('releases the object URL of a photo once the preview goes away', () => {
    const view = render(<IdentityPhotoSummary front={photo('id-front.jpg')} back={null} selfie={null} />)

    view.unmount()

    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:identity-photo')
  })

  it('opens a chosen photo at full size when the member taps it', async () => {
    render(<IdentityPhotoSummary front={photo('id-front.jpg')} back={null} selfie={null} />)

    fireEvent.click(screen.getByRole('button', { name: 'Open Front of ID larger' }))

    const viewer = await screen.findByRole('dialog', { name: 'Front of ID' })
    expect(viewer.querySelector('img')?.getAttribute('src')).toBe('blob:identity-photo')
  })

  it('closes the full size photo when the member closes it', async () => {
    render(<IdentityPhotoSummary front={photo('id-front.jpg')} back={null} selfie={null} />)

    fireEvent.click(screen.getByRole('button', { name: 'Open Front of ID larger' }))
    await screen.findByRole('dialog', { name: 'Front of ID' })
    fireEvent.click(screen.getByRole('button', { name: 'Close image' }))

    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Front of ID' })).toBeNull())
  })
})
