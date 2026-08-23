import { Link, createFileRoute } from '@tanstack/react-router'
import { SignInButton, useAuth, useUser } from '@clerk/react'
import { useQuery } from 'convex/react'
import { Moon, Sun, UserRound, UserRoundCog } from 'lucide-react'
import { api } from '../../convex/_generated/api'
import { useThemeChoice } from '../design-system/atoms/ThemeToggle'

export const Route = createFileRoute('/settings')({ component: SettingsPage })

function SettingsPage() {
  const { isSignedIn } = useAuth()
  const { user } = useUser()
  const application = useQuery(api.companions.myApplication)
  const { theme, setTheme } = useThemeChoice()

  if (!isSignedIn) {
    return (
      <main className="marketing-page">
        <h1 className="text-h1 mt-2">Sign in to manage your settings.</h1>
        <div className="mt-6">
          <SignInButton mode="modal">
            <button className="btn btn-self">Sign in</button>
          </SignInButton>
        </div>
      </main>
    )
  }

  const email = user?.primaryEmailAddress?.emailAddress

  return (
    <main className="settings-page">
      <header className="settings-page-header">
        <p className="text-meta">Your account</p>
        <h1 className="text-h1">Settings</h1>
        <p className="text-body muted">Choose how the app looks and manage your account.</p>
      </header>

      <div className="settings-stack">
        <section className="settings-section" aria-labelledby="appearance-heading">
          <div className="settings-section-heading">
            <div>
              <h2 id="appearance-heading" className="text-h2">Appearance</h2>
              <p className="text-meta mt-1">This preference is saved on this device.</p>
            </div>
          </div>
          <div className="settings-row settings-row-choice">
            <div className="settings-row-copy">
              <strong>Color theme</strong>
              <span>Use the version that is most comfortable to read.</span>
            </div>
            <div className="settings-choice-group" aria-label="Color theme">
              <button
                type="button"
                className="settings-choice"
                aria-pressed={theme === 'light'}
                onClick={() => setTheme('light')}
              >
                <Sun size={17} aria-hidden="true" />
                Light
              </button>
              <button
                type="button"
                className="settings-choice"
                aria-pressed={theme === 'dark'}
                onClick={() => setTheme('dark')}
              >
                <Moon size={17} aria-hidden="true" />
                Dark
              </button>
            </div>
          </div>
        </section>

        <section className="settings-section" aria-labelledby="account-heading">
          <div className="settings-section-heading">
            <div>
              <h2 id="account-heading" className="text-h2">Account</h2>
              <p className="text-meta mt-1">Keep personal details separate from app preferences.</p>
            </div>
          </div>
          <Link to="/profile" className="settings-link-row">
            <UserRound size={19} aria-hidden="true" className="settings-row-icon" />
            <span className="settings-row-copy">
              <strong>Personal profile</strong>
              <span>{email ? `Name, photo, bio, and sign-in email (${email})` : 'Name, photo, bio, and sign-in details'}</span>
            </span>
            <span className="settings-link-action">Manage</span>
          </Link>
          <Link to={application ? '/become-companion' : '/companion'} className="settings-link-row">
            <UserRoundCog size={19} aria-hidden="true" className="settings-row-icon" />
            <span className="settings-row-copy">
              <strong>Companion profile</strong>
              <span>{application ? 'Strengths, availability, boundaries, and rate' : 'Create a profile to share experiences with members'}</span>
            </span>
            <span className="settings-link-action">{application ? 'Edit' : 'Get started'}</span>
          </Link>
        </section>
      </div>
    </main>
  )
}
