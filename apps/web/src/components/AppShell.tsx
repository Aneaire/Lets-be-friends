import { Link } from '@tanstack/react-router'
import type React from 'react'
import { SignInButton, UserButton, useAuth } from '@clerk/react'
import { BrandLogo } from './BrandLogo'

export function Header() {
  return (
    <header className="sticky top-0 z-20 border-b border-emerald-900/10 bg-[#f8f5ef]/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4">
        <Link to="/" className="flex items-center gap-3 font-semibold tracking-tight text-emerald-950">
          <BrandLogo className="h-11 w-10" />
          <span>Let's Be Friends</span>
        </Link>
        <nav className="hidden items-center gap-6 text-sm font-medium text-stone-700 md:flex">
          <Link to="/discover" className="hover:text-emerald-900">Discover</Link>
          <Link to="/become-host" className="hover:text-emerald-900">Become a host</Link>
          <Link to="/safety" className="hover:text-emerald-900">Safety</Link>
          <AuthOnly><Link to="/app" className="hover:text-emerald-900">App</Link></AuthOnly>
          <AuthOnly><Link to="/admin" className="hover:text-emerald-900">Admin</Link></AuthOnly>
        </nav>
        <div className="flex items-center gap-3">
          <AuthButtons />
        </div>
      </div>
    </header>
  )
}

export function Footer() {
  return (
    <footer className="border-t border-emerald-900/10 px-5 py-8 text-center text-sm text-stone-500">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-center gap-3">
        <BrandLogo className="h-12 w-11" />
        <p>Trust-first friendship experiences. 18+ MVP. Verification before booking.</p>
      </div>
    </footer>
  )
}

function AuthOnly({ children }: { children: React.ReactNode }) {
  const { isSignedIn } = useAuth()
  return isSignedIn ? <>{children}</> : null
}

function AuthButtons() {
  const { isSignedIn } = useAuth()
  if (isSignedIn) return <UserButton />
  return (
    <SignInButton mode="modal">
      <button className="rounded-full bg-emerald-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-800">Sign in</button>
    </SignInButton>
  )
}
