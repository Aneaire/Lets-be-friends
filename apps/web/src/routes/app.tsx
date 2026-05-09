import { createFileRoute } from '@tanstack/react-router'
import { SignInButton, useAuth, useUser } from '@clerk/react'
import { useMutation, useQuery } from 'convex/react'
import { useState } from 'react'
import { activityCategories } from '@lets-be-friends/shared'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'

export const Route = createFileRoute('/app')({ component: AppPage })

function AppPage() {
  const { isSignedIn } = useAuth()
  const { user } = useUser()
  const viewer = useQuery(api.users.viewer)
  const bookings = useQuery(api.bookings.mine)
  const ensureUser = useMutation(api.users.ensureViewer)
  const createDraft = useMutation(api.bookings.createDraft)
  const sendMessage = useMutation(api.bookings.sendMessage)
  const submitReview = useMutation(api.reviews.submit)
  const report = useMutation(api.reports.create)
  const [notice, setNotice] = useState('')

  if (!isSignedIn) {
    return (
      <main className="mx-auto max-w-5xl px-5 py-12">
        <h1 className="text-3xl font-black text-emerald-950">Sign in to continue</h1>
        <div className="mt-6"><SignInButton mode="modal"><button className="rounded-full bg-emerald-900 px-5 py-3 font-semibold text-white">Sign in</button></SignInButton></div>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-6xl px-5 py-12">
      <h1 className="text-4xl font-black text-emerald-950">Member dashboard</h1>
      <p className="mt-3 text-stone-600">Clerk is connected as {user?.primaryEmailAddress?.emailAddress ?? user?.id}. Convex profile: {viewer ? `${viewer.displayName} · ${viewer.verificationStatus}` : 'not synced yet'}.</p>
      <button onClick={() => ensureUser({ displayName: user?.fullName ?? user?.username ?? 'New friend' })} className="mt-6 rounded-full bg-emerald-900 px-5 py-3 font-semibold text-white">Sync my profile to Convex</button>
      {notice && <div className="mt-4 rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-900">{notice}</div>}

      <section className="mt-8 grid gap-6 lg:grid-cols-[1fr_1.2fr]">
        <form className="rounded-3xl bg-white p-6 shadow-sm" onSubmit={async (event) => {
          event.preventDefault()
          const form = new FormData(event.currentTarget)
          await ensureUser({ displayName: user?.fullName ?? user?.username ?? 'New friend' })
          const bookingId = await createDraft({
            hostProfileId: String(form.get('hostProfileId')) as Id<'hostProfiles'>,
            category: String(form.get('category')),
            mode: form.get('mode') as 'online' | 'in_person',
            requestedAt: new Date(String(form.get('requestedAt'))).getTime(),
            durationMinutes: Number(form.get('durationMinutes')),
            notes: String(form.get('notes') || '') || undefined,
          })
          setNotice(`Booking draft ${bookingId} saved. If verification is needed, it is held as verification_required with a dummy Persona inquiry.`)
        }}>
          <h2 className="text-2xl font-bold text-emerald-950">Start a booking request</h2>
          <p className="mt-2 text-sm text-stone-600">Use an approved Convex host profile id. Discovery keeps demo cards until real approved hosts exist.</p>
          <Input name="hostProfileId" label="Approved host profile ID" />
          <label className="mt-4 block"><span className="font-semibold text-emerald-950">Category</span><select name="category" className="mt-2 w-full rounded-2xl border border-stone-200 p-3">{activityCategories.map((category) => <option key={category}>{category}</option>)}</select></label>
          <div className="mt-4 grid gap-4 md:grid-cols-2"><label className="block"><span className="font-semibold text-emerald-950">Mode</span><select name="mode" className="mt-2 w-full rounded-2xl border border-stone-200 p-3"><option value="online">Online</option><option value="in_person">In person</option></select></label><Input name="durationMinutes" label="Duration minutes" defaultValue="60" /></div>
          <Input name="requestedAt" label="Requested date/time" defaultValue={new Date(Date.now() + 86400000).toISOString().slice(0, 16)} />
          <label className="mt-4 block"><span className="font-semibold text-emerald-950">Notes</span><textarea name="notes" className="mt-2 min-h-24 w-full rounded-2xl border border-stone-200 p-3" /></label>
          <button className="mt-5 rounded-full bg-emerald-900 px-5 py-3 font-semibold text-white">Save booking</button>
        </form>

        <section className="rounded-3xl bg-white p-6 shadow-sm">
          <h2 className="text-2xl font-bold text-emerald-950">My bookings</h2>
          <div className="mt-4 space-y-4">{(bookings ?? []).map((booking) => <article key={booking._id} className="rounded-2xl border border-stone-200 p-4"><div className="flex flex-wrap items-center justify-between gap-2"><strong>{booking.category}</strong><span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-bold text-stone-700">{booking.status}</span></div><p className="mt-2 text-xs text-stone-500">{booking._id} · host {booking.hostProfileId}</p>{booking.status === 'verification_required' && <p className="mt-2 text-sm text-amber-700">Verification required: dummy Persona inquiry created and pending admin review.</p>}{['request_sent', 'accepted', 'completed', 'review_window'].includes(booking.status) && <form className="mt-3 flex gap-2" onSubmit={async (event) => { event.preventDefault(); const form = new FormData(event.currentTarget); await sendMessage({ bookingId: booking._id, body: String(form.get('body')) }); setNotice('Message sent.') }}><input name="body" className="min-w-0 flex-1 rounded-full border border-stone-200 px-3 py-2" placeholder="Send a chat message" /><button className="rounded-full bg-emerald-900 px-4 py-2 text-sm font-semibold text-white">Send</button></form>}{['completed', 'review_window'].includes(booking.status) && <button onClick={async () => { await submitReview({ bookingId: booking._id, rating: 5, body: 'Safe, friendly experience.' }); setNotice('Review submitted.') }} className="mt-3 rounded-full bg-stone-900 px-4 py-2 text-sm font-semibold text-white">Leave 5★ review</button>}<button onClick={async () => { await report({ targetType: 'booking', targetId: booking._id, reason: 'Needs admin review' }); setNotice('Report created for admin queue.') }} className="mt-3 ml-2 rounded-full bg-red-50 px-4 py-2 text-sm font-semibold text-red-700">Report</button></article>)}{bookings?.length === 0 && <p className="text-sm text-stone-500">No bookings yet.</p>}</div>
        </section>
      </section>
    </main>
  )
}

function Input({ name, label, defaultValue }: { name: string; label: string; defaultValue?: string }) {
  return <label className="mt-4 block"><span className="font-semibold text-emerald-950">{label}</span><input name={name} required defaultValue={defaultValue} className="mt-2 w-full rounded-2xl border border-stone-200 p-3" /></label>
}
