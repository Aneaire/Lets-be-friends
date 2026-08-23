import type { Meta, StoryObj } from '@storybook/react-vite'

import { PostActionsMenu } from './PostActionsMenu'

const meta = {
  title: 'Features/Social/Post actions menu',
  component: PostActionsMenu,
  globals: { viewport: 'mobileDefault' },
  args: {
    ownedByViewer: false,
    onEdit: () => undefined,
    onDelete: () => undefined,
    onReport: () => undefined,
  },
  decorators: [
    (Story) => (
      <div className="social-post-options-story">
        <span className="text-meta">Post header</span>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof PostActionsMenu>

export default meta
type Story = StoryObj<typeof meta>

export const ViewerOptions: Story = {}

export const OwnerOptions: Story = {
  args: { ownedByViewer: true },
}
