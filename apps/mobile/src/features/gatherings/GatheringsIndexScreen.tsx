import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker'
import { useMutation, useQuery } from 'convex/react'
import { router } from 'expo-router'
import { useMemo, useState } from 'react'
import { Platform, Pressable, StyleSheet, View } from 'react-native'

import { mobileApi, type CircleId, type CompanionProfileId, type GatheringId } from '@/backend/client'
import { ActionButton } from '@/design-system/atoms/ActionButton'
import { TextField } from '@/design-system/atoms/Field'
import { AppText } from '@/design-system/atoms/Typography'
import { AppHeader } from '@/design-system/molecules/AppHeader'
import { InlineNotice } from '@/design-system/molecules/FeedbackState'
import { SegmentedControl } from '@/design-system/molecules/SegmentedControl'
import { StateView } from '@/design-system/molecules/StateView'
import { Screen } from '@/design-system/templates/Screen'
import { useAppTheme } from '@/theme/ThemeProvider'
import { density } from '@/theme/tokens'

import { formatGatheringDuration, formatGatheringWhen, gatheringIndexPresentation, gatheringModeLabel, gatheringSeatLabel, gatheringStateLabel, type GatheringSummaryLike } from './gatheringPresentation'

const DURATIONS = [30, 60, 90, 120] as const

function defaultSchedule() {
  const manila = new Date(Date.now() + 8 * 60 * 60 * 1_000 + 24 * 60 * 60 * 1_000)
  return {
    date: `${manila.getUTCFullYear()}-${String(manila.getUTCMonth() + 1).padStart(2, '0')}-${String(manila.getUTCDate()).padStart(2, '0')}`,
    time: '18:00',
  }
}

