import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { useState } from 'react'
import { isAdminRole } from '@lets-be-friends/shared'
import { api } from '../../../web/convex/_generated/api'
import { ActionNote } from '../design-system/molecules/ActionNote'
import { AdminTable } from '../design-system/organisms/AdminTable'

type RoleFilter = 'all' | 'member' | 'companion' | 'reviewer' | 'admin'
type SuspendedFilter = 'all' | 'active' | 'suspended'

export const Route = createFileRoute('/users')({ component: UsersPage })

function UsersPage() {
  const viewer = useQuery(api.users.viewer)
  const [role, setRole] = useState<RoleFilter>('all')
  const [suspended, setSuspended] = useState<SuspendedFilter>('all')
  const [search, setSearch] = useState('')
  const rows = useQuery(api.admin.users, viewer?.role === 'admin' ? {
    role,
    suspended: suspended === 'all' ? undefined : suspended === 'suspended',
    query: search || undefined,
  } : 'skip')
  const setSuspendedStatus = useMutation(api.admin.setUserSuspended)
  const setReviewerStatus = useMutation(api.admin.setReviewerStatus)
  const setAdminStatus = useMutation(api.admin.setAdminStatus)

  if (viewer && viewer.role !== 'admin') return <AdminOnly title="Users" />

  return (
    <>
      <header className="admin-page-header">
        <div>
          <p className="eyebrow">Admin controls</p>
          <h1 className="text-h1 mt-2">Users</h1>
          <p className="lede mt-2">Suspend accounts and manage admin or reviewer access. Role changes use the single-role model.</p>
        </div>
      </header>

      <div className="admin-filter-row">
        <label className="field-row">
          <span className="label">Role</span>
          <select className="field" value={role} onChange={(event) => setRole(event.currentTarget.value as RoleFilter)}>
            <option value="all">All roles</option>
            <option value="member">Members</option>
            <option value="companion">Companions</option>
            <option value="reviewer">Reviewers</option>
            <option value="admin">Admins</option>
          </select>
        </label>
        <label className="field-row">
          <span className="label">Status</span>
          <select className="field" value={suspended} onChange={(event) => setSuspended(event.currentTarget.value as SuspendedFilter)}>
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
          </select>
        </label>
        <label className="field-row">
          <span className="label">Search</span>
          <input className="field" value={search} onChange={(event) => setSearch(event.currentTarget.value)} placeholder="Name or Clerk id" />
        </label>
      </div>

      <AdminTable
        rows={rows}
        getKey={(row) => row._id}
        empty="No users match this filter."
        columns={[
          {
            key: 'user',
            header: 'User',
            render: (row) => (
              <>
                <div className="admin-cell-primary">{row.displayName}</div>
                <div className="admin-cell-muted admin-code">{row.clerkUserId}</div>
              </>
            ),
          },
          {
            key: 'role',
            header: 'Role',
            render: (row) => <span className="status-pill" data-tone={isAdminRole(row.role) ? 'success' : undefined}>{row.role}</span>,
          },
          {
            key: 'verification',
            header: 'Verification',
            render: (row) => row.verificationStatus,
          },
          {
            key: 'status',
            header: 'Status',
            render: (row) => <span className="status-pill" data-tone={row.suspended ? 'danger' : 'success'}>{row.suspended ? 'suspended' : 'active'}</span>,
          },
          {
            key: 'actions',
            header: 'Actions',
            render: (row) => (
              <div className="admin-action-stack">
                {row._id === viewer?._id ? (
                  <span className="admin-cell-muted">Current admin</span>
                ) : (
                  <>
                    {row.suspended ? (
                      <ActionNote label="Reinstate" submitLabel="Reinstate" onSubmit={(note) => setSuspendedStatus({ userId: row._id, suspended: false, note })} />
                    ) : (
                      <ActionNote label="Suspend" submitLabel="Suspend" tone="danger" requireNote onSubmit={(note) => setSuspendedStatus({ userId: row._id, suspended: true, note })} />
                    )}
                    {row.role === 'admin' ? (
                      <ActionNote label="Revoke admin" submitLabel="Revoke admin" onSubmit={(note) => setAdminStatus({ userId: row._id, admin: false, note })} />
                    ) : (
                      <>
                        <ActionNote label="Make admin" submitLabel="Make admin" onSubmit={(note) => setAdminStatus({ userId: row._id, admin: true, note })} />
                        {row.role === 'reviewer' ? (
                          <ActionNote label="Revoke reviewer" submitLabel="Revoke reviewer" onSubmit={(note) => setReviewerStatus({ userId: row._id, reviewer: false, note })} />
                        ) : (
                          <ActionNote label="Make reviewer" submitLabel="Make reviewer" onSubmit={(note) => setReviewerStatus({ userId: row._id, reviewer: true, note })} />
                        )}
                      </>
                    )}
                  </>
                )}
              </div>
            ),
          },
        ]}
      />
    </>
  )
}

function AdminOnly({ title }: { title: string }) {
  return (
    <div className="admin-empty">
      {title} is admin-only.
    </div>
  )
}
