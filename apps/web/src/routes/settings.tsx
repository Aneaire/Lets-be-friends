import { Link, createFileRoute } from '@tanstack/react-router'
import { SignInButton, useAuth, useUser } from '@clerk/react'
import { useQuery } from 'convex/react'
import { BadgeDollarSign, Moon, ShieldCheck, Sun, UserRound, UserRoundCog } from 'lucide-react'
import { formatPhp } from '@lets-be-friends/shared'
import { api } from '../../convex/_generated/api'
import { Button } from '../design-system/atoms/Button'
import { useThemeChoice } from '../design-system/atoms/ThemeToggle'
import { SettingsLinkRow, SettingsSection } from '../features/presentation/SettingsPresentation'

export const Route = createFileRoute('/settings')({ component: SettingsPage })

export function SettingsPage() {
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
            <Button intent="self">Sign in</Button>
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
        <SettingsSection
          headingId="appearance-heading"
          title="Appearance"
          description="This preference is saved on this device."
        >
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
        </SettingsSection>

        <SettingsSection
          headingId="account-heading"
          title="Account"
          description="Keep personal details separate from app preferences."
        >
          <SettingsLinkRow
            link={<Link to="/profile" />}
            icon={<UserRound size={19} aria-hidden="true" className="settings-row-icon" />}
            title="Personal profile"
            description={email ? `Name, photo, bio, and sign-in email (${email})` : 'Name, photo, bio, and sign-in details'}
            actionLabel="Manage"
          />
        </SettingsSection>

        <SettingsSection
          headingId="companion-heading"
          title="Companion"
          description={application
            ? application.status === 'approved'
              ? 'Verified profiles are locked. Change your price and profile details here.'
              : 'Manage your Companion profile and track its review.'
            : 'Share your everyday Strengths with members.'}
        >
          {application ? (
            <>
              <SettingsLinkRow
                link={<Link to="/become-companion" search={{ edit: true }} />}
                icon={<BadgeDollarSign size={19} aria-hidden="true" className="settings-row-icon" />}
                title="Hourly rate"
                description={<>Currently {formatPhp(application.hourlyRateCentavos ?? 0)} per hour. Rate changes go live right away.</>}
                actionLabel="Change"
              />
              <SettingsLinkRow
                link={<Link to="/become-companion" search={{ edit: true }} />}
                icon={<UserRoundCog size={19} aria-hidden="true" className="settings-row-icon" />}
                title="Companion profile details"
                description="Activities, session format, intro, and location. Changes the review team checks go back to review."
                actionLabel="Edit"
              />
              <SettingsLinkRow
                link={<Link to="/get-verified" />}
                icon={<ShieldCheck size={19} aria-hidden="true" className="settings-row-icon" />}
                title="Verification status"
                description="Review your identity and Companion approval."
                actionLabel="View"
              />
            </>
          ) : (
            <SettingsLinkRow
              link={<Link to="/companion" />}
              icon={<UserRoundCog size={19} aria-hidden="true" className="settings-row-icon" />}
              title="Become a Companion"
              description="Create a profile to share experiences with members."
              actionLabel="Get started"
            />
          )}
        </SettingsSection>
      </div>
    </main>
  )
}
