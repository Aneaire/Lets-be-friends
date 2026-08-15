import { formatPhp } from '@lets-be-friends/shared'
import type { FunctionReturnType } from 'convex/server'
import { useMutation, useQuery } from 'convex/react'
import { router, useLocalSearchParams, type ErrorBoundaryProps } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import { Pressable, StyleSheet, TextInput, View } from 'react-native'

import { mobileApi, type BookingId, type CompanionProfileId } from '@/backend/client'
import { ActionButton } from '@/components/ActionButton'
import { useAppToastMessage } from '@/components/AppToast'
import { Screen } from '@/components/Screen'
import { AppText } from '@/components/Typography'
import { bookingActionVisibility } from '@/data/bookingLifecycle'
import { bookingPriceEstimate } from '@/data/bookingPricing'
import { parseManilaBookingInput } from '@/data/bookingViewModels'
import { mapPublicCompanion, type ApprovedCompanionRecord, type SessionMode } from '@/data/companionViewModels'
import { safeProductError } from '@/data/productErrors'
import { useMobileMember } from '@/member/MobileMember'
import { useAppTheme } from '@/theme/ThemeProvider'

type Booking = FunctionReturnType<typeof mobileApi.bookings.mine>[number]

export default function EditBookingRequestScreen() {
  const member = useMobileMember()
  const params = useLocalSearchParams<{ id?: string }>()
  const bookingId = typeof params.id === 'string' ? params.id : ''
  const bookings = useQuery(mobileApi.bookings.mine, member.status === 'ready' ? {} : 'skip')
  const booking = bookings?.find((item: Booking) => String(item._id) === bookingId)
  const companionResult = useQuery(
    mobileApi.companions.getPublic,
    member.status === 'ready' && booking
      ? { companionProfileId: booking.companionProfileId as CompanionProfileId }
      : 'skip',
  )

  if (member.status === 'signed_out') return <EditGate title="Sign in to edit this request" action="Sign in" onPress={() => router.replace('/auth')} />
  if (member.status === 'unconfigured') return <EditGate title="Booking requests need account services" action="Return home" onPress={() => router.replace('/')} />
  if (member.status === 'unavailable' || member.status === 'error') return <EditGate title="This booking request is unavailable" detail="Your member account could not be connected safely." />
  if (member.status !== 'ready' || bookings === undefined) return <EditGate title="Loading booking request" />
  if (!booking) return <EditGate title="Booking request not found" detail="This booking is not available in your member history." action="View all bookings" onPress={() => router.replace('/bookings')} />

  const actions = bookingActionVisibility({
    status: booking.status,
    viewerRole: 'member',
    memberCompletedAt: booking.memberCompletedAt,
    companionCompletedAt: booking.companionCompletedAt,
  })
  if (!actions.canEditRequest) return <EditGate title="This request can no longer be edited" detail="Only your pending request can be edited before the Companion decides." action="Return to booking" onPress={() => returnToBooking(bookingId)} />
  if (companionResult === undefined) return <EditGate title="Loading current Companion options" />
  if (companionResult === null) return <EditGate title="This request cannot be edited" detail="The current public Companion profile is unavailable. No changes were made." action="Return to booking" onPress={() => returnToBooking(bookingId)} />

  return <EditRequestForm key={String(booking.updatedAt)} booking={booking} companionRecord={companionResult as ApprovedCompanionRecord} />
}