export function GatheringsIndexScreen() {
  const theme = useAppTheme()
  const mine = useQuery(mobileApi.gatherings.mine)
  const companions = useQuery(mobileApi.companions.listApproved, {})
  const circles = useQuery(mobileApi.circles.mine)
  const create = useMutation(mobileApi.gatherings.create)
  const postInvite = useMutation(mobileApi.gatherings.postInvite)
  const [showCreate, setShowCreate] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const bookable = useMemo(
    () => (Array.isArray(companions) ? companions : []).filter((companion) => companion.bookable && companion.viewerCanBook),
    [companions],
  )
  const myCircles = useMemo(
    () => (Array.isArray(circles) ? circles : []).filter((circle) => circle.membershipState === 'active'),
    [circles],
  )

  const [companionProfileId, setCompanionProfileId] = useState('')
  const [category, setCategory] = useState('')
  const [mode, setMode] = useState<'online' | 'in_person'>('online')
  const [schedule, setSchedule] = useState(defaultSchedule)
  const [picker, setPicker] = useState<'date' | 'time' | null>(null)
  const [durationMinutes, setDurationMinutes] = useState<number>(60)
  const [capacity, setCapacity] = useState('4')
  const [guestListVisibility, setGuestListVisibility] = useState<'confirmed_only' | 'public'>('confirmed_only')
  const [inviteBody, setInviteBody] = useState('')
  const [audience, setAudience] = useState('profile')

  const selected = bookable.find((companion) => companion._id === companionProfileId) ?? null
  const availableModes = selected && selected.mode !== 'both' ? [selected.mode] as const : (['online', 'in_person'] as const)
  const pickerValue = useMemo(() => new Date(`${schedule.date}T${schedule.time}:00`), [schedule])

  function selectCompanion(nextId: string) {
    setCompanionProfileId(nextId)
    const next = bookable.find((companion) => companion._id === nextId) ?? null
    setCategory(next?.categories[0] ?? '')
    setMode(next && next.mode !== 'both' ? next.mode : 'online')
  }

  function updateSchedule(event: DateTimePickerEvent, selectedDate?: Date) {
    if (Platform.OS === 'android') setPicker(null)
    if (event.type === 'dismissed' || !selectedDate) return
    if (picker === 'date') setSchedule((current) => ({ ...current, date: `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}` }))
    if (picker === 'time') setSchedule((current) => ({ ...current, time: `${String(selectedDate.getHours()).padStart(2, '0')}:${String(selectedDate.getMinutes()).padStart(2, '0')}` }))
  }

  async function submit() {
    if (busy || !selected || !category) return
    const capacityValue = Number(capacity)
    if (!Number.isSafeInteger(capacityValue) || capacityValue < 2 || capacityValue > 50) {
      setError('Capacity must be between 2 and 50 guests.')
      return
    }
    const startsAt = new Date(`${schedule.date}T${schedule.time}:00`).getTime()
    if (!Number.isFinite(startsAt) || startsAt <= Date.now()) {
      setError('Choose a start time in the future.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const created = await create({
        companionProfileId: selected._id as CompanionProfileId,
        category,
        mode,
        startsAt,
        durationMinutes,
        capacity: capacityValue,
        guestListVisibility,
      })
      if (inviteBody.trim()) {
        await postInvite({
          gatheringId: created.gatheringId as GatheringId,
          body: inviteBody.trim(),
          circleId: audience !== 'none' && audience !== 'profile' ? audience as CircleId : undefined,
        })
      }
      router.replace({ pathname: '/gatherings/[id]', params: { id: created.gatheringId } } as never)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The Gathering could not be created.')
    } finally {
      setBusy(false)
    }
  }

  const index = gatheringIndexPresentation(mine)

  return (
    <Screen contentStyle={styles.screen}>
      <AppHeader title="Gatherings" subtitle="Host-funded group experiences" back />
      {index.loading ? <StateView embedded loading title="Loading Gatherings" /> : null}
      {!index.loading ? (
        <ActionButton
          label={showCreate ? 'Close Gathering form' : 'Create Gathering'}
          intent="self"
          secondary={!showCreate}
          onPress={() => { setError(''); setShowCreate((value) => !value) }}
        />
      ) : null}

      {showCreate ? (
        <View style={[styles.panel, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]} accessibilityLabel="Create a Gathering">
          <AppText variant="heading">Create a Gathering</AppText>
          <AppText color={theme.colors.textMuted}>You fund the session. Guests join at no charge.</AppText>
          {error ? <InlineNotice title="Gathering not created" tone="danger">{error}</InlineNotice> : null}

          <AppText variant="label">COMPANION</AppText>
          {bookable.length === 0 ? <AppText color={theme.colors.textMuted}>No approved Companions are available to book right now.</AppText> : bookable.slice(0, 8).map((companion) => (
            <Pressable
              key={companion._id}
              accessibilityRole="button"
              accessibilityLabel={`Choose ${companion.displayName}`}
              accessibilityState={{ selected: companionProfileId === companion._id }}
              onPress={() => selectCompanion(companion._id)}
              style={({ pressed }) => [styles.optionRow, { borderColor: companionProfileId === companion._id ? theme.colors.selfText : theme.colors.border }, pressed && styles.pressed]}
            >
              <View style={styles.optionCopy}>
                <AppText variant="bodyStrong" numberOfLines={1}>{companion.displayName}</AppText>
                <AppText variant="caption" color={theme.colors.textMuted} numberOfLines={1}>{companion.city}</AppText>
              </View>
              {companionProfileId === companion._id ? <AppText variant="caption" color={theme.colors.selfText}>Selected</AppText> : null}
            </Pressable>
          ))}

          {selected ? (
            <>
              <AppText variant="label">EXPERIENCE</AppText>
              <View style={styles.wrapRow}>
                {selected.categories.map((option) => (
                  <ActionButton key={option} compact label={option} intent="social" secondary={category !== option} onPress={() => setCategory(option)} />
                ))}
              </View>
              <SegmentedControl
                label="Session format"
                tone="social"
                value={mode}
                options={availableModes.map((option) => ({ value: option, label: gatheringModeLabel(option) }))}
                onChange={(value) => setMode(value)}
              />
            </>
          ) : null}

          <AppText variant="label">SCHEDULE</AppText>
          <View style={styles.row}>
            <ActionButton compact secondary label={`Date · ${new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric' }).format(pickerValue)}`} onPress={() => setPicker('date')} />
            <ActionButton compact secondary label={`Time · ${new Intl.DateTimeFormat('en-PH', { hour: 'numeric', minute: '2-digit' }).format(pickerValue)}`} onPress={() => setPicker('time')} />
          </View>
          {picker ? <DateTimePicker value={pickerValue} mode={picker} display="default" minimumDate={picker === 'date' ? new Date() : undefined} minuteInterval={15} onChange={updateSchedule} /> : null}
          <SegmentedControl
            label="Duration"
            tone="social"
            value={String(durationMinutes)}
            options={DURATIONS.map((minutes) => ({ value: String(minutes), label: formatGatheringDuration(minutes) }))}
            onChange={(value) => setDurationMinutes(Number(value))}
          />
          <AppText variant="label">CAPACITY</AppText>
          <TextField value={capacity} keyboardType="number-pad" maxLength={2} onChangeText={setCapacity} accessibilityLabel="Capacity" />
          <SegmentedControl
            label="Guest list"
            value={guestListVisibility}
            options={[
              { value: 'confirmed_only', label: 'Confirmed guests' },
              { value: 'public', label: 'Anyone who can see the Invite' },
            ]}
            onChange={(value) => setGuestListVisibility(value)}
          />
          <AppText variant="label">INVITE MESSAGE (OPTIONAL)</AppText>
          <TextField multiline value={inviteBody} maxLength={1000} placeholder="Tell people what you are planning." onChangeText={setInviteBody} accessibilityLabel="Invite message" />
          {inviteBody.trim() ? (
            <>
              <AppText variant="label">INVITE AUDIENCE</AppText>
              <View style={styles.wrapRow}>
                <ActionButton compact label="My profile" intent="social" secondary={audience !== 'profile'} onPress={() => setAudience('profile')} />
                {myCircles.map((circle) => (
                  <ActionButton key={circle._id} compact label={circle.name} intent="social" secondary={audience !== circle._id} onPress={() => setAudience(circle._id)} />
                ))}
                <ActionButton compact label="Do not post" intent="neutral" secondary={audience !== 'none'} onPress={() => setAudience('none')} />
              </View>
            </>
          ) : null}

          <ActionButton label={busy ? 'Creating Gathering' : 'Create Gathering'} intent="self" loading={busy} disabled={!selected || !category} onPress={() => void submit()} />
        </View>
      ) : null}

      {!index.loading ? (
        <>
          <GatheringSection title="Hosting" empty="You are not hosting a Gathering yet." rows={index.hosting} />
          <GatheringSection title="Joined" empty="Invites shared in Circles and on profiles appear here once you request a seat." rows={index.joined} />
        </>
      ) : null}
    </Screen>
  )
}

