import { useQuery } from 'convex/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'

import { mobileApi, type CompanionProfileId } from '@/backend/client'
import { ActionButton } from '@/design-system/atoms/ActionButton'
import { AppText } from '@/design-system/atoms/Typography'
import { InlineNotice } from '@/design-system/molecules/FeedbackState'
import { useAppTheme } from '@/theme/ThemeProvider'
import { density } from '@/theme/tokens'
import {
  currentManilaMonth,
  canShiftManilaMonth,
  formatManilaDay,
  formatManilaTime,
  manilaMonthKey,
  manilaMonthLabel,
  manilaMonthForTimestamp,
  shiftManilaMonth,
} from '@/data/companionAvailability'

export type AvailableSlotDay = {
  date: string
  startsAt: number[]
}

/**
 * Connected booking start picker. It owns the monthly `availableSlots` query
 * and the visible month, then delegates every visual decision to the
 * presentation below. Stale selections are cleared when the Companion, session
 * length, month, or returned slot data changes.
 */
export function BookingSlotPicker({
  companionProfileId,
  durationMinutes,
  selectedStart,
  onSelectStart,
  disabled = false,
  onStateChange,
}: {
  companionProfileId: string
  durationMinutes: number
  selectedStart: number | null
  onSelectStart: (timestamp: number | null) => void
  disabled?: boolean
  onStateChange?: (state: { loading: boolean; selectedValid: boolean }) => void
}) {
  const [month, setMonth] = useState(() => {
    const current = currentManilaMonth()
    if (selectedStart === null) return current
    const selected = manilaMonthForTimestamp(selectedStart)
    return selected.year * 12 + selected.monthIndex < current.year * 12 + current.monthIndex ? current : selected
  })
  const monthKey = manilaMonthKey(month)
  const availability = useQuery(
    mobileApi.bookings.availableSlots,
    companionProfileId && Number.isSafeInteger(durationMinutes) && durationMinutes > 0
      ? { companionProfileId: companionProfileId as CompanionProfileId, month: monthKey, durationMinutes }
      : 'skip',
  )

  const validStarts = useMemo(
    () => new Set((availability?.days ?? []).flatMap((day) => day.startsAt)),
    [availability],
  )

  const contextKey = `${companionProfileId}|${durationMinutes}|${monthKey}`
  const lastContextKeyRef = useRef(contextKey)
  const onSelectStartRef = useRef(onSelectStart)
  onSelectStartRef.current = onSelectStart

  useEffect(() => {
    if (lastContextKeyRef.current === contextKey) return
    lastContextKeyRef.current = contextKey
    onSelectStartRef.current(null)
  }, [contextKey])

  useEffect(() => {
    if (!availability) return
    if (selectedStart === null) return
    if (validStarts.has(selectedStart)) return
    onSelectStart(null)
  }, [availability, selectedStart, validStarts, onSelectStart])

  const loading = availability === undefined
  const selectedValid = selectedStart !== null && validStarts.has(selectedStart)
  useEffect(() => {
    onStateChange?.({ loading, selectedValid })
  }, [loading, onStateChange, selectedValid])

  const prevEnabled = canShiftManilaMonth(month, -1)
  const nextEnabled = canShiftManilaMonth(month, 1)

  return (
    <BookingSlotPickerPresentation
      monthLabel={manilaMonthLabel(month)}
      onPrevMonth={() => { if (prevEnabled) setMonth((current) => shiftManilaMonth(current, -1)) }}
      onNextMonth={() => { if (nextEnabled) setMonth((current) => shiftManilaMonth(current, 1)) }}
      prevEnabled={prevEnabled}
      nextEnabled={nextEnabled}
      loading={loading}
      scheduleConfigured={availability ? availability.scheduleConfigured : true}
      days={availability?.days ?? []}
      selectedStart={selectedStart}
      onSelectStart={onSelectStart}
      disabled={disabled}
    />
  )
}

