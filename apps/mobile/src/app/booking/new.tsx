import { useMutation, useQuery } from 'convex/react'
import { router, useLocalSearchParams, type ErrorBoundaryProps } from 'expo-router'
import { useMemo, useRef, useState } from 'react'
import { Pressable, StyleSheet, TextInput, View } from 'react-native'

import { mobileApi, type HostProfileId } from '@/backend/client'
import { ActionButton } from '@/components/ActionButton'
import { Screen } from '@/components/Screen'
import { AppText } from '@/components/Typography'
import { parseManilaBookingInput } from '@/data/bookingViewModels'
import { mapPublicHost, type ApprovedHostRecord, type SessionMode } from '@/data/hostViewModels'
import { safeProductError } from '@/data/productErrors'
import { useMobileMember } from '@/member/MobileMember'
import { useAppTheme } from '@/theme/ThemeProvider'

export default function NewBookingScreen() {
  const member = useMobileMember()
  const params = useLocalSearchParams<{ hostProfileId?: string }>()
  const hostProfileId = typeof params.hostProfileId === 'string' ? params.hostProfileId : ''
  const canRead = member.status === 'ready' && Boolean(hostProfileId)
  const hostResult = useQuery(
    mobileApi.hosts.getPublic,
    canRead ? { hostProfileId: hostProfileId as HostProfileId } : 'skip',
  )
  const finance = useQuery(mobileApi.finance.memberDashboard, member.status === 'ready' ? {} : 'skip')

  if (member.status === 'signed_out') return <BookingGate title="Sign in to request a booking" actionLabel="Sign in" onPress={() => router.replace('/auth')} />
  if (member.status === 'demo') return <BookingGate title="Bookings are unavailable in demo mode" actionLabel="Return to Explore" onPress={() => router.replace('/explore')} />
  if (member.status === 'unavailable' || member.status === 'error') return <BookingGate title="Bookings are unavailable" detail="Your member account could not be connected safely." />
  if (member.status !== 'ready') return <BookingGate title="Preparing your member account" />
  if (hostResult === undefined) return <BookingGate title="Loading booking options" />
  if (hostResult === null) return <BookingGate title="This Friend Host is unavailable" actionLabel="Return to Explore" onPress={() => router.replace('/explore')} />
  if (finance === undefined) return <BookingGate title="Checking booking availability" />
  if (finance === null) return <BookingGate title="Bookings are unavailable" detail="Your booking balance could not be connected safely." />
  if (!finance.enabled) return <BookingGate title="Bookings are unavailable" detail="Member booking services are not accepting requests right now." actionLabel="Return to profile" onPress={() => goBackOr('/explore')} />

  const host = mapPublicHost(hostResult as ApprovedHostRecord)
  if (!host.bookable || host.viewerBookingEligibility !== 'eligible' || !host.hourlyRateCentavos) {
    return <BookingGate title="This booking cannot be requested" detail="Return to the Friend Host profile for current eligibility details." actionLabel="Return to profile" onPress={() => goBackOr('/explore')} />
  }
  return <BookingForm host={host} availableCentavos={finance.availableCentavos} />
}

function BookingForm({ host, availableCentavos }: { host: ReturnType<typeof mapPublicHost>; availableCentavos?: number }) {
  const theme = useAppTheme()
  const createDraft = useMutation(mobileApi.bookings.createDraft)
  const initial = useMemo(defaultManilaInputs, [])
  const [category, setCategory] = useState(host.categories[0] ?? '')
  const [mode, setMode] = useState<SessionMode>(host.sessionModes[0] ?? 'online')
  const [dateInput, setDateInput] = useState(initial.date)
  const [timeInput, setTimeInput] = useState(initial.time)
  const [durationInput, setDurationInput] = useState('60')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const submittingRef = useRef(false)

  async function submit() {
    if (submittingRef.current) return
    setError('')
    if (!host.categories.includes(category) || !host.sessionModes.includes(mode)) {
      setError('Choose a category and format offered by this Friend Host.')
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
        hostProfileId: host.id as HostProfileId,
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
      <AppText variant="title">Plan time with {host.name}</AppText>
      <AppText color={theme.colors.textMuted}>Times are entered in Manila time. Review every detail before sending.</AppText>

      <FieldLabel label="Category" />
      <ChoiceRow values={host.categories} selected={category} onSelect={setCategory} />
      <FieldLabel label="Format" />
      <ChoiceRow values={host.sessionModes} selected={mode} onSelect={(value) => setMode(value as SessionMode)} format={(value) => value === 'in_person' ? 'In person' : 'Online'} />

      <FieldLabel label="Date in Manila" />
      <Input label="Booking date in Manila" value={dateInput} onChangeText={setDateInput} placeholder="YYYY-MM-DD" inputMode="numeric" />
      <FieldLabel label="Time in Manila" />
      <Input label="Booking time in Manila" value={timeInput} onChangeText={setTimeInput} placeholder="HH:MM" inputMode="numeric" />
      <FieldLabel label="Duration in minutes" />
      <Input label="Booking duration in minutes" value={durationInput} onChangeText={setDurationInput} placeholder="60" inputMode="numeric" />
      <FieldLabel label="Notes, optional" />
      <Input label="Booking notes" value={notes} onChangeText={setNotes} placeholder="Share meeting details or accessibility needs" multiline />
      <AppText variant="caption" color={notes.length > 1_000 ? theme.colors.social : theme.colors.textMuted}>{notes.length}/1,000</AppText>

      <View style={[styles.summary, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
        <Summary label="Hourly rate" value={host.rateLabel ?? 'Unavailable'} />
        <Summary label="Booking balance" value={availableCentavos === undefined ? 'Unavailable' : formatMoney(availableCentavos)} />
        <AppText variant="caption" color={theme.colors.textMuted}>The server records the final total after the request is sent. Review it in booking details before the Friend Host accepts. Balance is read only in this app.</AppText>
      </View>

      {error ? <AppText accessibilityRole="alert" color={theme.colors.social}>{error}</AppText> : null}
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

export function ErrorBoundary({ retry }: ErrorBoundaryProps) {
  return <BookingGate title="Booking options are temporarily unavailable" detail="No booking request was sent. Please try again." actionLabel="Try again" onPress={retry} />
}

function goBackOr(fallback: '/explore') {
  if (router.canGoBack()) router.back()
  else router.replace(fallback)
}

const styles = StyleSheet.create({
  content: { paddingBottom: 64, gap: 12 },
  state: { flexGrow: 1, justifyContent: 'center', gap: 16 },
  navRow: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 16 },
  back: { width: 48, height: 48, justifyContent: 'center' },
  fieldLabel: { marginTop: 8 },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choice: { minHeight: 44, borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, justifyContent: 'center' },
  input: { minHeight: 52, borderWidth: 1, borderRadius: 16, paddingHorizontal: 16 },
  notes: { minHeight: 112, paddingTop: 14, textAlignVertical: 'top' },
  summary: { borderWidth: 1, borderRadius: 20, padding: 16, gap: 12, marginVertical: 8 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 16 },
})
