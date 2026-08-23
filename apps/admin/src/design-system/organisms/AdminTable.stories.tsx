import type { Meta, StoryObj } from '@storybook/react-vite'

import { AdminTable } from './AdminTable'

type ReviewRow = { id: string; member: string; state: string; submitted: string }

const rows: ReviewRow[] = [
  { id: '1', member: 'Alex Rivera', state: 'Needs review', submitted: 'Today, 9:42 AM' },
  { id: '2', member: 'Sam Lee', state: 'Approved', submitted: 'Yesterday, 4:18 PM' },
]

function AdminTableStory() {
  return (
    <AdminTable
      rows={rows}
      columns={[
        { key: 'member', header: 'Member', render: (row) => <span className="admin-cell-primary">{row.member}</span> },
        { key: 'state', header: 'State', render: (row) => row.state },
        { key: 'submitted', header: 'Submitted', render: (row) => row.submitted },
      ]}
      getKey={(row) => row.id}
      empty="No reviews"
    />
  )
}

const meta = {
  title: 'Admin/Organisms/Table',
  component: AdminTableStory,
  parameters: { layout: 'padded' },
  globals: { viewport: 'mobileDefault' },
} satisfies Meta<typeof AdminTableStory>

export default meta
type Story = StoryObj<typeof meta>

export const CompactMobile: Story = {}
