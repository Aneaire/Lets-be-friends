import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { expect, userEvent, within } from 'storybook/test'

import { ReportAction } from './ReportAction'

const meta = {
  title: 'Mobile/Safety/Report action',
  component: ReportAction,
  globals: { viewport: { value: 'mobileSmall', isRotated: false } },
  parameters: {
    a11y: { config: { rules: [{ id: 'aria-allowed-attr', enabled: false }] } },
  },
  args: {
    targetType: 'profile',
    targetId: 'user_2',
    label: 'Report member',
  },
} satisfies Meta<typeof ReportAction>

export default meta
type Story = StoryObj<typeof meta>

export const Closed: Story = {}

export const OpenAndValidated: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Report member' }))
    const dialog = await within(canvasElement.ownerDocument.body).findByRole('dialog', { name: 'Send a safety report' })
    await expect(dialog).toBeInTheDocument()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Send report' }))
    await expect(within(dialog).getByRole('alert')).toHaveTextContent('Explain what needs a safety review.')
  },
}

export const CompactEllipsisOpensSheet: Story = {
  args: {
    targetType: 'message',
    targetId: 'message_1',
    label: 'Report message',
    compact: true,
    iconOnly: true,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const trigger = canvas.getByRole('button', { name: 'Report message' })
    await expect(trigger).toBeVisible()
    await expect(trigger).not.toHaveTextContent('Report message')
    await userEvent.click(trigger)
    const dialog = await within(canvasElement.ownerDocument.body).findByRole('dialog', { name: 'Send a safety report' })
    await expect(dialog).toBeInTheDocument()
  },
}

export const CompactTextRetainsLabel: Story = {
  args: {
    targetType: 'review',
    targetId: 'review_1',
    label: 'Report review',
    compact: true,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const trigger = canvas.getByRole('button', { name: 'Report review' })
    await expect(trigger).toBeVisible()
    await expect(trigger).toHaveTextContent('Report review')
    await userEvent.click(trigger)
    const dialog = await within(canvasElement.ownerDocument.body).findByRole('dialog', { name: 'Send a safety report' })
    await expect(dialog).toBeInTheDocument()
  },
}
