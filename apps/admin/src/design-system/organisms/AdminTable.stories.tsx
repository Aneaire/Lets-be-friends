import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'

import {
  AdminTable,
  type AdminTableColumn,
} from './AdminTable'

type ReviewRow = {
  id: string
  member: string
  state: string
  submitted: string
  evidence: string
  reviewer: string
}

const openRecord = fn()
const approveRecord = fn()
const rejectRecord = fn()

const rows: ReviewRow[] = [
  {
    id: '1',
    member: 'Alex Rivera',
    state: 'Needs review',
    submitted: 'Today, 9:42 AM',
    evidence: 'Government ID and live selfie',
    reviewer: 'Unassigned',
  },
  {
    id: '2',
    member: 'Sam Lee',
    state: 'Approved',
    submitted: 'Yesterday, 4:18 PM',
    evidence: 'Government ID',
    reviewer: 'Jordan Kim',
  },
]

const columns: Array<AdminTableColumn<ReviewRow>> = [
  {
    key: 'member',
    header: 'Member',
    render: (row) => (
      <span className="admin-cell-primary">{row.member}</span>
    ),
  },
  { key: 'state', header: 'State', render: (row) => row.state },
  {
    key: 'submitted',
    header: 'Submitted',
    render: (row) => row.submitted,
  },
]

function ReviewTable({
  data = rows,
  tableColumns = columns,
}: {
  data?: ReviewRow[]
  tableColumns?: Array<AdminTableColumn<ReviewRow>>
}) {
  return (
    <AdminTable
      rows={data}
      columns={tableColumns}
      getKey={(row) => row.id}
      empty="No reviews need attention."
    />
  )
}

const meta = {
  title: 'Admin/Organisms/Table',
  component: ReviewTable,
  parameters: { layout: 'padded' },
} satisfies Meta<typeof ReviewTable>

export default meta
type Story = StoryObj<typeof meta>

export const StandardDesktop: Story = {
  globals: { viewport: 'reset' },
}

export const CompactMobile: Story = {
  globals: { viewport: 'mobileDefault' },
}

export const Loading: Story = {
  render: () => (
    <AdminTable
      rows={undefined}
      columns={columns}
      getKey={(row) => row.id}
      empty="No reviews need attention."
    />
  ),
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('Loading...')).toBeVisible()
  },
}

export const Empty: Story = {
  args: { data: [] },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByText('No reviews need attention.'),
    ).toBeVisible()
  },
}

export const LongContent: Story = {
  args: {
    data: [
      {
        id: 'long',
        member: 'Alexandria Rivera-Santos with an intentionally long account name',
        state: 'Needs additional identity evidence before a decision can be made',
        submitted: 'Wednesday, August 19, 2026 at 11:48 PM',
        evidence: 'Government ID, live selfie, and supporting account ownership document',
        reviewer: 'Unassigned',
      },
    ],
  },
  globals: { viewport: 'mobileDefault' },
}

export const HorizontalOverflow: Story = {
  args: {
    tableColumns: [
      ...columns,
      { key: 'evidence', header: 'Evidence', render: (row) => row.evidence },
      { key: 'reviewer', header: 'Reviewer', render: (row) => row.reviewer },
    ],
  },
  globals: { viewport: 'mobileDefault' },
  play: async ({ canvasElement }) => {
    const table = within(canvasElement).getByRole('table')
    const scrollRegion = table.parentElement
    await expect(scrollRegion).not.toBeNull()
    await expect(scrollRegion!.scrollWidth).toBeGreaterThan(
      scrollRegion!.clientWidth,
    )
  },
}

export const ManyActionsNarrow: Story = {
  args: {
    tableColumns: [
      ...columns,
      {
        key: 'actions',
        header: 'Actions',
        render: (row) => (
          <div className="admin-row-actions">
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => openRecord(row.id)}>
              Open
            </button>
            <button
              type="button"
              className="btn btn-neutral btn-sm"
              onClick={() => approveRecord(row.id)}>
              Approve
            </button>
            <button
              type="button"
              className="btn btn-danger btn-sm"
              onClick={() => rejectRecord(row.id)}>
              Reject
            </button>
          </div>
        ),
      },
    ],
  },
  globals: { viewport: 'mobileDefault' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getAllByRole('button', { name: 'Open' })[0])
    await userEvent.click(
      canvas.getAllByRole('button', { name: 'Approve' })[0],
    )
    await userEvent.click(
      canvas.getAllByRole('button', { name: 'Reject' })[0],
    )
    await expect(openRecord).toHaveBeenCalledWith('1')
    await expect(approveRecord).toHaveBeenCalledWith('1')
    await expect(rejectRecord).toHaveBeenCalledWith('1')
  },
}
