import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { useState } from 'react'
import { api } from '../../../web/convex/_generated/api'
import { ActionNote } from '../components/ActionNote'
import { AdminTable } from '../components/AdminTable'

type Visibility = 'visible' | 'hidden' | 'all'

export const Route = createFileRoute('/reviews')({ component: ReviewsPage })

function ReviewsPage() {
  const [visibility, setVisibility] = useState<Visibility>('visible')
  const rows = useQuery(api.admin.reviews, { visibility })
  const setHidden = useMutation(api.admin.setReviewHidden)

  return (
    <>
      <header className="admin-page-header">
        <div>
          <p className="eyebrow">Moderation</p>
          <h1 className="text-h1 mt-2">Reviews</h1>
          <p className="lede mt-2">Hide or restore reviews while keeping reviewer history in the audit log.</p>
        </div>
      </header>

      <div className="admin-filter-row">
        <label className="field-row">
          <span className="label">Visibility</span>
          <select className="field" value={visibility} onChange={(event) => setVisibility(event.currentTarget.value as Visibility)}>
            <option value="visible">Visible</option>
            <option value="hidden">Hidden</option>
            <option value="all">All</option>
          </select>
        </label>
      </div>

      <AdminTable
        rows={rows}
        getKey={(row) => row._id}
        empty="No reviews match this filter."
        columns={[
          {
            key: 'review',
            header: 'Review',
            render: (row) => (
              <>
                <div className="admin-cell-primary">{row.rating} stars from {row.reviewerDisplayName}</div>
                <div className="admin-cell-muted">For {row.revieweeDisplayName}{row.hostDisplayName ? `, ${row.hostDisplayName}` : ''}</div>
                {row.body && <p className="admin-cell-muted max-w-[56ch]">{row.body}</p>}
              </>
            ),
          },
          {
            key: 'status',
            header: 'Status',
            render: (row) => <span className="status-pill" data-tone={row.hidden ? 'danger' : 'success'}>{row.hidden ? 'hidden' : 'visible'}</span>,
          },
          {
            key: 'created',
            header: 'Created',
            render: (row) => <span className="tabular">{formatTime(row.createdAt)}</span>,
          },
          {
            key: 'actions',
            header: 'Actions',
            render: (row) => (
              row.hidden ? (
                <ActionNote label="Unhide" submitLabel="Unhide" onSubmit={(note) => setHidden({ reviewId: row._id, hidden: false, note })} />
              ) : (
                <ActionNote label="Hide" submitLabel="Hide" tone="danger" requireNote onSubmit={(note) => setHidden({ reviewId: row._id, hidden: true, note })} />
              )
            ),
          },
        ]}
      />
    </>
  )
}

function formatTime(timestamp: number) {
  return new Date(timestamp).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}
