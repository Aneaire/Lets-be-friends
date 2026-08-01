import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from 'convex/react'
import { api } from '../../../web/convex/_generated/api'
import { AdminTable } from '../components/AdminTable'

export const Route = createFileRoute('/audit-logs')({ component: AuditLogsPage })

function AuditLogsPage() {
  const viewer = useQuery(api.users.viewer)
  const rows = useQuery(api.admin.auditLogs, viewer?.role === 'admin' ? { limit: 50 } : 'skip')

  if (viewer && viewer.role !== 'admin') return <div className="admin-empty">Audit logs are admin-only.</div>

  return (
    <>
      <header className="admin-page-header">
        <div>
          <p className="eyebrow">Admin controls</p>
          <h1 className="text-h1 mt-2">Audit logs</h1>
          <p className="lede mt-2">Latest admin and member actions captured for operational traceability.</p>
        </div>
      </header>

      <AdminTable
        rows={rows}
        getKey={(row) => row._id}
        empty="No audit logs yet."
        columns={[
          {
            key: 'action',
            header: 'Action',
            render: (row) => (
              <>
                <div className="admin-cell-primary">{row.action}</div>
                <div className="admin-cell-muted">{row.actorDisplayName}</div>
              </>
            ),
          },
          {
            key: 'target',
            header: 'Target',
            render: (row) => (
              <>
                <div>{row.targetType}</div>
                {row.targetId && <div className="admin-code">{row.targetId}</div>}
              </>
            ),
          },
          {
            key: 'note',
            header: 'Note',
            render: (row) => row.note ? <span>{row.note}</span> : <span className="text-soft">None</span>,
          },
          {
            key: 'payload',
            header: 'Before / after',
            render: (row) => (
              row.before || row.after ? (
                <details>
                  <summary className="text-meta cursor-pointer">Inspect</summary>
                  <pre className="text-tiny whitespace-pre-wrap">{JSON.stringify({ before: row.before, after: row.after }, null, 2)}</pre>
                </details>
              ) : <span className="text-soft">None</span>
            ),
          },
          {
            key: 'created',
            header: 'Created',
            render: (row) => <span className="tabular">{formatTime(row.createdAt)}</span>,
          },
        ]}
      />
    </>
  )
}

function formatTime(timestamp: number) {
  return new Date(timestamp).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}
