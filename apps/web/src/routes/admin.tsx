import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { useState } from 'react'
import type React from 'react'
import { api } from '../../convex/_generated/api'

export const Route = createFileRoute('/admin')({ component: AdminPage })

function AdminPage() {
  const queues = useQuery(api.admin.queues)
  const reviewHost = useMutation(api.admin.reviewHostApplication)
  const reviewBooking = useMutation(api.admin.reviewBookingVerification)
  const resolveReport = useMutation(api.admin.resolveReport)
  const [notice, setNotice] = useState('')

  if (queues === undefined) return <main className="mx-auto max-w-6xl px-5 py-12"><h1 className="text-4xl font-black text-emerald-950">Admin review</h1><p className="mt-4 text-stone-600">Loading queues. You need a reviewer or owner role in Convex.</p></main>

  return (
    <main className="mx-auto max-w-6xl px-5 py-12">
      <h1 className="text-4xl font-black text-emerald-950">Admin review</h1>
      <p className="mt-3 text-stone-600">Operational trust & safety scaffold: host applications, booking verifications, reports, and audit logs.</p>
      {notice && <div className="mt-4 rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-900">{notice}</div>}
      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Queue title="Host applications">{queues.hostApplications.map((host) => <article key={host._id} className="rounded-2xl border border-stone-200 p-4"><strong>{host.displayName}</strong><p className="mt-1 text-sm text-stone-600">{host.city} · {host.mode}</p><p className="mt-2 text-sm">{host.intro}</p><div className="mt-3 flex gap-2"><button onClick={async () => { await reviewHost({ hostProfileId: host._id, decision: 'approved', note: 'Approved in MVP admin scaffold.' }); setNotice('Host approved.') }} className="rounded-full bg-emerald-900 px-4 py-2 text-sm font-semibold text-white">Approve</button><button onClick={async () => { await reviewHost({ hostProfileId: host._id, decision: 'rejected', note: 'Rejected in MVP admin scaffold.' }); setNotice('Host rejected.') }} className="rounded-full bg-red-50 px-4 py-2 text-sm font-semibold text-red-700">Reject</button></div></article>)}</Queue>
        <Queue title="Booking verification">{queues.bookingVerifications.map((verification) => <article key={verification._id} className="rounded-2xl border border-stone-200 p-4"><strong>{verification.reason}</strong><p className="mt-1 text-sm text-stone-600">Persona: {verification.personaInquiryId ?? 'none'} · {verification.personaStatus}</p><p className="mt-1 text-xs text-stone-500">booking {verification.bookingId ?? '—'}</p><div className="mt-3 flex gap-2"><button onClick={async () => { await reviewBooking({ verificationRequestId: verification._id, decision: 'approved', note: 'Approved in MVP admin scaffold.' }); setNotice('Verification approved; booking request sent when applicable.') }} className="rounded-full bg-emerald-900 px-4 py-2 text-sm font-semibold text-white">Approve</button><button onClick={async () => { await reviewBooking({ verificationRequestId: verification._id, decision: 'rejected', note: 'Rejected in MVP admin scaffold.' }); setNotice('Verification rejected.') }} className="rounded-full bg-red-50 px-4 py-2 text-sm font-semibold text-red-700">Reject</button></div></article>)}</Queue>
        <Queue title="Reports">{queues.reports.map((report) => <article key={report._id} className="rounded-2xl border border-stone-200 p-4"><strong>{report.targetType}</strong><p className="mt-1 text-sm text-stone-600">{report.reason}</p><button onClick={async () => { await resolveReport({ reportId: report._id, status: 'resolved', note: 'Resolved in MVP admin scaffold.' }); setNotice('Report resolved.') }} className="mt-3 rounded-full bg-stone-900 px-4 py-2 text-sm font-semibold text-white">Resolve</button></article>)}</Queue>
        <Queue title="Recent audit logs">{queues.auditLogs.map((log) => <article key={log._id} className="rounded-2xl border border-stone-200 p-4"><strong>{log.action}</strong><p className="mt-1 text-xs text-stone-500">{log.targetType} {log.targetId ?? ''}</p>{log.note && <p className="mt-1 text-sm text-stone-600">{log.note}</p>}</article>)}</Queue>
      </div>
    </main>
  )
}

function Queue({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="rounded-3xl bg-white p-6 shadow-sm"><h2 className="text-2xl font-bold text-emerald-950">{title}</h2><div className="mt-4 space-y-3">{children || <p className="text-sm text-stone-500">Empty.</p>}</div></section>
}
