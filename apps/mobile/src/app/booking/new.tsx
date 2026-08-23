import { formatPhp } from '@lets-be-friends/shared'
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker'
import { useMutation, useQuery } from 'convex/react'
import { router, useLocalSearchParams, type ErrorBoundaryProps } from 'expo-router'
import { useMemo, useRef, useState } from 'react'
import { Platform, Pressable, StyleSheet, TextInput, View } from 'react-native'

import { mobileApi, type CompanionProfileId } from '@/backend/client'
import { ActionButton } from '@/design-system/atoms/ActionButton'
import { AppIcon } from '@/design-system/atoms/AppIcon'
import { useAppToastMessage } from '@/design-system/molecules/AppToast'
import { Screen } from '@/design-system/templates/Screen'
import { AppText } from '@/design-system/atoms/Typography'
import { bookingPriceEstimate } from '@/data/bookingPricing'
import { parseManilaBookingInput } from '@/data/bookingViewModels'
import { mapPublicCompanion, type ApprovedCompanionRecord, type SessionMode } from '@/data/companionViewModels'
import { safeProductError } from '@/data/productErrors'
import { useMobileMember } from '@/member/MobileMember'
import { useAppTheme } from '@/theme/ThemeProvider'

export default function NewBookingScreen() {
  const member = useMobileMember()
  const params = useLocalSearchParams<{ companionProfileId?: string }>()
  const companionProfileId = typeof params.companionProfileId === 'string' ? params.companionProfileId : ''
  const canRead = member.status === 'ready' && Boolean(companionProfileId)
  const companionResult = useQuery(
    mobileApi.companions.getPublic,
    canRead ? { companionProfileId: companionProfileId as CompanionProfileId } : 'skip',
  )
  const finance = useQuery(mobileApi.finance.memberDashboard, member.status === 'ready' ? {} : 'skip')

  if (member.status === 'signed_out') return <BookingGate title="Sign in to request a booking" actionLabel="Sign in" onPress={() => router.replace('/auth')} />
  if (member.status === 'unconfigured') return <BookingGate title="Bookings need account services" actionLabel="Return to Explore" onPress={() => router.replace('/explore')} />
  if (member.status === 'unavailable' || member.status === 'error') return <BookingGate title="Bookings are unavailable" detail="Your member account could not be connected safely." />
  if (member.status !== 'ready') return <BookingGate title="Preparing your member account" />
  if (companionResult === undefined) return <BookingGate title="Loading booking options" />
  if (companionResult === null) return <BookingGate title="This Companion is unavailable" actionLabel="Return to Explore" onPress={() => router.replace('/explore')} />
  if (finance === undefined) return <BookingGate title="Checking booking availability" />
  if (finance === null) return <BookingGate title="Bookings are unavailable" detail="Your booking balance could not be connected safely." />
  if (!finance.enabled) return <BookingGate title="Bookings are unavailable" detail="Member booking services are not accepting requests right now." actionLabel="Return to profile" onPress={() => goBackOr('/explore')} />

  const companion = mapPublicCompanion(companionResult as ApprovedCompanionRecord)
  if (!companion.bookable || companion.viewerBookingEligibility !== 'eligible' || !companion.hourlyRateCentavos) {
    return <BookingGate title="This booking cannot be requested" detail="Return to the Companion profile for current eligibility details." actionLabel="Return to profile" onPress={() => goBackOr('/explore')} />
  }
  return <BookingForm companion={companion} availableCentavos={finance.availableCentavos} />
}

