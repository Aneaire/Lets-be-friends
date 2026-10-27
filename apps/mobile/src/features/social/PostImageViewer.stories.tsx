import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { useRef, useState } from 'react'
import { View } from 'react-native'
import { expect, userEvent, waitFor, within } from 'storybook/test'

import { PostImageViewer } from './PostImageViewer'

const photo = { url: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', index: 0, total: 1 }

function ViewerExample() {
  const [open, setOpen] = useState(true)
  const target = useRef<View>(null)
  return <View ref={target} style={{ flex: 1, minHeight: 600 }}><PostImageViewer image={open ? photo : null} blurTarget={target} onClose={() => setOpen(false)} /></View>
}

const meta = { title: 'Mobile/Social/Image viewer', component: ViewerExample, globals: { viewport: { value: 'mobileSmall', isRotated: false } } } satisfies Meta<typeof ViewerExample>
export default meta
type Story = StoryObj<typeof meta>

export const ZoomAndClose: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await waitFor(() => expect(canvas.getAllByRole('img', { name: 'Full-screen post image 1 of 1' })[0]).toBeVisible())
    await userEvent.click(canvas.getAllByRole('img', { name: 'Full-screen post image 1 of 1' })[0])
    await expect(canvas.getByRole('button', { name: 'Close full-screen image' })).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: 'Zoom in' }))
    await expect(canvas.getByText('150%')).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: 'Zoom out' }))
    await expect(canvas.getByText('100%')).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: 'Close image viewer' }))
    await expect(canvas.queryAllByRole('img', { name: 'Full-screen post image 1 of 1' })).toHaveLength(0)
  },
}
