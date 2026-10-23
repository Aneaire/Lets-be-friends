import { useMutation } from 'convex/react'
import { useEffect, useMemo, useState } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import { validateWeeklyAvailability, type WeeklyAvailabilityWindow } from '@lets-be-friends/shared'

import { mobileApi } from '@/backend/client'
import { ActionButton } from '@/design-system/atoms/ActionButton'
import { AppText } from '@/design-system/atoms/Typography'
import { InlineNotice } from '@/design-system/molecules/FeedbackState'
import { useAppTheme } from '@/theme/ThemeProvider'
import { density } from '@/theme/tokens'
import {
  AVAILABILITY_MINUTES_STEP,
  MAX_AVAILABILITY_WINDOWS,
  WEEKDAY_NAMES,
  WEEKDAY_SHORT,
  formatMinutes,
} from '@/data/companionAvailability'

export type AvailabilityDraftWindow = {
  key: string
  weekday: number
  startMinutes: number
  endMinutes: number
}

export function draftFromWindows(windows: readonly WeeklyAvailabilityWindow[]): AvailabilityDraftWindow[] {
  return windows.map((window, index) => ({ ...window, key: `window-${index}-${window.weekday}-${window.startMinutes}` }))
}

export function draftToWindows(draft: readonly AvailabilityDraftWindow[]): WeeklyAvailabilityWindow[] {
  return draft.map(({ weekday, startMinutes, endMinutes }) => ({ weekday, startMinutes, endMinutes }))
}

export function availabilityAuthoritativeSignature(windows: readonly WeeklyAvailabilityWindow[] | undefined) {
  if (windows === undefined) return 'legacy'
  return `configured:${windows
    .map((window) => `${window.weekday}:${window.startMinutes}-${window.endMinutes}`)
    .sort()
    .join('|')}`
}

let draftKeyCounter = 0

export function emptyDraftWindow(): AvailabilityDraftWindow {
  draftKeyCounter += 1
  return { key: `new-${draftKeyCounter}`, weekday: 1, startMinutes: 540, endMinutes: 720 }
}

export function stepWindowMinutes(window: AvailabilityDraftWindow, edge: 'start' | 'end', delta: number): AvailabilityDraftWindow {
  if (edge === 'start') {
    const startMinutes = Math.min(Math.max(0, window.startMinutes + delta), 1440 - AVAILABILITY_MINUTES_STEP)
    return { ...window, startMinutes, endMinutes: Math.max(window.endMinutes, startMinutes + AVAILABILITY_MINUTES_STEP) }
  }
  const endMinutes = Math.max(Math.min(1440, window.endMinutes + delta), AVAILABILITY_MINUTES_STEP)
  return { ...window, endMinutes, startMinutes: Math.min(window.startMinutes, endMinutes - AVAILABILITY_MINUTES_STEP) }
}

export function WeeklyAvailabilityEditor({ initialWindows }: { initialWindows: WeeklyAvailabilityWindow[] | undefined }) {
  const updateAvailability = useMutation(mobileApi.companions.updateAvailability)
  const [savedWindows, setSavedWindows] = useState<WeeklyAvailabilityWindow[] | undefined>(initialWindows)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  return (
    <WeeklyAvailabilityEditorPresentation
      initialWindows={savedWindows}
      busy={false}
      message={message}
      error={error}
      onSave={async (windows) => {
        setError('')
        setMessage('')
        try {
          const result = await updateAvailability({ weeklyAvailability: windows })
          setSavedWindows(result.weeklyAvailability)
          setMessage(
            result.weeklyAvailability.length === 0
              ? 'Availability cleared. New requests stay blocked until you share times again.'
              : 'Weekly availability saved. New requests must fit these Manila times.',
          )
        } catch {
          setError('Weekly availability could not be saved. Review the windows and try again.')
        }
      }}
    />
  )
}