function BookingForm({ companion, availableCentavos }: { companion: ReturnType<typeof mapPublicCompanion>; availableCentavos?: number }) {
  const theme = useAppTheme()
  const createDraft = useMutation(mobileApi.bookings.createDraft)
  const initial = useMemo(defaultManilaInputs, [])
  const [category, setCategory] = useState(companion.categories[0] ?? '')
  const [mode, setMode] = useState<SessionMode>(companion.sessionModes[0] ?? 'online')
  const [dateInput, setDateInput] = useState(initial.date)
  const [timeInput, setTimeInput] = useState(initial.time)
  const [durationInput, setDurationInput] = useState('60')
  const [picker, setPicker] = useState<'date' | 'time' | null>(null)
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')
  useAppToastMessage(error)
  const [submitting, setSubmitting] = useState(false)
  const submittingRef = useRef(false)
  const estimate = bookingPriceEstimate(companion.hourlyRateCentavos, durationInput)
  const pickerValue = useMemo(() => new Date(`${dateInput}T${timeInput}:00`), [dateInput, timeInput])

  function updateSchedule(event: DateTimePickerEvent, selected?: Date) {
    if (Platform.OS === 'android') setPicker(null)
    if (event.type === 'dismissed' || !selected) return
    if (picker === 'date') setDateInput(`${selected.getFullYear()}-${String(selected.getMonth() + 1).padStart(2, '0')}-${String(selected.getDate()).padStart(2, '0')}`)
    if (picker === 'time') setTimeInput(`${String(selected.getHours()).padStart(2, '0')}:${String(selected.getMinutes()).padStart(2, '0')}`)
  }

  async function submit() {
    if (submittingRef.current) return
    setError('')
    if (!companion.categories.includes(category) || !companion.sessionModes.includes(mode)) {
      setError('Choose a category and format offered by this Companion.')
      return
    }
    const parsed = parseManilaBookingInput(dateInput, timeInput, durationInput)
    if (!parsed.ok) {
      setError(parsed.message)
      return
    }
    if (notes.length > 1_000) {
      setError('Notes can be up to 1,000 characters.')
      return
    }
    submittingRef.current = true
    setSubmitting(true)
    try {
      const result = await createDraft({
        companionProfileId: companion.id as CompanionProfileId,
        category,
        mode,
        requestedAt: parsed.requestedAt,
        durationMinutes: parsed.durationMinutes,
        notes: notes.trim() || undefined,
      })
      router.replace({ pathname: '/booking/[id]', params: { id: String(result.bookingId) } })
    } catch (submitError) {
      setError(safeProductError('create_booking', submitError))
      submittingRef.current = false
      setSubmitting(false)
    }
  }

  return (
    <Screen contentStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.navRow}>
        <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={() => goBackOr('/explore')} style={styles.back}>
          <AppText variant="heading">‹</AppText>
        </Pressable>
        <AppText variant="label" color={theme.colors.social}>BOOKING REQUEST</AppText>
      </View>
      <AppText variant="title">Plan time with {companion.name}</AppText>
      <AppText color={theme.colors.textMuted}>Times are entered in Manila time. Review every detail before sending.</AppText>

      <FieldLabel label="Category" />
      <ChoiceRow values={companion.categories} selected={category} onSelect={setCategory} />
      <FieldLabel label="Format" />
      <ChoiceRow values={companion.sessionModes} selected={mode} onSelect={(value) => setMode(value as SessionMode)} format={(value) => value === 'in_person' ? 'In person' : 'Online'} />

      <FieldLabel label="Schedule" />
      <AppText variant="caption" color={theme.colors.textMuted}>Asia/Manila (UTC+8). Confirm that this timezone works for both people.</AppText>
      <View style={styles.scheduleRow}>
        <ScheduleButton icon="calendar-outline" label="Date" value={formatDateLabel(dateInput)} onPress={() => setPicker('date')} />
        <ScheduleButton icon="time-outline" label="Time" value={formatTimeLabel(timeInput)} onPress={() => setPicker('time')} />
      </View>
      {picker ? <DateTimePicker value={pickerValue} mode={picker} display="default" minimumDate={picker === 'date' ? new Date() : undefined} minuteInterval={15} onChange={updateSchedule} /> : null}
      <FieldLabel label="Duration" />
      <ChoiceRow values={['30', '60', '90', '120']} selected={durationInput} onSelect={setDurationInput} format={(value) => `${Number(value) / 60 < 1 ? `${value} min` : `${Number(value) / 60} ${Number(value) === 60 ? 'hour' : 'hours'}`}`} />
      <FieldLabel label="Notes, optional" />
      <Input label="Booking notes" value={notes} onChangeText={setNotes} placeholder="Share meeting details or accessibility needs" multiline />
      <AppText variant="caption" color={notes.length > 1_000 ? theme.colors.danger : theme.colors.textMuted}>{notes.length}/1,000</AppText>

      <View style={[styles.summary, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
        <Summary label="Hourly rate" value={companion.rateLabel ?? 'Unavailable'} />
        {estimate ? (
          <>
            <Summary label="Session subtotal" value={formatPhp(estimate.serviceSubtotalCentavos)} />
            <Summary label="Booking fee" value={formatPhp(estimate.memberBookingFeeCentavos)} />
            <Summary label="Estimated total" value={formatPhp(estimate.memberTotalCentavos)} />
          </>
        ) : <AppText variant="caption" color={theme.colors.textMuted}>Enter a valid duration in 15-minute increments to see the estimate.</AppText>}
        <Summary label="Booking balance" value={availableCentavos === undefined ? 'Unavailable' : formatMoney(availableCentavos)} />
        <AppText variant="caption" color={theme.colors.textMuted}>The final total and booking balance are confirmed when you send the request.</AppText>
        <ActionButton label="Open booking wallet" onPress={() => router.push('/wallet')} intent="self" secondary />
      </View>

      <ActionButton label={submitting ? 'Sending request' : 'Send booking request'} onPress={() => void submit()} disabled={submitting} />
      <ActionButton label="Cancel" onPress={() => goBackOr('/explore')} secondary disabled={submitting} />
    </Screen>
  )
}

function ChoiceRow({ values, selected, onSelect, format = (value) => value }: { values: string[]; selected: string; onSelect: (value: string) => void; format?: (value: string) => string }) {
  const theme = useAppTheme()
  return <View style={styles.choices}>{values.map((value) => (
    <Pressable
      key={value}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected === value }}
      onPress={() => onSelect(value)}
      style={[styles.choice, { borderColor: selected === value ? theme.colors.social : theme.colors.border, backgroundColor: selected === value ? theme.colors.socialSoft : theme.colors.surfaceRaised }]}>
      <AppText variant="caption" color={selected === value ? theme.colors.social : theme.colors.text}>{format(value)}</AppText>
    </Pressable>
  ))}</View>
}

