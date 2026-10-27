import { useMutation, useQuery } from 'convex/react'
import { useEffect, useState } from 'react'

import { mobileApi } from '@/backend/client'
import { showAppToast } from '@/design-system/molecules/AppToast'
import {
  applyNotificationPreferencePatch,
  notificationTimePatch,
  notificationTimeZonePatch,
  notificationTogglePatch,
  NOTIFICATION_SAVE_SUCCESS,
  saveNotificationPreference,
  type NotificationPreferencePatch,
  type NotificationPreferenceValues,
  type NotificationTimeField,
  type NotificationToggleField,
} from '@/notifications/notificationPreferences'
import { resolveDeviceTimeZone } from '@/notifications/preferenceTime'

import { NotificationPreferencesPresentation } from './NotificationPreferencesPresentation'

type SavingField = NotificationToggleField | NotificationTimeField | null

/**
 * Owns the notification preference query and writes. Values stay optimistic
 * while a patch is in flight and fall back to the stored row when it fails.
 */
export function NotificationPreferences() {
  const stored = useQuery(mobileApi.notificationPreferences.mine, {}) as
    | NotificationPreferenceValues
    | undefined
  const update = useMutation(mobileApi.notificationPreferences.update)
  const [overrides, setOverrides] = useState<NotificationPreferencePatch>({})
  const [savingField, setSavingField] = useState<SavingField>(null)
  const [error, setError] = useState('')

  const values = stored ? applyNotificationPreferencePatch(stored, overrides) : undefined

  // Drop overrides once the stored row confirms them so another session's
  // change is never hidden by a stale local copy.
  useEffect(() => {
    if (!stored) return
    setOverrides((current) => {
      const remaining: NotificationPreferencePatch = {}
      let removed = false
      for (const [key, value] of Object.entries(current)) {
        if (stored[key as keyof NotificationPreferenceValues] === value) removed = true
        else remaining[key as keyof NotificationPreferencePatch] = value as never
      }
      return removed ? remaining : current
    })
  }, [stored])

  // The quiet hours window is judged in the member's local zone, so record the
  // device zone once the first load succeeds and it differs from the stored one.
  useEffect(() => {
    if (!stored) return
    const patch = notificationTimeZonePatch(stored, resolveDeviceTimeZone())
    if (!patch) return
    void update(patch).catch(() => undefined)
  }, [stored, update])

  async function save(field: NotificationToggleField | NotificationTimeField, patch: NotificationPreferencePatch) {
    if (!values || savingField) return
    const key = Object.keys(patch)[0] as keyof NotificationPreferencePatch
    const previousOverride = overrides[key]
    setSavingField(field)
    setError('')
    setOverrides((current) => ({ ...current, ...patch }))
    const result = await saveNotificationPreference({ values, patch, update })
    if (result.status === 'saved') {
      showAppToast(NOTIFICATION_SAVE_SUCCESS, 'success')
    } else {
      setOverrides((current) => {
        const next: NotificationPreferencePatch = { ...current }
        if (previousOverride === undefined) delete next[key]
        else next[key] = previousOverride as never
        return next
      })
      setError(result.message)
    }
    setSavingField(null)
  }

  return (
    <NotificationPreferencesPresentation
      values={values}
      savingField={savingField}
      error={error}
      onToggle={(field) => {
        if (!values) return
        void save(field, notificationTogglePatch(values, field))
      }}
      onSelectTime={(field, minute) => {
        void save(field, notificationTimePatch(field, minute))
      }}
    />
  )
}
