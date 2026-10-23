// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest'

vi.mock('convex/react', () => ({
  useQuery: () => undefined,
  useMutation: () => vi.fn(),
}))

vi.mock('../../convex/_generated/api', () => ({
  api: { social: { mentionLookup: 'social.mentionLookup' } },
}))

import { ProfilePhotoComposerDialog } from '../../src/features/profile/ProfilePhotoComposerDialog'
import { defaultAvatarCrop, type AvatarCrop } from '../../src/features/profile/avatarCrop'

type SaveInput = { file: File; crop: AvatarCrop; caption: string; shareToFeed: boolean }
type SaveHandler = (input: SaveInput) => Promise<void>

function photoFile(name = 'portrait.png', type = 'image/png') {
  return new File(['bytes'], name, { type })
}

function choosePhoto(file: File) {
  const input = document.querySelector('input[type="file"]') as HTMLInputElement
  Object.defineProperty(input, 'files', { configurable: true, value: [file] })
  fireEvent.change(input)
}

function renderDialog(overrides: Partial<Parameters<typeof ProfilePhotoComposerDialog>[0]> = {}) {
  const onSave: Mock<SaveHandler> = (overrides.onSave as Mock<SaveHandler> | undefined) ?? vi.fn(async () => undefined)
  const onClose = overrides.onClose ?? vi.fn()
  const utils = render(
    <ProfilePhotoComposerDialog
      open
      onClose={onClose}
      authorName="Robin Lee"
      onSave={onSave}
      {...overrides}
    />,
  )
  return { ...utils, onSave, onClose }
}

beforeEach(() => {
  vi.stubGlobal('URL', {
    ...URL,
    createObjectURL: vi.fn(() => 'blob:profile-draft'),
    revokeObjectURL: vi.fn(),
  })
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('ProfilePhotoComposerDialog', () => {
  it('frames the photo on the post card before posting', async () => {
    const { onSave, onClose } = renderDialog()

    expect(screen.getByRole('article', { name: 'Profile photo preview' })).toBeTruthy()
    expect(screen.getByLabelText('Profile picture caption')).toBeTruthy()
    expect(screen.getByText('Drag a photo here, or choose a file')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Post' }).hasAttribute('disabled')).toBe(true)

    choosePhoto(photoFile())
    expect(screen.getByText('Choose another photo')).toBeTruthy()
    expect(screen.getByRole('slider', { name: 'Zoom profile photo' })).toBeTruthy()

    fireEvent.change(screen.getByLabelText('Profile picture caption'), {
      target: { value: '  Fresh start for the season.  ' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Post' }))
    await vi.waitFor(() => expect(onSave).toHaveBeenCalledTimes(1))
    expect(onSave.mock.calls[0][0]).toMatchObject({
      crop: defaultAvatarCrop,
      caption: 'Fresh start for the season.',
      shareToFeed: true,
    })
    expect(onSave.mock.calls[0][0].file.name).toBe('portrait.png')
    expect(onClose).toHaveBeenCalled()
  })

  it('updates the photo without posting when sharing is off', async () => {
    const { onSave, onClose } = renderDialog()

    fireEvent.click(screen.getByRole('radio', { name: 'Private' }))
    expect(screen.queryByLabelText('Profile picture caption')).toBeNull()
    expect(screen.getByText('Only your profile picture changes. No post is added to the feed.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Save photo' }).hasAttribute('disabled')).toBe(true)

    choosePhoto(photoFile())
    fireEvent.click(screen.getByRole('button', { name: 'Save photo' }))
    await vi.waitFor(() => expect(onSave).toHaveBeenCalledTimes(1))
    expect(onSave.mock.calls[0][0]).toMatchObject({ caption: '', shareToFeed: false })
    expect(onClose).toHaveBeenCalled()
  })

  it('rejects files that are not images', () => {
    renderDialog()

    choosePhoto(photoFile('notes.txt', 'text/plain'))

    expect(screen.getByRole('alert').textContent).toContain('Choose an image file')
    expect(screen.getByRole('button', { name: 'Post' }).hasAttribute('disabled')).toBe(true)
  })

  it('rejects an image larger than 5 MB', () => {
    renderDialog()
    const oversized = photoFile('huge.png')
    Object.defineProperty(oversized, 'size', { configurable: true, value: 5 * 1024 * 1024 + 1 })

    choosePhoto(oversized)

    expect(screen.getByRole('alert').textContent).toContain('5 MB or smaller')
  })

  it('shows the save error inside the composer and stays open', async () => {
    const onSave = vi.fn(async () => { throw new Error('Upload failed') })
    const { onClose } = renderDialog({ onSave })

    choosePhoto(photoFile())
    fireEvent.click(screen.getByRole('button', { name: 'Post' }))

    await vi.waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Upload failed'))
    expect(onClose).not.toHaveBeenCalled()
  })
})
