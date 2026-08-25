import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'

import { AdminAccessPresentation } from './AdminAccessPresentation'

const signIn = fn()
const syncProfile = fn(async () => undefined)
const signOut = fn(async () => undefined)

const meta = {
  title: 'Admin/Templates/Access states',
  component: AdminAccessPresentation,
  parameters: { layout: 'fullscreen' },
  args: {
    state: 'loading',
    userAppHref: 'https://example.test/app',
    onSyncProfile: syncProfile,
    onSignOut: signOut,
  },
} satisfies Meta<typeof AdminAccessPresentation>

export default meta
type Story = StoryObj<typeof meta>

export const Loading: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(
      canvas.getByRole('img', { name: "Let's Be Friends" }),
    ).toBeVisible()
    await expect(
      canvas.getByRole('heading', {
        name: 'Preparing your workspace',
      }),
    ).toBeVisible()
    await expect(canvas.getByRole('main')).toHaveAttribute(
      'aria-busy',
      'true',
    )
    await expect(canvas.getByRole('status')).toHaveTextContent(
      'Verifying secure access',
    )
  },
}

export const LoadingNarrowDark: Story = {
  globals: { viewport: 'mobileSmall', theme: 'dark' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvasElement.scrollWidth).toBeLessThanOrEqual(
      canvasElement.clientWidth,
    )
    await expect(
      canvas.getByRole('heading', {
        name: 'Preparing your workspace',
      }),
    ).toBeVisible()
    await expect(canvas.getByRole('status')).toBeVisible()
  },
}

export const SignedOut: Story = {
  args: {
    state: 'signed_out',
    signInAction: (
      <button type="button" className="btn btn-neutral" onClick={signIn}>
        Sign in
      </button>
    ),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(
      canvas.getByRole('img', { name: "Let's Be Friends" }),
    ).toBeVisible()
    await expect(
      canvas.getByRole('heading', { name: 'Admin sign in' }),
    ).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: 'Sign in' }))
    await expect(signIn).toHaveBeenCalledOnce()
  },
}

export const SyncProfile: Story = {
  args: { state: 'sync_profile' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(
      canvas.getByRole('img', { name: "Let's Be Friends" }),
    ).toBeVisible()
    await expect(
      canvas.getByRole('heading', { name: 'Sync profile' }),
    ).toBeVisible()
    await userEvent.click(
      canvas.getByRole('button', { name: 'Sync profile' }),
    )
    await expect(syncProfile).toHaveBeenCalledOnce()
  },
}

export const Denied: Story = {
  args: { state: 'denied' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(
      canvas.getByRole('img', { name: "Let's Be Friends" }),
    ).toBeVisible()
    await expect(
      canvas.getByRole('heading', { name: 'Admin access required' }),
    ).toBeVisible()
    await userEvent.click(
      canvas.getByRole('button', {
        name: 'Sign out and switch account',
      }),
    )
    await expect(signOut).toHaveBeenCalledOnce()
    await expect(
      canvas.getByRole('link', { name: 'Open user app' }),
    ).toHaveAttribute('href', 'https://example.test/app')
  },
}

export const DeniedNarrowDark: Story = {
  globals: { viewport: 'mobileSmall', theme: 'dark' },
  args: { state: 'denied' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvasElement.scrollWidth).toBeLessThanOrEqual(
      canvasElement.clientWidth,
    )
    await expect(
      canvas.getByRole('img', { name: "Let's Be Friends" }),
    ).toBeVisible()
    await expect(
      canvas.getByRole('heading', { name: 'Admin access required' }),
    ).toBeVisible()
  },
}