function FieldLabel({ label }: { label: string }) {
  return <AppText variant="bodyStrong" style={styles.fieldLabel}>{label}</AppText>
}

function ScheduleButton({ icon, label, value, onPress }: { icon: 'calendar-outline' | 'time-outline'; label: string; value: string; onPress: () => void }) {
  const theme = useAppTheme()
  return <Pressable accessibilityRole="button" accessibilityLabel={`Choose ${label.toLowerCase()}, currently ${value}`} onPress={onPress} style={({ pressed }) => [styles.scheduleButton, { borderColor: theme.colors.border, backgroundColor: theme.colors.surfaceRaised }, pressed && styles.pressed]}><AppIcon name={icon} color={theme.colors.socialText} /><View style={styles.scheduleCopy}><AppText variant="caption" color={theme.colors.textMuted}>{label}</AppText><AppText variant="bodyStrong">{value}</AppText></View><AppIcon name="chevron-down" color={theme.colors.textMuted} size={18} /></Pressable>
}

function Input(props: React.ComponentProps<typeof TextInput> & { label: string }) {
  const theme = useAppTheme()
  const { label, multiline, ...inputProps } = props
  return <TextInput accessibilityLabel={label} placeholderTextColor={theme.colors.textMuted} multiline={multiline} {...inputProps} style={[styles.input, multiline && styles.notes, theme.typography.body, { color: theme.colors.text, borderColor: theme.colors.border, backgroundColor: theme.colors.surfaceRaised }]} />
}

function Summary({ label, value }: { label: string; value: string }) {
  const theme = useAppTheme()
  return <View style={styles.summaryRow}><AppText variant="caption" color={theme.colors.textMuted}>{label}</AppText><AppText variant="bodyStrong">{value}</AppText></View>
}

function BookingGate({ title, detail, actionLabel, onPress }: { title: string; detail?: string; actionLabel?: string; onPress?: () => void }) {
  const theme = useAppTheme()
  return <Screen contentStyle={styles.state}><AppText variant="label" color={theme.colors.social}>BOOKINGS</AppText><AppText variant="title">{title}</AppText>{detail ? <AppText color={theme.colors.textMuted}>{detail}</AppText> : null}{actionLabel && onPress ? <ActionButton label={actionLabel} onPress={onPress} secondary /> : null}</Screen>
}

function defaultManilaInputs() {
  const manila = new Date(Date.now() + 8 * 60 * 60 * 1_000 + 24 * 60 * 60 * 1_000)
  return {
    date: `${manila.getUTCFullYear()}-${String(manila.getUTCMonth() + 1).padStart(2, '0')}-${String(manila.getUTCDate()).padStart(2, '0')}`,
    time: '10:00',
  }
}

function formatMoney(centavos: number) {
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(centavos / 100)
}

function formatDateLabel(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  return new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(year, month - 1, day))
}

function formatTimeLabel(value: string) {
  const [hour, minute] = value.split(':').map(Number)
  return new Intl.DateTimeFormat('en-PH', { hour: 'numeric', minute: '2-digit' }).format(new Date(2020, 0, 1, hour, minute))
}

export function ErrorBoundary({ retry }: ErrorBoundaryProps) {
  return <BookingGate title="Booking options are temporarily unavailable" detail="No booking request was sent. Please try again." actionLabel="Try again" onPress={retry} />
}

function goBackOr(fallback: '/explore') {
  if (router.canGoBack()) router.back()
  else router.replace(fallback)
}

const styles = StyleSheet.create({
  content: { paddingBottom: 40, gap: 12 },
  state: { flexGrow: 1, justifyContent: 'center', gap: 16 },
  navRow: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 16 },
  back: { width: 48, height: 48, justifyContent: 'center' },
  fieldLabel: { marginTop: 8 },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choice: { minHeight: 44, borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, justifyContent: 'center' },
  scheduleRow: { flexDirection: 'row', gap: 10 },
  scheduleButton: { flex: 1, minHeight: 64, borderWidth: 1, borderRadius: 16, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 9 },
  scheduleCopy: { flex: 1, gap: 1 },
  pressed: { opacity: 0.72 },
  input: { minHeight: 48, borderWidth: 1, borderRadius: 16, paddingHorizontal: 16 },
  notes: { minHeight: 112, paddingTop: 14, textAlignVertical: 'top' },
  summary: { borderWidth: 1, borderRadius: 16, padding: 14, gap: 12, marginVertical: 8 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 16 },
})
