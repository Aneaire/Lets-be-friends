import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'

import { AppText } from '@/design-system/atoms/Typography'
import { IconButton } from '@/design-system/atoms/IconButton'
import { ActionButton } from '@/design-system/atoms/ActionButton'
import { useAppTheme } from '@/theme/ThemeProvider'
import { density } from '@/theme/tokens'

import {
  addMonths,
  bookingDayLabel,
  bookingsByDay,
  calendarDays,
  calendarWeekdays,
  dateKey,
  dayIsOutsideMonth,
  dayIsSelected,
  dayIsToday,
  initialSelectedDate,
  longDate,
  monthLabel,
  startOfMonth,
  type CalendarBooking,
} from '@/data/bookingCalendar'

export function BookingsCalendarView<TBooking extends CalendarBooking>({
  bookings,
  bookingId,
  renderBooking,
  now: suppliedNow,
}: {
  bookings: TBooking[]
  bookingId?: string
  renderBooking: (booking: TBooking) => ReactNode
  now?: Date
}) {
  const theme = useAppTheme()
  const now = useMemo(() => suppliedNow ?? new Date(), [suppliedNow])
  const startingDate = useMemo(() => initialSelectedDate(bookings, bookingId, now), [bookingId, bookings, now])
  const [selectedDate, setSelectedDate] = useState(startingDate)
  const [visibleMonth, setVisibleMonth] = useState(() => startOfMonth(startingDate))

  const byDay = useMemo(() => bookingsByDay(bookings), [bookings])
  const days = useMemo(() => calendarDays(visibleMonth.getFullYear(), visibleMonth.getMonth()), [visibleMonth])
  const selectedBookings = byDay.get(dateKey(selectedDate)) ?? []
  const monthTitle = monthLabel(visibleMonth.getFullYear(), visibleMonth.getMonth())

  function chooseDate(date: Date) {
    setSelectedDate(date)
    if (date.getMonth() !== visibleMonth.getMonth() || date.getFullYear() !== visibleMonth.getFullYear()) {
      setVisibleMonth(startOfMonth(date))
    }
  }

  function goToday() {
    setSelectedDate(now)
    setVisibleMonth(startOfMonth(now))
  }

  return (
    <View style={styles.container}>
      <View style={styles.calendarPanel}>
        <View style={styles.calendarHeader}>
          <View style={styles.calendarHeaderCopy}>
            <AppText variant="label" color={theme.colors.social}>SCHEDULE</AppText>
            <AppText variant="title" accessibilityLiveRegion="polite">{monthTitle}</AppText>
          </View>
          <View style={styles.calendarNavigation}>
            <ActionButton label="Today" onPress={goToday} intent="neutral" secondary compact />
            <IconButton label="Previous month" icon="chevron-back" onPress={() => setVisibleMonth((month) => addMonths(month, -1))} />
            <IconButton label="Next month" icon="chevron-forward" onPress={() => setVisibleMonth((month) => addMonths(month, 1))} />
          </View>
        </View>

        <View accessible accessibilityLabel={monthTitle} style={styles.grid}>
          {calendarWeekdays.map((weekday) => (
            <View key={weekday} style={styles.weekday}>
              <AppText variant="caption" color={theme.colors.textMuted}>{weekday}</AppText>
            </View>
          ))}
          {days.map((date) => {
            const key = dateKey(date)
            const dayBookings = byDay.get(key) ?? []
            const count = dayBookings.length
            const outside = dayIsOutsideMonth(date, visibleMonth.getFullYear(), visibleMonth.getMonth())
            const selected = dayIsSelected(date, selectedDate)
            const today = dayIsToday(date, now)
            const label = `${longDate(date)}${count > 0 ? `, ${bookingDayLabel(count)}` : ''}`

            return (
              <Pressable
                key={key}
                accessibilityRole="button"
                accessibilityLabel={label}
                accessibilityState={{ selected }}
                onPress={() => chooseDate(date)}
                style={({ pressed }) => [
                  styles.day,
                  outside && styles.dayOutside,
                  selected && { backgroundColor: theme.colors.socialSoft },
                  today && { borderColor: theme.colors.socialControl },
                  pressed && styles.pressed,
                ]}>
                <AppText variant="bodyStrong" color={selected ? theme.colors.socialText : outside ? theme.colors.textMuted : theme.colors.text} style={styles.dayNumber}>
                  {date.getDate()}
                </AppText>
                {count > 0 ? (
                  <View style={[styles.dayCount, { backgroundColor: theme.colors.socialControl }]}>
                    <AppText variant="caption" color={theme.colors.accentText} style={styles.dayCountText}>{count}</AppText>
                  </View>
                ) : null}
              </Pressable>
            )
          })}
        </View>
      </View>

      <View style={styles.dayPanel}>
        <AppText variant="label" color={theme.colors.social}>SELECTED DAY</AppText>
        <AppText variant="heading">{longDate(selectedDate)}</AppText>
        <AppText variant="caption" color={theme.colors.textMuted}>
          {selectedBookings.length === 0 ? 'No bookings' : `${selectedBookings.length} ${selectedBookings.length === 1 ? 'booking' : 'bookings'}`}
        </AppText>
        {selectedBookings.length > 0 ? (
          <View style={styles.dayList}>
            {selectedBookings.map((booking) => (
              <View key={booking._id}>{renderBooking(booking)}</View>
            ))}
          </View>
        ) : (
          <View style={styles.dayEmpty}>
            <AppText variant="bodyStrong" color={theme.colors.textMuted}>Choose a marked date</AppText>
            <AppText variant="caption" color={theme.colors.textMuted} style={styles.dayEmptyCopy}>Pick a day with a booking count to see its details.</AppText>
          </View>
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { gap: density.contentGap },
  calendarPanel: { gap: density.compactCardPadding },
  calendarHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: density.cardGap },
  calendarHeaderCopy: { flex: 1, gap: 2 },
  calendarNavigation: { flexDirection: 'row', alignItems: 'center', gap: 0 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  weekday: { flexBasis: '13.0%', flexGrow: 1, alignItems: 'center', paddingVertical: 4 },
  day: {
    flexBasis: '13.0%',
    flexGrow: 1,
    minHeight: 52,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: density.controlRadius - 4,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingVertical: 4,
  },
  dayOutside: { opacity: 0.55 },
  dayNumber: { fontVariant: ['tabular-nums'] },
  dayCount: { minWidth: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  dayCountText: { fontVariant: ['tabular-nums'], fontWeight: '700' },
  dayPanel: { gap: density.textSectionGap },
  dayList: { gap: density.cardGap, marginTop: density.textSectionGap },
  dayEmpty: { alignItems: 'center', gap: density.textStackGap, paddingVertical: density.cardPadding },
  dayEmptyCopy: { textAlign: 'center', maxWidth: 300 },
  pressed: { opacity: 0.7 },
})
