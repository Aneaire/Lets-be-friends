import { useQuery } from 'convex/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { AvailabilityCalendar } from './AvailabilityCalendar'
import {
  SCHEDULING_TIME_ZONE,
  getManilaMonth,
  schedulingMonthKey,
  type SchedulingMonth,
} from './scheduling'

export type BookingAvailabilityPickerProps = {
  companionProfileId: string
  durationMinutes: number
  selectedStart: number | null
  onSelectStart: (timestamp: number | null) => void
  disabled?: boolean
}

/**
 * Connected booking start picker. It owns the monthly query and the visible
 * month, then delegates every visual decision to `AvailabilityCalendar`.
 * Stale selections are cleared when the Companion, session length, month, or
 * returned slot data changes.
 */
export function BookingAvailabilityPicker({
  companionProfileId,
  durationMinutes,
  selectedStart,
  onSelectStart,
  disabled = false,
}: BookingAvailabilityPickerProps) {
  const [month, setMonth] = useState<SchedulingMonth>(() => getManilaMonth())
  const monthKey = schedulingMonthKey(month)
  const availability = useQuery(
    api.bookings.availableSlots,
    companionProfileId
      ? {
          companionProfileId: companionProfileId as Id<'companionProfiles'>,
          month: monthKey,
          durationMinutes,
        }
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

  // Companion, session length, or month changes drop an older start.
  useEffect(() => {
    if (lastContextKeyRef.current === contextKey) return
    lastContextKeyRef.current = contextKey
    onSelectStartRef.current(null)
  }, [contextKey])

  // Returned slot data can change under the same context (a booking was taken,
  // the owner edited their schedule, or the deployment returned fresh data).
  useEffect(() => {
    if (!availability) return
    if (selectedStart === null) return
    if (validStarts.has(selectedStart)) return
    onSelectStart(null)
  }, [availability, selectedStart, validStarts, onSelectStart])

  return (
    <AvailabilityCalendar
      month={month}
      onMonthChange={setMonth}
      days={availability?.days ?? []}
      durationMinutes={durationMinutes}
      selectedStart={selectedStart}
      onSelectStart={onSelectStart}
      loading={availability === undefined}
      scheduleConfigured={availability ? availability.scheduleConfigured : true}
      disabled={disabled}
      timezone={availability?.timezone ?? SCHEDULING_TIME_ZONE}
    />
  )
}