export function WeeklyAvailabilityEditorPresentation({
  initialWindows,
  busy = false,
  message = '',
  error = '',
  onSave,
}: {
  initialWindows: WeeklyAvailabilityWindow[] | undefined
  busy?: boolean
  message?: string
  error?: string
  onSave: (windows: WeeklyAvailabilityWindow[]) => void | Promise<void>
}) {
  const theme = useAppTheme()
  const [draft, setDraft] = useState<AvailabilityDraftWindow[]>(() => draftFromWindows(initialWindows ?? []))
  const [saving, setSaving] = useState(false)
  const incomingSignature = availabilityAuthoritativeSignature(initialWindows)
  useEffect(() => {
    setDraft(draftFromWindows(initialWindows ?? []))
  }, [incomingSignature])
  const validation = validateWeeklyAvailability(draftToWindows(draft))
  const draftSignature = useMemo(() => availabilityAuthoritativeSignature(draftToWindows(draft)), [draft])
  const dirty = draftSignature !== incomingSignature

  async function save() {
    if (saving || busy || !validation.ok) return
    setSaving(true)
    try {
      await onSave(validation.value)
    } finally {
      setSaving(false)
    }
  }

  function addWindow() {
    if (draft.length >= MAX_AVAILABILITY_WINDOWS) return
    setDraft((current) => [...current, emptyDraftWindow()])
  }

  function removeWindow(key: string) {
    setDraft((current) => current.filter((window) => window.key !== key))
  }

  return (
    <View style={[styles.panel, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}>
      <AppText variant="label" color={theme.colors.selfText}>WEEKLY AVAILABILITY</AppText>
      <AppText variant="heading">Manila times members can request</AppText>
      <AppText variant="caption" color={theme.colors.textMuted}>
        Share the weekly times you can take sessions, in Asia/Manila. New requests must fit these windows. Saving an empty list blocks new requests.
      </AppText>
      {error ? <InlineNotice title="Availability not saved" tone="danger">{error}</InlineNotice> : null}
      {message ? <InlineNotice title="Availability updated" tone="success">{message}</InlineNotice> : null}
      {!validation.ok ? <InlineNotice title="Check the windows" tone="warning">{validation.message}</InlineNotice> : null}

      {draft.length === 0 ? (
        <AppText color={theme.colors.textMuted}>No windows shared. Add times below, or save empty to block new requests.</AppText>
      ) : (
        <View style={styles.list}>
          {draft.map((window) => (
            <WindowRow
              key={window.key}
              window={window}
              disabled={busy || saving}
              onChange={(next) => setDraft((current) => current.map((item) => (item.key === window.key ? next : item)))}
              onRemove={() => removeWindow(window.key)}
            />
          ))}
        </View>
      )}

      <View style={styles.actions}>
        <ActionButton
          label="Add time window"
          onPress={addWindow}
          intent="self"
          secondary
          compact
          disabled={busy || saving || draft.length >= MAX_AVAILABILITY_WINDOWS}
        />
        <ActionButton
          label={saving ? 'Saving availability' : 'Save availability'}
          onPress={() => void save()}
          intent="self"
          loading={saving}
          disabled={busy || saving || !validation.ok || !dirty}
        />
      </View>
      <AppText variant="caption" color={theme.colors.textMuted}>{draft.length}/{MAX_AVAILABILITY_WINDOWS} windows · 15-minute steps</AppText>
    </View>
  )
}

function WindowRow({ window, disabled, onChange, onRemove }: {
  window: AvailabilityDraftWindow
  disabled: boolean
  onChange: (next: AvailabilityDraftWindow) => void
  onRemove: () => void
}) {
  const theme = useAppTheme()
  return (
    <View style={[styles.window, { borderColor: theme.colors.border }]}>
      <View style={styles.weekdays}>
        {WEEKDAY_SHORT.map((label, weekday) => {
          const active = window.weekday === weekday
          return (
            <Pressable
              key={label}
              accessibilityRole="radio"
              accessibilityLabel={`${WEEKDAY_NAMES[weekday]}, ${active ? 'selected' : 'not selected'}`}
              accessibilityState={{ checked: active }}
              aria-checked={active}
              disabled={disabled}
              onPress={() => onChange({ ...window, weekday })}
              style={({ pressed }) => [
                styles.weekday,
                { borderColor: active ? theme.colors.self : theme.colors.border, backgroundColor: active ? theme.colors.selfSoft : theme.colors.background },
                pressed && styles.pressed,
              ]}>
              <AppText variant="caption" color={active ? theme.colors.selfText : theme.colors.text}>{label}</AppText>
            </Pressable>
          )
        })}
      </View>
      <View style={styles.edges}>
        <MinuteStepper label="Starts" value={window.startMinutes} disabled={disabled} onStep={(delta) => onChange(stepWindowMinutes(window, 'start', delta))} />
        <MinuteStepper label="Ends" value={window.endMinutes} disabled={disabled} onStep={(delta) => onChange(stepWindowMinutes(window, 'end', delta))} />
        <ActionButton label="Remove" onPress={onRemove} intent="neutral" secondary compact disabled={disabled} />
      </View>
    </View>
  )
}

function MinuteStepper({ label, value, disabled, onStep }: { label: string; value: number; disabled: boolean; onStep: (delta: number) => void }) {
  const theme = useAppTheme()
  const step = AVAILABILITY_MINUTES_STEP
  return (
    <View style={styles.stepper}>
      <AppText variant="caption" color={theme.colors.textMuted}>{label}</AppText>
      <View style={styles.stepperRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${label} 15 minutes earlier, currently ${formatMinutes(value)}`}
          disabled={disabled}
          onPress={() => onStep(-step)}
          hitSlop={6}
          style={({ pressed }) => [styles.stepButton, { borderColor: theme.colors.border }, pressed && styles.pressed]}>
          <AppText variant="bodyStrong">−</AppText>
        </Pressable>
        <AppText variant="bodyStrong" style={styles.stepValue}>{formatMinutes(value)}</AppText>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${label} 15 minutes later, currently ${formatMinutes(value)}`}
          disabled={disabled}
          onPress={() => onStep(step)}
          hitSlop={6}
          style={({ pressed }) => [styles.stepButton, { borderColor: theme.colors.border }, pressed && styles.pressed]}>
          <AppText variant="bodyStrong">+</AppText>
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  panel: { borderWidth: 1, borderRadius: 16, padding: density.cardPadding, gap: density.cardGap },
  list: { gap: density.cardGap },
  window: { borderWidth: 1, borderRadius: 12, padding: density.compactCardPadding, gap: density.cardGap },
  weekdays: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  weekday: { minWidth: 40, minHeight: 40, borderWidth: 1, borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  edges: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', gap: density.cardGap },
  stepper: { gap: 4, flexGrow: 1, minWidth: 150 },
  stepperRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stepButton: { width: 44, height: 44, borderWidth: 1, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  stepValue: { minWidth: 86, textAlign: 'center' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: density.cardGap },
  pressed: { opacity: 0.68 },
})