function EditRequestForm({ booking, companionRecord }: { booking: Booking; companionRecord: ApprovedCompanionRecord }) {
  const theme = useAppTheme()
  const editRequest = useMutation(mobileApi.bookings.editRequest)
  const companion = mapPublicCompanion(companionRecord)
  const initial = manilaInputs(booking.requestedAt)
  const [category, setCategory] = useState(booking.category)
  const [mode, setMode] = useState<SessionMode>(booking.mode)
  const [dateInput, setDateInput] = useState(initial.date)
  const [timeInput, setTimeInput] = useState(initial.time)
  const [durationInput, setDurationInput] = useState(String(booking.durationMinutes))
  const [notes, setNotes] = useState(booking.notes ?? '')
  const [error, setError] = useState('')
  useAppToastMessage(error)
  const [submitting, setSubmitting] = useState(false)
  const submittingRef = useRef(false)
  const estimate = bookingPriceEstimate(companion.hourlyRateCentavos, durationInput)

  useEffect(() => {
    if (!companion.categories.includes(category)) setCategory(companion.categories[0] ?? '')
    if (!companion.sessionModes.includes(mode)) setMode(companion.sessionModes[0] ?? 'online')
  }, [category, companion.categories, companion.sessionModes, mode])

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
      await editRequest({
        bookingId: booking._id as BookingId,
        category,
        mode,
        requestedAt: parsed.requestedAt,
        durationMinutes: parsed.durationMinutes,
        notes: notes.trim() || undefined,
      })
      router.replace({ pathname: '/booking/[id]', params: { id: String(booking._id) } })
    } catch (submitError) {
      setError(safeProductError('edit_booking', submitError))
      submittingRef.current = false
      setSubmitting(false)
    }
  }

  return (
    <Screen contentStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.navRow}>
        <Pressable accessibilityRole="button" accessibilityLabel="Return to booking" onPress={() => returnToBooking(String(booking._id))} style={styles.back}>
          <AppText variant="heading">‹</AppText>
        </Pressable>
        <AppText variant="label" color={theme.colors.social}>EDIT REQUEST</AppText>
      </View>
      <AppText variant="title">Edit request</AppText>
      <AppText color={theme.colors.textMuted}>Update your pending request using Manila time. We will recheck eligibility, wallet balance, pricing, schedule, and booking status.</AppText>

      <FieldLabel label="Category" />
      <ChoiceRow values={companion.categories} selected={category} onSelect={setCategory} />
      <FieldLabel label="Format" />
      <ChoiceRow values={companion.sessionModes} selected={mode} onSelect={(value) => setMode(value as SessionMode)} format={(value) => value === 'in_person' ? 'In person' : 'Online'} />
      <FieldLabel label="Date in Manila" />
      <Input label="Booking date in Manila" value={dateInput} onChangeText={setDateInput} placeholder="YYYY-MM-DD" inputMode="numeric" />
      <FieldLabel label="Time in Manila" />
      <Input label="Booking time in Manila" value={timeInput} onChangeText={setTimeInput} placeholder="HH:MM" inputMode="numeric" />
      <FieldLabel label="Duration in minutes" />
      <Input label="Booking duration in minutes" value={durationInput} onChangeText={setDurationInput} placeholder="60" inputMode="numeric" />
      <FieldLabel label="Notes, optional" />
      <Input label="Booking notes" value={notes} onChangeText={setNotes} placeholder="Share meeting details or accessibility needs" multiline />
      <AppText variant="caption" color={notes.length > 1_000 ? theme.colors.danger : theme.colors.textMuted}>{notes.length}/1,000</AppText>

      <View style={[styles.summary, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
        <AppText variant="bodyStrong">Updated price estimate</AppText>
        {estimate ? (
          <>
            <Summary label="Session subtotal" value={formatPhp(estimate.serviceSubtotalCentavos)} />
            <Summary label="Booking fee" value={formatPhp(estimate.memberBookingFeeCentavos)} />
            <Summary label="Estimated total" value={formatPhp(estimate.memberTotalCentavos)} />
          </>
        ) : <AppText variant="caption" color={theme.colors.textMuted}>Enter a valid duration in 15-minute increments to see the estimate.</AppText>}
        <AppText variant="caption" color={theme.colors.textMuted}>Your final price is checked again when you save.</AppText>
      </View>
      <ActionButton label={submitting ? 'Saving request' : 'Save request changes'} onPress={() => void submit()} disabled={submitting} intent="social" />
      <ActionButton label="Keep current request" onPress={() => returnToBooking(String(booking._id))} disabled={submitting} intent="social" secondary />
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

function Summary({ label, value }: { label: string; value: string }) {
  const theme = useAppTheme()
  return <View style={styles.summaryRow}><AppText variant="caption" color={theme.colors.textMuted}>{label}</AppText><AppText variant="bodyStrong">{value}</AppText></View>
}

function Input(props: React.ComponentProps<typeof TextInput> & { label: string }) {
  const theme = useAppTheme()
  const { label, multiline, ...inputProps } = props
  return <TextInput accessibilityLabel={label} placeholderTextColor={theme.colors.textMuted} multiline={multiline} {...inputProps} style={[styles.input, multiline && styles.notes, theme.typography.body, { color: theme.colors.text, borderColor: theme.colors.border, backgroundColor: theme.colors.surfaceRaised }]} />
}

function EditGate({ title, detail, action, onPress }: { title: string; detail?: string; action?: string; onPress?: () => void }) {
  const theme = useAppTheme()
  return <Screen contentStyle={styles.state}><AppText variant="label" color={theme.colors.social}>EDIT REQUEST</AppText><AppText variant="title">{title}</AppText>{detail ? <AppText color={theme.colors.textMuted}>{detail}</AppText> : null}{action && onPress ? <ActionButton label={action} onPress={onPress} intent="social" secondary /> : null}</Screen>
}

function manilaInputs(timestamp: number) {
  const date = new Date(timestamp + 8 * 60 * 60 * 1_000)
  return {
    date: `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`,
    time: `${String(date.getUTCHours()).padStart(2, '0')}:${String(date.getUTCMinutes()).padStart(2, '0')}`,
  }
}

function returnToBooking(id: string) {
  router.replace({ pathname: '/booking/[id]', params: { id } })
}

export function ErrorBoundary({ retry }: ErrorBoundaryProps) {
  return <EditGate title="Edit request is temporarily unavailable" detail="Reload the booking and confirm its current details before trying again." action="Try again" onPress={retry} />
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
  summary: { borderWidth: 1, borderRadius: 20, padding: 16, gap: 8, marginVertical: 8 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 16 },
})
