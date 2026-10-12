import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { useState } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import { expect, userEvent, within } from 'storybook/test'

import { AppText } from '@/design-system/atoms/Typography'

import { NativeVideoViewer } from './NativeVideoViewer'

const unavailableVideo = 'not-a-video-url'

const meta = {
  title: 'Mobile/Organisms/Native video viewer',
  globals: { viewport: { value: 'mobileSmall', isRotated: false } },
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

export const Closed: Story = {
  render: () => <NativeVideoViewer url={null} onClose={() => undefined} />,
}

export const Unavailable: Story = {
  render: () => <NativeVideoViewer url={unavailableVideo} title="Weekend plans" onClose={() => undefined} />,
}

function DismissableViewer() {
  const [videoUrl, setVideoUrl] = useState<string | null>(unavailableVideo)

  if (!videoUrl) {
    return (
      <View style={styles.closed}>
        <AppText>Video viewer closed. Playback and listeners are released.</AppText>
        <Pressable accessibilityRole="button" accessibilityLabel="Reopen video viewer" onPress={() => setVideoUrl(unavailableVideo)}>
          <AppText>Reopen video viewer</AppText>
        </Pressable>
      </View>
    )
  }

  return <NativeVideoViewer url={videoUrl} title="Weekend plans" onClose={() => setVideoUrl(null)} />
}

export const Dismissable: Story = {
  render: () => <DismissableViewer />,
  play: async ({ canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body)
    await userEvent.click(page.getByRole('button', { name: 'Close video viewer' }))
    await expect(page.getByRole('button', { name: 'Reopen video viewer' })).toBeVisible()
    await userEvent.click(page.getByRole('button', { name: 'Reopen video viewer' }))
    await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible()
    await userEvent.click(page.getByRole('button', { name: 'Try again' }))
    await expect(page.getByRole('button', { name: 'Reopen video viewer' })).toBeVisible()
  },
}

const styles = StyleSheet.create({
  closed: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
})
