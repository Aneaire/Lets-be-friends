// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ShareDialog } from '../../src/features/social/ShareDialog'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

function mountShareDialog(overrides: Partial<Parameters<typeof ShareDialog>[0]> = {}) {
  const onClose = vi.fn()
  const onShareToFeed = vi.fn().mockResolvedValue(undefined)
  const onCopied = vi.fn()
  render(
    <ShareDialog
      open
      onClose={onClose}
      title="Share this post"
      url="https://app.example.com/social?postId=post-1"
      preview={{ label: 'Post by Alex', body: 'A thoughtful plan', imageUrl: null }}
      onShareToFeed={onShareToFeed}
      onCopied={onCopied}
      {...overrides}
    />,
  )
  return { onClose, onShareToFeed, onCopied }
}

describe('ShareDialog', () => {
  it('copies the link and closes on success', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
    const { onCopied, onClose } = mountShareDialog()

    fireEvent.click(screen.getByRole('button', { name: /Copy link/i }))

    await waitFor(() => expect(writeText).toHaveBeenCalledWith('https://app.example.com/social?postId=post-1'))
    expect(onCopied).toHaveBeenCalled()
    expect(onClose).toHaveBeenCalled()
  })

  it('shares the note to the feed and closes', async () => {
    const { onShareToFeed, onClose } = mountShareDialog()

    fireEvent.change(screen.getByPlaceholderText('Why is this worth sharing?'), { target: { value: 'Worth reading' } })
    fireEvent.click(screen.getByRole('button', { name: 'Share to feed' }))

    await waitFor(() => expect(onShareToFeed).toHaveBeenCalledWith('Worth reading'))
    expect(onClose).toHaveBeenCalled()
  })

  it('shows a recoverable error when sharing fails', async () => {
    const onShareToFeed = vi.fn().mockRejectedValue(new Error('This could not be shared.'))
    mountShareDialog({ onShareToFeed })

    fireEvent.click(screen.getByRole('button', { name: 'Share to feed' }))

    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('This could not be shared.'))
  })
})
