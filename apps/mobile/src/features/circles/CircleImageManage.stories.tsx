import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { expect, userEvent, within } from 'storybook/test'

import { CircleImageManageView } from './CircleImageManage'

const meta = {
  title: 'Mobile/Circles/Circle images',
  component: CircleImageManageView,
  globals: { viewport: { value: 'mobileSmall', isRotated: false } },
} satisfies Meta<typeof CircleImageManageView>

export default meta
type Story = StoryObj<typeof meta>

export const NoImages: Story = {
  args: {
    iconUrl: null,
    coverUrl: null,
    active: true,
    busy: '',
    confirmRemove: null,
    error: '',
    onChoose: () => undefined,
    onAskRemove: () => undefined,
    onCancelRemove: () => undefined,
    onRemove: () => undefined,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Circle images')).toBeVisible()
    await expect(canvas.getByRole('button', { name: 'Choose icon' })).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: 'Choose cover' }))
  },
}
