// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  generateUploadUrl: vi.fn(),
  registerUpload: vi.fn(),
  discardUpload: vi.fn(),
  uploadResponse: { ok: true } as { ok: boolean },
  storageId: 'storage-1',
}))

vi.mock('convex/react', () => ({
  useQuery: () => ({ displayName: 'Robin Lee', profileImageUrl: null }),
  useMutation: (name: string) => {
    if (name === 'reviews.generateImageUploadUrl') return mocks.generateUploadUrl
    if (name === 'reviews.registerImageUpload') return mocks.registerUpload
    return mocks.discardUpload
  },
}))

vi.mock('../../convex/_generated/api', () => ({
  api: {
    reviews: {
      generateImageUploadUrl: 'reviews.generateImageUploadUrl',
      registerImageUpload: 'reviews.registerImageUpload',
      discardImageUpload: 'reviews.discardImageUpload',
    },
    users: { viewer: 'users.viewer' },
  },
}))

import { ReviewComposerDialog } from '../../src/features/social/ReviewComposerDialog'

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

function renderComposer(props: Partial<Parameters<typeof ReviewComposerDialog>[0]> = {}) {
  const onSubmit = props.onSubmit ?? vi.fn().mockResolvedValue(undefined)
  const onClose = props.onClose ?? vi.fn()
  const utils = render(
    <ReviewComposerDialog
      open
      onClose={onClose}
      authorName="Robin Lee"
      companionName="Jordan Companion"
      onSubmit={onSubmit}
      {...props}
    />,
  )
  return { ...utils, onSubmit, onClose }
}

function photoFile(name = 'walk.png', type = 'image/png') {
  return new File(['image-bytes'], name, { type })
}

// jsdom keeps input.files read-only, so hand the element a real list before the
// change event the way a file picker would.
function choosePhotos(files: File[]) {
  const input = document.querySelector('input[type="file"]') as HTMLInputElement
  Object.defineProperty(input, 'files', { configurable: true, value: files })
  fireEvent.change(input)
  return input
}

describe('ReviewComposerDialog', () => {
  it('requires a rating before publishing and publishes the chosen stars', async () => {
    mocks.generateUploadUrl.mockResolvedValue({ uploadId: 'upload-1', uploadUrl: 'https://upload.test' })
    mocks.registerUpload.mockResolvedValue({ uploadId: 'upload-1', storageId: 'storage-1' })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ storageId: 'storage-1' }) }))
    vi.stubGlobal('URL', { ...URL, createObjectURL: vi.fn(() => 'blob:draft'), revokeObjectURL: vi.fn() })

    const { onSubmit, onClose } = renderComposer()

    expect(screen.getByRole('button', { name: 'Publish review' }).hasAttribute('disabled')).toBe(true)
    fireEvent.click(screen.getByRole('radio', { name: '3 stars' }))
    expect(screen.getByText('3 of 5, Good')).toBeTruthy()

    fireEvent.change(screen.getByPlaceholderText('Say a little about the experience. This is what members read.'), {
      target: { value: '  A calm, well-planned session.  ' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Publish review' }))

    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith(3, 'A calm, well-planned session.', []))
    expect(onClose).toHaveBeenCalled()
  })

  it('accepts several chosen photos and publishes every upload id', async () => {
    mocks.generateUploadUrl
      .mockResolvedValueOnce({ uploadId: 'upload-1', uploadUrl: 'https://upload.test/1' })
      .mockResolvedValueOnce({ uploadId: 'upload-2', uploadUrl: 'https://upload.test/2' })
    mocks.registerUpload.mockResolvedValue({})
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ storageId: 'storage-x' }) }))
    vi.stubGlobal('URL', { ...URL, createObjectURL: vi.fn(() => 'blob:draft'), revokeObjectURL: vi.fn() })

    const { onSubmit } = renderComposer()
    fireEvent.click(screen.getByRole('radio', { name: '5 stars' }))

    choosePhotos([photoFile('one.png'), photoFile('two.png')])

    expect(screen.getByLabelText('Selected photos').children).toHaveLength(2)

    fireEvent.click(screen.getByRole('button', { name: 'Publish review' }))

    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith(5, undefined, ['upload-1', 'upload-2']))
    expect(mocks.registerUpload).toHaveBeenCalledTimes(2)
  })

  it('gives a single photo the width of the card and grids several', () => {
    vi.stubGlobal('URL', { ...URL, createObjectURL: vi.fn(() => 'blob:draft'), revokeObjectURL: vi.fn() })
    renderComposer()

    choosePhotos([photoFile('one.png')])
    expect(screen.getByLabelText('Selected photos').getAttribute('data-count')).toBe('1')

    choosePhotos([photoFile('two.png'), photoFile('three.png')])
    expect(screen.getByLabelText('Selected photos').getAttribute('data-count')).toBe('3')
  })

  it('removes a chosen photo and rejects unsupported files', () => {
    vi.stubGlobal('URL', { ...URL, createObjectURL: vi.fn(() => 'blob:draft'), revokeObjectURL: vi.fn() })
    renderComposer()

    choosePhotos([photoFile('notes.txt', 'text/plain')])
    expect(screen.getByRole('alert').textContent).toContain('is not a JPEG, PNG, or WebP image')

    choosePhotos([photoFile('one.png'), photoFile('two.png')])
    expect(screen.getByLabelText('Selected photos').children).toHaveLength(2)
    fireEvent.click(screen.getByRole('button', { name: 'Remove one.png' }))
    expect(screen.getByLabelText('Selected photos').children).toHaveLength(1)
  })

  it('caps the draft at four photos and highlights the zone while dragging', () => {
    vi.stubGlobal('URL', { ...URL, createObjectURL: vi.fn(() => 'blob:draft'), revokeObjectURL: vi.fn() })
    renderComposer()

    const editor = document.querySelector('.review-editor')!
    fireEvent.dragEnter(editor)
    expect(editor.getAttribute('data-dragging')).toBe('true')
    expect(screen.getByText('Drop to add photos')).toBeTruthy()
    fireEvent.dragLeave(editor)
    expect(editor.getAttribute('data-dragging')).toBeNull()

    choosePhotos([1, 2, 3, 4, 5].map((index) => photoFile(`photo-${index}.png`)))

    expect(screen.getByLabelText('Selected photos').children).toHaveLength(4)
    expect(screen.getByRole('alert').textContent).toContain('up to 4 photos')
  })

  it('drops the Companion line when the review cannot reach the feed', () => {
    renderComposer({ companionName: undefined })

    expect(screen.queryByText(/Shared an experience with/)).toBeNull()
    expect(screen.getByRole('radio', { name: '5 stars' })).toBeTruthy()
    expect(screen.getByRole('article', { name: 'Write your review' })).toBeTruthy()
  })
})
