import { useMutation, useQuery } from 'convex/react'
import { useEffect, useRef, useState } from 'react'
import { api } from '../../../convex/_generated/api'
import { describeConvexError } from '../../lib/convexErrors'
import { SettingsSection } from '../presentation/SettingsPresentation'
import { NotificationPreferencesPresentation } from './NotificationPreferencesPresentation'
import {
  resolveBrowserTimeZone,
  type NotificationPreferenceKey,
  type NotificationPreferencesPatch,
  type NotificationPreferencesView,
} from './notificationPreferences'

/**
 * Connected notification preferences. The stored row is the source of truth and
 * each change is applied optimistically so a failed save can restore the value
 * the member saw before they tapped the control.
 */
export function NotificationPreferencesSection() {
  const stored = useQuery(api.notificationPreferences.mine)
  const update = useMutation(api.notificationPreferences.update)
  const [overrides, setOverrides] = useState<NotificationPreferencesPatch>({})
  const [pending, setPending] = useState<NotificationPreferenceKey | ''>('')
  const [error, setError] = useState('')
  const timeZoneSent = useRef(false)

  useEffect(() => {
    if (!stored || timeZoneSent.current) return
    timeZoneSent.current = true
    const browserTimeZone = resolveBrowserTimeZone()
    if (browserTimeZone === stored.timeZone) return
    void Promise.resolve(update({ timeZone: browserTimeZone })).catch(() => undefined)
  }, [stored, update])

  if (!stored) {
    return (
      <SettingsSection
        headingId="notifications-heading"
        title="Notifications"
        description="Choose which social updates reach you. Changes save right away."
      >
        <p className="settings-note" role="status">Loading notification settings...</p>
      </SettingsSection>
    )
  }

  const preferences: NotificationPreferencesView = { ...stored, ...overrides }

  async function save(key: NotificationPreferenceKey, patch: NotificationPreferencesPatch) {
    if (pending) return
    const previousOverrides = overrides
    setOverrides((current) => ({ ...current, ...patch }))
    setPending(key)
    setError('')
    try {
      await update(patch)
    } catch (cause) {
      setOverrides(previousOverrides)
      setError(cause instanceof Error ? describeConvexError(cause) : 'Your notification settings could not be saved.')
    } finally {
      setPending('')
    }
  }

  return (
    <NotificationPreferencesPresentation
      preferences={preferences}
      pending={pending}
      error={error}
      onChange={(key, patch) => void save(key, patch)}
    />
  )
}
