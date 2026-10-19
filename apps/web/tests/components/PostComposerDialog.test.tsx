// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi, type Mock } from 'vitest'

vi.mock('convex/react', () => ({
  useQuery: () => undefined,
  useMutation: () => vi.fn(),
}))

vi.mock('../../convex/_generated/api', () => ({
  api: { social: { mentionLookup: 'social.mentionLookup' } },
}))

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, ...props }: { children: React.ReactNode }) => <a href="#" {...props}>{children}</a>,
}))

import { PostComposerDialog } from '../../src/features/social/PostComposerDialog'
import type { SelectedMedia } from '../../src/features/social/postMediaUpload'
import type { PollDraft } from '../../src/features/social/PollComposer'

type PostInput = { body: string; media: SelectedMedia[]; poll?: PollDraft }
type PostHandler = (input: PostInput) => Promise<void>

afterEach(cleanup)

function renderDialog(overrides: Partial<Parameters<typeof PostComposerDialog>[0]> = {}) {
  const onPost: Mock<PostHandler> = (overrides.onPost as Mock<PostHandler> | undefined) ?? vi.fn(async () => undefined)
  const onClose = overrides.onClose ?? vi.fn()
  const onBodyChange = overrides.onBodyChange ?? vi.fn()
  const utils = render(
    <PostComposerDialog
      open
      mode="media"
      onClose={onClose}
      body=""
      onBodyChange={onBodyChange}
      authorName="Robin Lee"
      mediaLimit={5}
      remainingUploads={5}
      onPost={onPost}
      {...overrides}
    />,
  )
  return { ...utils, onPost, onClose, onBodyChange }
}

function mediaFile(name = 'desk.png', type = 'image/png') {
  return new File(['bytes'], name, { type })
}

// jsdom keeps input.files read-only, so hand the element a real list first.
function chooseMedia(files: File[]) {
  const input = document.querySelector('input[type="file"]') as HTMLInputElement
  Object.defineProperty(input, 'files', { configurable: true, value: files })
  fireEvent.change(input)
}

describe('PostComposerDialog', () => {
  it('composes photos on the post card itself', async () => {
    vi.stubGlobal('URL', { ...URL, createObjectURL: vi.fn(() => 'blob:draft'), revokeObjectURL: vi.fn() })
    const { onPost, onClose } = renderDialog({ body: 'Coffee run plan.' })

    expect(screen.getByRole('article', { name: 'Write your post' })).toBeTruthy()
    expect(screen.getByText('5 of 5 daily media uploads left')).toBeTruthy()
    expect(screen.getByRole('group', { name: 'Post actions' })).toBeTruthy()

    chooseMedia([mediaFile('one.png')])
    expect(document.querySelectorAll('.social-media-preview')).toHaveLength(1)
    expect(screen.getByText('Add more photos or video')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Post' }))
    await vi.waitFor(() => expect(onPost).toHaveBeenCalledTimes(1))
    expect(onPost.mock.calls[0][0]).toMatchObject({ body: 'Coffee run plan.' })
    expect(onPost.mock.calls[0][0].media).toHaveLength(1)
    expect(onPost.mock.calls[0][0].poll).toBeUndefined()
    expect(onClose).toHaveBeenCalled()
  })

  it('removes a chosen photo and rejects files that are not media', () => {
    vi.stubGlobal('URL', { ...URL, createObjectURL: vi.fn(() => 'blob:draft'), revokeObjectURL: vi.fn() })
    renderDialog()

    chooseMedia([mediaFile('notes.txt', 'text/plain')])
    expect(screen.getByRole('alert').textContent).toContain('is not a photo or video')

    chooseMedia([mediaFile('one.png'), mediaFile('two.png')])
    expect(document.querySelectorAll('.social-media-preview')).toHaveLength(2)
    fireEvent.click(screen.getAllByRole('button', { name: 'Remove media' })[0])
    expect(document.querySelectorAll('.social-media-preview')).toHaveLength(1)
  })

  it('stops at the daily upload allowance', () => {
    vi.stubGlobal('URL', { ...URL, createObjectURL: vi.fn(() => 'blob:draft'), revokeObjectURL: vi.fn() })
    renderDialog({ remainingUploads: 1 })

    chooseMedia([mediaFile('one.png'), mediaFile('two.png')])
    expect(document.querySelectorAll('.social-media-preview')).toHaveLength(1)
    expect(screen.getByRole('alert').textContent).toContain('You can add 1 more item today')
  })

  it('edits the poll inside the card and validates it before posting', async () => {
    const { onPost } = renderDialog({ mode: 'poll' })

    expect(screen.getByRole('article', { name: 'Write your post' })).toBeTruthy()
    expect(screen.getByText('Poll', { selector: 'legend' })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Post' }))
    await vi.waitFor(() => expect(screen.getAllByRole('alert').length).toBeGreaterThan(0))
    expect(screen.getAllByRole('alert')[0].textContent).toContain('Poll question')
    expect(onPost).not.toHaveBeenCalled()

    fireEvent.change(screen.getByPlaceholderText('Ask the community a question'), {
      target: { value: 'Which evening suits everyone?' },
    })
    fireEvent.change(screen.getByPlaceholderText('Option 1'), { target: { value: 'Friday' } })
    fireEvent.change(screen.getByPlaceholderText('Option 2'), { target: { value: 'Saturday' } })
    fireEvent.click(screen.getByRole('button', { name: 'Post' }))

    await vi.waitFor(() => expect(onPost).toHaveBeenCalledTimes(1))
    expect(onPost.mock.calls[0][0].poll).toEqual({
      question: 'Which evening suits everyone?',
      options: ['Friday', 'Saturday'],
    })
  })

  it('asks for something to post when the draft is empty', async () => {
    const { onPost } = renderDialog()

    fireEvent.click(screen.getByRole('button', { name: 'Post' }))
    await vi.waitFor(() => expect(screen.getByRole('alert')).toBeTruthy())
    expect(screen.getByRole('alert').textContent).toContain('Write something')
    expect(onPost).not.toHaveBeenCalled()
  })
})
