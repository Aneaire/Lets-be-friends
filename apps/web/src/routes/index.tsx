import { Link, createFileRoute } from '@tanstack/react-router'
import { SignInButton, useAuth } from '@clerk/react'
import { friendStrengths, activityCategories } from '@lets-be-friends/shared'
import { BrandLogo } from '../components/BrandLogo'

export const Route = createFileRoute('/')({ component: HomePage })

function HomePage() {
  return (
    <main>
      <section className="mx-auto grid max-w-7xl gap-10 px-5 py-16 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:py-24">
        <div>
          <div className="mb-6 flex items-center gap-4">
            <BrandLogo className="h-20 w-[72px]" variant="lockup" />
            <p className="inline-flex rounded-full bg-emerald-100 px-4 py-2 text-sm font-semibold text-emerald-900">18+ trust-first social booking MVP</p>
          </div>
          <h1 className="max-w-3xl text-5xl font-black tracking-tight text-emerald-950 md:text-7xl">Book time with approved Friend Hosts.</h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-stone-650">Find good listeners, local tour buddies, coffee companions, study partners, gaming teammates, and online friends for safe shared experiences.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/discover" className="rounded-full bg-emerald-900 px-6 py-3 font-semibold text-white shadow-lg shadow-emerald-900/20 hover:bg-emerald-800">Explore hosts</Link>
            <HomeAuthAction />
          </div>
        </div>
        <div className="rounded-[2rem] border border-emerald-900/10 bg-white p-4 shadow-2xl shadow-emerald-900/10">
          <div className="rounded-[1.5rem] bg-gradient-to-br from-emerald-900 to-teal-700 p-6 text-white">
            <p className="text-sm uppercase tracking-[0.25em] text-emerald-100">Featured strengths</p>
            <div className="mt-6 grid grid-cols-2 gap-3">
              {friendStrengths.slice(0, 8).map((strength) => <span key={strength} className="rounded-2xl bg-white/12 px-4 py-3 text-sm font-medium backdrop-blur">{strength}</span>)}
            </div>
          </div>
        </div>
      </section>
      <section className="bg-white/70 px-5 py-14">
        <div className="mx-auto max-w-7xl">
          <h2 className="text-3xl font-bold text-emerald-950">Safe MVP categories</h2>
          <div className="mt-6 flex flex-wrap gap-3">{activityCategories.map((category) => <span key={category} className="rounded-full border border-stone-200 bg-white px-4 py-2 text-sm text-stone-700">{category}</span>)}</div>
        </div>
      </section>
    </main>
  )
}

function HomeAuthAction() {
  const { isSignedIn } = useAuth()
  if (isSignedIn) return <Link to="/app" className="rounded-full border border-emerald-900/20 bg-white px-6 py-3 font-semibold text-emerald-950">Open app</Link>
  return <SignInButton mode="modal"><button className="rounded-full border border-emerald-900/20 bg-white px-6 py-3 font-semibold text-emerald-950 hover:border-emerald-900/40">Create account</button></SignInButton>
}