function GatheringSection({ title, empty, rows }: {
  title: string
  empty: string
  rows: GatheringSummaryLike[]
}) {
  const theme = useAppTheme()
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeading}>
        <AppText variant="heading">{title}</AppText>
        <AppText variant="caption" color={theme.colors.textMuted}>{rows.length}</AppText>
      </View>
      {rows.length === 0 ? <AppText color={theme.colors.textMuted}>{empty}</AppText> : rows.map((row) => (
        <Pressable
          key={row._id}
          accessibilityRole="button"
          accessibilityLabel={`Open ${row.category} Gathering`}
          onPress={() => router.push({ pathname: '/gatherings/[id]', params: { id: row._id } } as never)}
          style={({ pressed }) => [styles.card, { borderColor: theme.colors.border, backgroundColor: theme.colors.surfaceRaised }, pressed && styles.pressed]}
        >
          <View style={styles.cardCopy}>
            <View style={styles.cardTitleRow}>
              <AppText variant="bodyStrong" numberOfLines={1}>{row.category}</AppText>
              <AppText variant="caption" color={row.state === 'cancelled' ? theme.colors.danger : theme.colors.socialText}>{gatheringStateLabel(row.state)}</AppText>
            </View>
            <AppText variant="caption" color={theme.colors.textMuted} numberOfLines={2}>{formatGatheringWhen(row.startsAt)} · {gatheringSeatLabel(row.confirmedCount, row.capacity)}</AppText>
          </View>
        </Pressable>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { gap: 12 },
  panel: { gap: 10, borderWidth: 1, borderRadius: density.controlRadius, padding: density.compactCardPadding },
  section: { gap: 8, marginTop: 8 },
  sectionHeading: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  optionRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, borderWidth: 1, borderRadius: density.controlRadius, paddingHorizontal: density.compactCardPadding, paddingVertical: 8 },
  optionCopy: { flex: 1, minWidth: 0 },
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: density.controlRadius, padding: density.compactCardPadding },
  cardCopy: { gap: 3 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  wrapRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pressed: { opacity: 0.72 },
})
