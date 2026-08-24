import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { expect, fn, userEvent, within } from 'storybook/test'

import { AdminWorklistPagePresentation } from './AdminWorklistPagePresentation'

type ReviewRecord = {
  id: string
  member: string
  target: string
  status: 'Open' | 'Reviewing' | 'Resolved'
  submitted: string
  reason: string
  note?: string
}

const openRecord = fn()
const markReviewing = fn()
const resolveRecord = fn()
const dismissRecord = fn()

const records: ReviewRecord[] = [
  {
    id: 'report-1024',
    member: 'Alex Rivera',
    target: 'Booking conversation practice',
    status: 'Open',
    submitted: 'Today, 9:42 AM',
    reason: 'The meeting details changed after the booking was accepted.',
  },
  {
    id: 'report-1023',
    member: 'Sam Lee',
    target: 'Member profile',
    status: 'Reviewing',
    submitted: 'Yesterday, 4:18 PM',
    reason: 'The public profile description may not match the member.',
    note: 'Last internal note: Identity review is still pending.',
  },
]

function FilterControls() {
  return (
    <>
      <label className="field-row">
        <span className="label">Status</span>
        <select className="field" defaultValue="open">
          <option value="open">Open</option>
          <option value="reviewing">Reviewing</option>
          <option value="all">All</option>
        </select>
      </label>
      <label className="field-row">
        <span className="label">Target</span>
        <select className="field" defaultValue="all">
          <option value="all">All targets</option>
          <option value="booking">Bookings</option>
          <option value="profile">Profiles</option>
        </select>
      </label>
    </>
  )
}

function ReviewWorklist({
  rows = records,
  loading = false,
  manyActions = false,
}: {
  rows?: ReviewRecord[]
  loading?: boolean
  manyActions?: boolean
}) {
  return (
    <AdminWorklistPagePresentation
      eyebrow="Moderation"
      title="Reports"
      description="Triage member-submitted concerns while keeping private evidence and internal notes restricted to authorized reviewers."
      filterControls={<FilterControls />}
      rows={loading ? undefined : rows}
      getKey={(record) => record.id}
      loading="Loading reports..."
      empty="No reports match this filter."
      ariaLabel="Safety reports"
      renderRecord={(record) => (
        <>
          <div className="worklist-row-head">
            <div>
              <h2 className="text-h3">{record.target}</h2>
              <div className="worklist-row-meta">
                <span>Reporter: {record.member}</span>
                <span className="dot" aria-hidden="true" />
                <span>{record.submitted}</span>
                <span className="dot" aria-hidden="true" />
                <span className="status-pill" data-tone={record.status === 'Resolved' ? 'success' : 'warning'}>{record.status}</span>
                <span className="dot" aria-hidden="true" />
                <span className="admin-code">{record.id}</span>
              </div>
            </div>
            <div className="admin-action-stack">
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => openRecord(record.id)}>Open</button>
              <button type="button" className="btn btn-neutral btn-sm" onClick={() => markReviewing(record.id)}>Mark reviewing</button>
              {manyActions ? <button type="button" className="btn btn-neutral btn-sm" onClick={() => resolveRecord(record.id)}>Resolve</button> : null}
              {manyActions ? <button type="button" className="btn btn-danger btn-sm" onClick={() => dismissRecord(record.id)}>Dismiss</button> : null}
            </div>
          </div>
          <p className="text-body muted max-w-[76ch]">{record.reason}</p>
          {record.note ? <p className="text-meta">{record.note}</p> : null}
        </>
      )}
    />
  )
}

const meta = {
  title: 'Admin/Templates/Worklist page',
  component: ReviewWorklist,
  parameters: { layout: 'padded' },
} satisfies Meta<typeof ReviewWorklist>

export default meta
type Story = StoryObj<typeof meta>

export const PopulatedDesktop: Story = {
  globals: { viewport: 'reset' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(
      canvas.getByRole('region', { name: 'Safety reports' }),
    ).toBeVisible()
    await userEvent.click(canvas.getAllByRole('button', { name: 'Open' })[0])
    await expect(openRecord).toHaveBeenCalledWith('report-1024')
  },
}

export const Loading: Story = {
  args: { loading: true },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('status')).toHaveTextContent(
      'Loading reports...',
    )
  },
}

export const Empty: Story = {
  args: { rows: [] },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByText('No reports match this filter.'),
    ).toBeVisible()
  },
}

export const LongRecordAt320: Story = {
  globals: { viewport: 'mobileSmall' },
  args: {
    rows: [
      {
        id: 'report-with-a-long-auditable-identifier-2026-08-24',
        member: 'Alexandria Rivera-Santos with a long account name',
        target: 'Private booking evidence review for an extended community language exchange',
        status: 'Open',
        submitted: 'Sunday, August 24, 2026 at 11:48 PM',
        reason: 'The report includes a detailed account of what changed, which records should be checked, and why only authorized reviewers should access the private evidence.',
        note: 'Last internal note: Review the booking timeline before retrieving either participant evidence image.',
      },
    ],
  },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.scrollWidth).toBeLessThanOrEqual(
      canvasElement.clientWidth,
    )
  },
}

export const ManyActionsNarrow: Story = {
  globals: { viewport: 'mobileDefault' },
  args: { manyActions: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getAllByRole('button', { name: 'Resolve' })[0]).toBeVisible()
    await expect(canvas.getAllByRole('button', { name: 'Dismiss' })[0]).toBeVisible()
    await expect(canvasElement.scrollWidth).toBeLessThanOrEqual(
      canvasElement.clientWidth,
    )
  },
}

function ControlledFilters() {
  const [status, setStatus] = useState('open')
  const [target, setTarget] = useState('all')

  return (
    <AdminWorklistPagePresentation
      eyebrow="Moderation"
      title="Reports"
      description={<span>Selected filters: {status} · {target}</span>}
      filterControls={(
        <>
          <label className="field-row">
            <span className="label">Status</span>
            <select className="field" value={status} onChange={(event) => setStatus(event.currentTarget.value)}>
              <option value="open">Open</option>
              <option value="reviewing">Reviewing</option>
            </select>
          </label>
          <label className="field-row">
            <span className="label">Target</span>
            <select className="field" value={target} onChange={(event) => setTarget(event.currentTarget.value)}>
              <option value="all">All targets</option>
              <option value="booking">Bookings</option>
            </select>
          </label>
        </>
      )}
      rows={[] as ReviewRecord[]}
      getKey={(record) => record.id}
      renderRecord={() => null}
      loading="Loading reports..."
      empty="No reports match this filter."
      ariaLabel="Safety reports"
    />
  )
}

export const FilterInteraction: Story = {
  render: () => <ControlledFilters />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.selectOptions(canvas.getByLabelText('Status'), 'reviewing')
    await userEvent.selectOptions(canvas.getByLabelText('Target'), 'booking')
    await expect(canvas.getByText(/Selected filters:/)).toHaveTextContent(
      'reviewing · booking',
    )
  },
}

export const NarrowDark: Story = {
  globals: { theme: 'dark', viewport: 'mobileDefault' },
  args: { manyActions: true },
}
