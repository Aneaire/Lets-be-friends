// @vitest-environment jsdom

import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { AdminProfileAvatar } from '../../src/components/AdminProfileAvatar'

afterEach(cleanup)

describe('admin profile avatar', () => {
  it('shows the default initials avatar when the admin has no app profile photo', () => {
    const { container } = render(<AdminProfileAvatar name="Alex Rivera" />)

    expect(container.querySelector('.admin-profile-avatar span')?.textContent).toBe('AR')
    expect(container.querySelector('.admin-profile-avatar img')).toBeNull()
  })

  it('shows a photo uploaded to the app profile', () => {
    const { container } = render(<AdminProfileAvatar name="Alex Rivera" imageUrl="/admin-photo.jpg" />)

    expect(container.querySelector('.admin-profile-avatar img')?.getAttribute('src')).toBe('/admin-photo.jpg')
  })
})
