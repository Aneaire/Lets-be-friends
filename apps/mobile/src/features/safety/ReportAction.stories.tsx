import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { expect, userEvent, within } from 'storybook/test'

import { ReportAction } from './ReportAction'

const meta = {
  title: 'Mobile/Safety/Report action',
  component: ReportAction,
  parameters: {
    viewport: { defaultViewport: 'mobileSmall' },
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