export function BookingSlotPickerPresentation({
  monthLabel,
  onPrevMonth,
  onNextMonth,
  loading = false,
  scheduleConfigured = true,
  days,
  selectedStart,
  onSelectStart,
  disabled = false,
  prevEnabled = true,
  nextEnabled = true,
}: {
  monthLabel: string
  onPrevMonth: () => void
  onNextMonth: () => void
  loading?: boolean
  scheduleConfigured?: boolean
  days: AvailableSlotDay[]
  selectedStart: number | null
  onSelectStart: (timestamp: number | null) => void
  disabled?: boolean
  prevEnabled?: boolean
  nextEnabled?: boolean
}) {
  const theme = useAppTheme()
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const activeDay = days.find((day) => day.date === selectedDate) ?? null
  const totalStarts = days.reduce((count, day) => count + day.startsAt.length, 0)

  useEffect(() => {
    if (selectedStart !== null) {
      const selectedDay = days.find((day) => day.startsAt.includes(selectedStart))
      if (selectedDay && selectedDay.date !== selectedDate) setSelectedDate(selectedDay.date)
    }
  }, [days, selectedDate, selectedStart])

  useEffect(() => {
    if (selectedDate && !days.some((day) => day.date === selectedDate)) setSelectedDate(null)
  }, [days, selectedDate])

  return (
    <View style={[styles.panel, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <AppText variant="label" color={theme.colors.socialText}>AVAILABLE TIMES</AppText>
          <AppText variant="bodyStrong" accessibilityLiveRegion="polite">{monthLabel}</AppText>
        </View>
        <View style={styles.monthNav}>
          <ActionButton label="Previous month" onPress={onPrevMonth} intent="neutral" secondary compact disabled={disabled || !prevEnabled} />
          <ActionButton label="Next month" onPress={onNextMonth} intent="neutral" secondary compact disabled={disabled || !nextEnabled} />
        </View>
      </View>

      {loading ? (
        <AppText color={theme.colors.textMuted}>Loading available Manila times.</AppText>
      ) : !scheduleConfigured ? (
        <InlineNotice title="No availability calendar" tone="neutral">
          This Companion has not shared weekly availability, so open times cannot be listed. The server still checks every request.
        </InlineNotice>
      ) : totalStarts === 0 ? (
        <InlineNotice title="No open times this month" tone="warning">
          Every slot is taken or outside the shared weekly schedule. Try another month or check back later.
        </InlineNotice>
      ) : (
        <View style={styles.body}>
          <AppText variant="caption" color={theme.colors.textMuted}>
            {days.length} {days.length === 1 ? 'day has' : 'days have'} openings · Asia/Manila
          </AppText>
          <View style={styles.dates}>
            {days.map((day) => {
              const active = day.date === selectedDate
              const firstStart = day.startsAt[0] ?? 0
              return (
                <Pressable
                  key={day.date}
                  accessibilityRole="radio"
                  accessibilityLabel={`${formatManilaDay(firstStart)}, ${day.startsAt.length} openings`}
                  accessibilityState={{ checked: active, disabled }}
                  aria-checked={active}
                  disabled={disabled}
                  onPress={() => setSelectedDate(day.date)}
                  style={({ pressed }) => [
                    styles.date,
                    { borderColor: active ? theme.colors.social : theme.colors.border, backgroundColor: active ? theme.colors.socialSoft : theme.colors.background },
                    pressed && styles.pressed,
                  ]}>
                  <AppText variant="bodyStrong" color={active ? theme.colors.socialText : theme.colors.text}>{formatManilaDay(firstStart)}</AppText>
                  <AppText variant="caption" color={theme.colors.textMuted}>{day.startsAt.length} open</AppText>
                </Pressable>
              )
            })}
          </View>
          {activeDay ? (
            <View style={styles.times}>
              {activeDay.startsAt.map((start) => {
                const selected = start === selectedStart
                return (
                  <Pressable
                    key={start}
                    accessibilityRole="radio"
                    accessibilityLabel={`${formatManilaTime(start)} Manila time${selected ? ', selected' : ''}`}
                    accessibilityState={{ checked: selected, disabled }}
                    aria-checked={selected}
                    disabled={disabled}
                    onPress={() => onSelectStart(selected ? null : start)}
                    style={({ pressed }) => [
                      styles.time,
                      { borderColor: selected ? theme.colors.social : theme.colors.border, backgroundColor: selected ? theme.colors.socialSoft : theme.colors.background },
                      pressed && styles.pressed,
                    ]}>
                    <AppText variant="bodyStrong" color={selected ? theme.colors.socialText : theme.colors.text}>{formatManilaTime(start)}</AppText>
                  </Pressable>
                )
              })}
            </View>
          ) : (
            <AppText variant="caption" color={theme.colors.textMuted}>Choose a day to see its Manila start times.</AppText>
          )}
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  panel: { borderWidth: 1, borderRadius: 16, padding: density.cardPadding, gap: density.cardGap },
  header: { gap: density.cardGap },
  headerCopy: { width: '100%', gap: density.textPairGap },
  monthNav: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  body: { gap: density.cardGap },
  dates: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  date: { minWidth: 104, minHeight: 60, borderWidth: 1, borderRadius: 12, padding: density.compactCardPadding, gap: 2, justifyContent: 'center' },
  times: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  time: { minWidth: 96, minHeight: 44, borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.68 },
})
