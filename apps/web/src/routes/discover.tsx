import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'

export const Route = createFileRoute('/discover')({ component: DiscoverPage })

function DiscoverPage() {
  const hosts = (useQuery(api.hosts.listApproved) ?? []) as Array<{ _id: string; displayName: string; city: string; mode: string; rating: number; intro: string; strengths: string[] }>
  return (
    <main className="mx-auto max-w-7xl px-5 py-12">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div><p className="text-sm font-semibold text-emerald-800">Discovery</p><h1 className="text-4xl font-black text-emerald-950">Find a Friend Host</h1><p className="mt-3 max-w-2xl text-stone-600">Demo data appears until real approved hosts are added in Convex.</p></div>
      </div>
      <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {hosts.map((host) => <article key={host._id} className="rounded-3xl border border-emerald-900/10 bg-white p-5 shadow-sm"><div className="flex items-start justify-between gap-4"><div><h2 className="text-xl font-bold text-emerald-950">{host.displayName}</h2><p className="text-sm text-stone-500">{host.city} · {host.mode}</p></div><span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-900">{host.rating.toFixed(1)}</span></div><p className="mt-4 text-sm leading-6 text-stone-600">{host.intro}</p><div className="mt-4 flex flex-wrap gap-2">{host.strengths.map((s: string) => <span key={s} className="rounded-full bg-stone-100 px-3 py-1 text-xs text-stone-700">{s}</span>)}</div></article>)}
      </div>
    </main>
  )
}
