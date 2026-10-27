// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SocialPostCard, type SocialPostView } from '../../src/features/social/SocialPostCard'

const toastSuccess = vi.hoisted(() => vi.fn())

vi.mock('sonner', () => ({ toast: { success: toastSuccess, error: vi.fn() } }))

const post: SocialPostView = {
  _id: 'post-1',
  authorDisplayName: 'Mara Reyes',
  body: 'Learning to cook one new recipe each week.',
  createdAt: Date.UTC(2026, 9, 20, 10, 0),
  media: [],
  liked: false,
  likeCount: 2,
  commentCount: 0,
  saved: false,
}

afterEach(cleanup)

beforeEach(() => {
  toastSuccess.mockReset()
})

function openPostMenu() {
  fireEvent.click(screen.getByRole('button', { name: 'Post options' }))
}

describe('post notification mute action', () => {
  it('mutes a post from the existing action menu and announces the result', async () => {
    const toggle = vi.fn(async () => undefined)
    render(
      <SocialPostCard
        post={post}
        viewerReady
        onToggleComments={vi.fn()}
        onLike={vi.fn()}
        notificationsMuted={false}
        onToggleNotificationsMuted={toggle}
      />,
    )

    openPostMenu()
    fireEvent.click(screen.getByRole('menuitem', { name: 'Mute notifications for this post' }))

    await waitFor(() => expect(toggle).toHaveBeenCalledOnce())
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith('Notifications muted for this post.'))
  })

  it('unmutes a post when it is already muted', async () => {
    const toggle = vi.fn(async () => undefined)
    render(
      <SocialPostCard
        post={post}
        viewerReady
        onToggleComments={vi.fn()}
        onLike={vi.fn()}
        notificationsMuted
        onToggleNotificationsMuted={toggle}
      />,
    )

    openPostMenu()
    fireEvent.click(screen.getByRole('menuitem', { name: 'Unmute notifications for this post' }))

    await waitFor(() => expect(toggle).toHaveBeenCalledOnce())
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith('Notifications unmuted for this post.'))
  })

  it('shows one inline error and no success message when the mute cannot be saved', async () => {
    const toggle = vi.fn(async () => {
      throw new Error('The post notification setting could not be saved.')
    })
    render(
      <SocialPostCard
        post={post}
        viewerReady
        onToggleComments={vi.fn()}
        onLike={vi.fn()}
        notificationsMuted={false}
        onToggleNotificationsMuted={toggle}
      />,
    )

    openPostMenu()
    fireEvent.click(screen.getByRole('menuitem', { name: 'Mute notifications for this post' }))

    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('The post notification setting could not be saved.'))
    expect(screen.getAllByRole('alert')).toHaveLength(1)
    expect(toastSuccess).not.toHaveBeenCalled()
  })

  it('keeps the report option alongside the mute action', () => {
    render(
      <SocialPostCard
        post={post}
        viewerReady
        onToggleComments={vi.fn()}
        onLike={vi.fn()}
        onReport={vi.fn(async () => undefined)}
        onToggleNotificationsMuted={vi.fn(async () => undefined)}
      />,
    )

    openPostMenu()
    expect(screen.getByRole('menuitem', { name: 'Report post' })).toBeTruthy()
    expect(screen.getByRole('menuitem', { name: 'Mute notifications for this post' })).toBeTruthy()
  })
})
