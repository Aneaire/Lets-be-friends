import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { useState } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'

import { AppText } from '@/design-system/atoms/Typography'

import { VideoViewerShell } from './VideoViewerShell'
import { VIDEO_VIEWER_ERROR_MESSAGE } from './videoPresentation'

function MockPlayback({ label }: { label: string }) {
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={label} style={styles.mock}>
      <AppText color="#FFFFFF">{label}</AppText>
    </View>
  )
}

const meta = {
  title: 'Mobile/Organisms/Video viewer shell',
  globals: { viewport: { value: 'mobileSmall', isRotated: false } },
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

export const Ready: Story = {
  render: () => (
    <VideoViewerShell title="Weekend plans" error={null} onClose={fn()} onRetry={fn()}>
      <MockPlayback label="Mock video playback" />
    </VideoViewerShell>
  ),
}

const retryPlayback = fn()

export const PlaybackError: Story = {
  render: () => (
    <VideoViewerShell
      title="Weekend plans"
      error={VIDEO_VIEWER_ERROR_MESSAGE}
      onClose={fn()}
      onRetry={retryPlayback}
    >
      <MockPlayback label="Mock video playback" />
    </VideoViewerShell>
  ),
  play: async ({ canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body)
    await userEvent.click(page.getByRole('button', { name: 'Try again' }))
    await expect(retryPlayback).toHaveBeenCalledTimes(1)
  },
}

export const Dark: Story = {
  globals: { theme: 'dark' },
  render: () => (
    <VideoViewerShell title="Weekend plans" error={null} onClose={fn()} onRetry={fn()}>
      <MockPlayback label="Mock video playback" />
    </VideoViewerShell>
  ),
  play: async ({ canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body)
    await expect(page.getByText('Weekend plans')).toBeVisible()
    await expect(page.getByText('Weekend plans')).toHaveStyle({ color: 'rgb(255, 255, 255)' })
  },
}

function DismissableViewer() {
  const [open, setOpen] = useState(true)

  if (!open) {
    return (
      <Pressable accessibilityRole="button" accessibilityLabel="Reopen video viewer" onPress={() => setOpen(true)}>
        <AppText>Reopen video viewer</AppText>
      </Pressable>
    )
  }

  return (
    <VideoViewerShell title="Weekend plans" error={null} onClose={() => setOpen(false)} onRetry={fn()}>
      <MockPlayback label="Mock video playback" />
    </VideoViewerShell>
  )
}

export const Dismissable: Story = {
  render: () => <DismissableViewer />,
  play: async ({ canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body)
    await userEvent.click(page.getByRole('button', { name: 'Close video viewer' }))
    await expect(page.getByRole('button', { name: 'Reopen video viewer' })).toBeVisible()
    await userEvent.click(page.getByRole('button', { name: 'Reopen video viewer' }))
    await expect(page.getByRole('button', { name: 'Close video viewer' })).toBeVisible()
  },
}

const styles = StyleSheet.create({
  mock: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#000000' },
})
