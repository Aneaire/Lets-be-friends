import { Link, createFileRoute } from '@tanstack/react-router'
import { SignInButton, useAuth, useUser } from '@clerk/react'
import { useMutation, useQuery } from 'convex/react'
import { MapPin, Moon, Sun, UserRound, UserRoundCog } from 'lucide-react'
import { useState } from 'react'
import { api } from '../../convex/_generated/api'
import { useThemeChoice } from '../components/ThemeToggle'

export const Route = createFileRoute('/settings')({ component: SettingsPage })

function SettingsPage() {
  const { isSignedIn } = useAuth()
  const { user } = useUser()
  const application = useQuery(api.hosts.myApplication)
  const setNearbyVisibility = useMutation(api.hosts.setNearbyDiscoveryVisibility)
  const { theme, setTheme } = useThemeChoice()
  const [nearbySaving, setNearbySaving] = useState(false)
  const [nearbyError, setNearbyError] = useState('')

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

  const hasApproximateLocation = application
    && typeof application.approximateLatitude === 'number'
    && typeof application.approximateLongitude === 'number'
  const nearbyEnabled = application?.nearbyDiscoveryEnabled === true
  const email = user?.primaryEmailAddress?.emailAddress

  return (
    <main className="settings-page">
      <header className="settings-page-header">
        <p className="text-meta">Your account</p>
        <h1 className="text-h1">Settings</h1>
        <p className="text-body muted">Choose how the app looks and how members can find you.</p>
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

        <section className="settings-section" aria-labelledby="discovery-heading">
          <div className="settings-section-heading">
            <div>
              <h2 id="discovery-heading" className="text-h2">Discovery</h2>
              <p className="text-meta mt-1">Control how your Friend Host profile appears to nearby members.</p>
            </div>
          </div>
          {application === undefined ? (
            <div className="settings-row"><span className="text-meta">Loading discovery settings...</span></div>
          ) : application ? (
            <div className="settings-row settings-row-control">
              <MapPin size={19} aria-hidden="true" className="settings-row-icon" />
              <div className="settings-row-copy">
                <strong>Appear in nearby search</strong>
                <span>
                  {!hasApproximateLocation
                    ? 'Add an approximate location before turning this on.'
                    : application.status !== 'approved' && nearbyEnabled
                      ? 'This will turn on after your Friend Host profile is approved.'
                      : nearbyEnabled
                        ? 'Nearby members can find your profile using an approximate area.'
                        : 'Your profile can still appear in ordinary discovery.'}
                </span>
                {nearbyError && <span className="settings-error" role="alert">{nearbyError}</span>}
                {!hasApproximateLocation && <Link to="/become-host" className="settings-inline-link">Add an approximate location</Link>}
              </div>
              <button
                type="button"
                role="switch"
                className="account-menu-switch settings-switch"
                aria-label="Appear in nearby search"
                aria-checked={nearbyEnabled}
                disabled={nearbySaving || !hasApproximateLocation}
                data-checked={nearbyEnabled}
                onClick={async () => {
                  if (nearbySaving) return
                  setNearbySaving(true)
                  setNearbyError('')
                  try {
                    await setNearbyVisibility({ enabled: !nearbyEnabled })
                  } catch (error) {
                    setNearbyError(error instanceof Error ? error.message : 'Nearby search could not be updated.')
                  } finally {
                    setNearbySaving(false)
                  }
                }}
              >
                <span aria-hidden="true" />
                <strong>{nearbySaving ? 'Saving' : nearbyEnabled ? 'On' : 'Off'}</strong>
              </button>
            </div>
          ) : (
            <div className="settings-row settings-row-control">
              <MapPin size={19} aria-hidden="true" className="settings-row-icon" />
              <div className="settings-row-copy">
                <strong>Nearby search</strong>
                <span>This setting becomes available when you create a Friend Host profile.</span>
              </div>
              <Link to="/become-host" className="btn btn-neutral btn-sm">Create host profile</Link>
            </div>
          )}
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
          <Link to={application ? '/become-host' : '/host'} className="settings-link-row">
            <UserRoundCog size={19} aria-hidden="true" className="settings-row-icon" />
            <span className="settings-row-copy">
              <strong>Friend Host profile</strong>
              <span>{application ? 'Strengths, availability, boundaries, location, and rate' : 'Create a profile to share experiences with members'}</span>
            </span>
            <span className="settings-link-action">{application ? 'Edit' : 'Get started'}</span>
          </Link>
        </section>
      </div>
    </main>
  )
}
