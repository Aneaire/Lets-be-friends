import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { useState } from 'react'
import { api } from '../../../web/convex/_generated/api'
import { ActionNote } from '../components/ActionNote'
import { AdminTable } from '../components/AdminTable'

type Visibility = 'visible' | 'hidden' | 'all'

export const Route = createFileRoute('/posts')({ component: PostsPage })

function PostsPage() {
  const [visibility, setVisibility] = useState<Visibility>('visible')
  const rows = useQuery(api.admin.posts, { visibility })
  const setHidden = useMutation(api.admin.setPostHidden)

  return (
    <>
      <header className="admin-page-header">
        <div>
          <p className="eyebrow">Moderation</p>
          <h1 className="text-h1 mt-2">Posts</h1>
          <p className="lede mt-2">Hide or restore community posts after safety review.</p>
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
        empty="No posts match this filter."
        columns={[
          {
            key: 'post',
            header: 'Post',
            render: (row) => (
              <>
                <div className="admin-cell-primary">{row.authorDisplayName}</div>
                <p className="admin-cell-muted max-w-[56ch]">{row.body}</p>
                {row.media.length > 0 && (
                  <div className="social-media-grid mt-3" data-count={row.media.length}>
                    {row.media.map((item) => (
                      <div key={item.storageId} className="social-media-item">
                        {item.url && item.kind === 'image' && <img src={item.url} alt="" />}
                        {item.url && item.kind === 'video' && <video src={item.url} controls preload="metadata" />}
                      </div>
                    ))}
                  </div>
                )}
              </>
            ),
          },
          {
            key: 'status',
            header: 'Status',
            render: (row) => <span className="status-pill" data-tone={row.hidden ? 'danger' : 'success'}>{row.deletedAt ? 'deleted by author' : row.hidden ? 'hidden' : 'visible'}</span>,
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
              row.deletedAt ? (
                <span className="text-meta">Evidence retained</span>
              ) : row.hidden ? (
                <ActionNote label="Unhide" submitLabel="Unhide" onSubmit={(note) => setHidden({ postId: row._id, hidden: false, note })} />
              ) : (
                <ActionNote label="Hide" submitLabel="Hide" tone="danger" requireNote onSubmit={(note) => setHidden({ postId: row._id, hidden: true, note })} />
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
