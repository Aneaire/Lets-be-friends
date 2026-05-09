import { createFileRoute } from '@tanstack/react-router'
import { SignInButton, useAuth, useUser } from '@clerk/react'
import { useMutation, useQuery } from 'convex/react'
import { useState } from 'react'
import { activityCategories, friendStrengths } from '@lets-be-friends/shared'
import { api } from '../../convex/_generated/api'

export const Route = createFileRoute('/become-host')({ component: BecomeHostPage })

function BecomeHostPage() {
  return <main className="mx-auto max-w-4xl px-5 py-12"><h1 className="text-4xl font-black text-emerald-950">Become a Friend Host</h1><p className="mt-4 text-stone-600">Create a profile around strengths, boundaries, online/in-person availability, and safe activity categories. Persona verification and admin approval happen before public discovery.</p><div className="mt-8 rounded-3xl bg-white p-6 shadow-sm"><HostAuthPanel /></div></main>
}

function HostAuthPanel() {
  const { isSignedIn } = useAuth()
  const { user } = useUser()
  const ensureUser = useMutation(api.users.ensureViewer)
  const application = useQuery(api.hosts.myApplication)
  const submit = useMutation(api.hosts.submitApplication)
  const [selectedStrengths, setSelectedStrengths] = useState<string[]>(['Good listener'])
  const [selectedCategories, setSelectedCategories] = useState<string[]>(['Online conversation'])
  const [saved, setSaved] = useState(false)

  if (!isSignedIn) return <><p className="mb-4">Sign in first to start a host application.</p><SignInButton mode="modal"><button className="rounded-full bg-emerald-900 px-5 py-3 font-semibold text-white">Sign in</button></SignInButton></>

  return (
    <form className="space-y-5" onSubmit={async (event) => {
      event.preventDefault()
      const form = new FormData(event.currentTarget)
      await ensureUser({ displayName: user?.fullName ?? user?.username ?? 'New friend' })
      await submit({
        displayName: String(form.get('displayName') || user?.fullName || 'Friend Host'),
        intro: String(form.get('intro') || ''),
        city: String(form.get('city') || ''),
        approximateArea: String(form.get('approximateArea') || '') || undefined,
        strengths: selectedStrengths,
        categories: selectedCategories,
        boundaries: String(form.get('boundaries') || '').split('\n').map((item) => item.trim()).filter(Boolean),
        mode: form.get('mode') as 'online' | 'in_person' | 'both',
        applicationNote: String(form.get('applicationNote') || '') || undefined,
      })
      setSaved(true)
    }}>
      {application && <div className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-900">Current application status: <strong>{application.status}</strong>. Submitting again updates the pending review packet.</div>}
      {saved && <div className="rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-900">Application saved. Persona is represented by a dummy inquiry placeholder until credentials are added.</div>}
      <Input name="displayName" label="Public host name" defaultValue={application?.displayName ?? user?.fullName ?? ''} />
      <label className="block"><span className="font-semibold text-emerald-950">Intro</span><textarea name="intro" required minLength={40} defaultValue={application?.intro} className="mt-2 min-h-28 w-full rounded-2xl border border-stone-200 p-3" placeholder="Describe the safe, friendly experiences you offer." /></label>
      <div className="grid gap-4 md:grid-cols-2"><Input name="city" label="City / online region" defaultValue={application?.city ?? ''} /><Input name="approximateArea" label="Approximate area (optional)" defaultValue={application?.approximateArea ?? ''} /></div>
      <label className="block"><span className="font-semibold text-emerald-950">Mode</span><select name="mode" defaultValue={application?.mode ?? 'both'} className="mt-2 w-full rounded-2xl border border-stone-200 p-3"><option value="both">Online and in-person</option><option value="online">Online only</option><option value="in_person">In-person only</option></select></label>
      <CheckboxGroup title="Strengths" values={friendStrengths} selected={selectedStrengths} setSelected={setSelectedStrengths} />
      <CheckboxGroup title="Safe categories" values={activityCategories} selected={selectedCategories} setSelected={setSelectedCategories} />
      <label className="block"><span className="font-semibold text-emerald-950">Boundaries</span><textarea name="boundaries" defaultValue={application?.boundaries?.join('\n') ?? 'Public places only\nNo dating or romantic expectations'} className="mt-2 min-h-24 w-full rounded-2xl border border-stone-200 p-3" /></label>
      <label className="block"><span className="font-semibold text-emerald-950">Reviewer note</span><textarea name="applicationNote" defaultValue={application?.applicationNote} className="mt-2 min-h-20 w-full rounded-2xl border border-stone-200 p-3" placeholder="Anything trust & safety should know." /></label>
      <button className="rounded-full bg-emerald-900 px-5 py-3 font-semibold text-white">Submit for review</button>
    </form>
  )
}

function Input({ name, label, defaultValue }: { name: string; label: string; defaultValue?: string }) {
  return <label className="block"><span className="font-semibold text-emerald-950">{label}</span><input name={name} required defaultValue={defaultValue} className="mt-2 w-full rounded-2xl border border-stone-200 p-3" /></label>
}

function CheckboxGroup({ title, values, selected, setSelected }: { title: string; values: readonly string[]; selected: string[]; setSelected: (next: string[]) => void }) {
  return <section><h2 className="font-semibold text-emerald-950">{title}</h2><div className="mt-2 flex flex-wrap gap-2">{values.map((value) => <button type="button" key={value} onClick={() => setSelected(selected.includes(value) ? selected.filter((item) => item !== value) : [...selected, value])} className={`rounded-full px-3 py-1 text-sm ${selected.includes(value) ? 'bg-emerald-900 text-white' : 'bg-stone-100 text-stone-700'}`}>{value}</button>)}</div></section>
}
