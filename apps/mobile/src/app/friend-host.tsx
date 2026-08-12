import { activityCategories, friendStrengths, type HostApplicationStatus } from '@lets-be-friends/shared'
import type { FunctionReturnType } from 'convex/server'
import { useMutation, useQuery } from 'convex/react'
import * as Linking from 'expo-linking'
import { router, type ErrorBoundaryProps } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import { Pressable, StyleSheet, Switch, TextInput, View } from 'react-native'

import { buildMobileWebHandoffUrl, resolveMobileWebAppConfiguration } from '@/backend/config'
import { mobileApi } from '@/backend/client'
import { ActionButton } from '@/components/ActionButton'
import { Screen, Section } from '@/components/Screen'
import { AppText } from '@/components/Typography'
import {
  hasSavedNearbyCoordinates,
  hostApplicationStatusCopy,
  initialHostApplicationForm,
  type HostApplicationForm,
  type HostMode,
  validateHostApplication,
  validateHourlyRate,
} from '@/data/hostTools'
import { useMobileMember } from '@/member/MobileMember'
import { useAppTheme } from '@/theme/ThemeProvider'

type HostApplication = NonNullable<FunctionReturnType<typeof mobileApi.hosts.myApplication>>

export default function FriendHostScreen() {
  const member = useMobileMember()
  if (member.status === 'signed_out') return <HostState title="Sign in to manage Friend Host tools" action="Sign in" onPress={() => router.replace('/auth')} />
  if (member.status === 'demo') return <HostState title="Friend Host tools are unavailable in demo mode" action="Return to Profile" onPress={() => router.replace('/profile')} />
  if (member.status === 'unavailable' || member.status === 'error') return <HostState title="Friend Host tools are unavailable" detail="Your member account could not be connected safely." />
  if (member.status !== 'ready') return <HostState title="Loading Friend Host tools" />
  return <ReadyFriendHostScreen />
}

function ReadyFriendHostScreen() {
  const theme = useAppTheme()
  const application = useQuery(mobileApi.hosts.myApplication, {})
  const submitApplication = useMutation(mobileApi.hosts.submitApplication)
  const updateHourlyRate = useMutation(mobileApi.hosts.updateHourlyRate)
  const setNearbyVisibility = useMutation(mobileApi.hosts.setNearbyDiscoveryVisibility)
  const [form, setForm] = useState<HostApplicationForm>(() => initialHostApplicationForm())
  const [quickRate, setQuickRate] = useState('500')
  const [busy, setBusy] = useState<'application' | 'rate' | 'nearby' | 'verification' | null>(null)
  const [message, setMessage] = useState('')
  const busyRef = useRef(false)
  const formDirtyRef = useRef(false)
  const hydratedApplicationIdRef = useRef<string | null>(null)

  useEffect(() => {
    if (!application) return
    const applicationId = String(application._id)
    if (formDirtyRef.current && hydratedApplicationIdRef.current === applicationId) return
    setForm(initialHostApplicationForm(application))
    setQuickRate(String((application.hourlyRateCentavos ?? 50_000) / 100))
    hydratedApplicationIdRef.current = applicationId
    formDirtyRef.current = false
  }, [application?._id, application?.updatedAt])

  function editForm(update: (current: HostApplicationForm) => HostApplicationForm) {
    formDirtyRef.current = true
    setForm(update)
  }

  if (application === undefined) return <HostState title="Loading your Friend Host profile" />

  const savedCoordinates = hasSavedNearbyCoordinates(application)
  const status = application ? hostApplicationStatusCopy[application.status as HostApplicationStatus] : null
  const verificationUrl = buildMobileWebHandoffUrl(resolveMobileWebAppConfiguration())

  async function run(action: 'application' | 'rate' | 'nearby' | 'verification', nextNearby?: boolean) {
    if (busyRef.current) return
    if (action === 'application') {
      const validated = validateHostApplication(form)
      if (!validated.ok) {
        setMessage(validated.message)
        return
      }
      busyRef.current = true
      setBusy(action)
      setMessage('')
      try {
        await submitApplication({
          ...validated.value,
          approximateArea: application?.approximateArea,
          approximateLatitude: application?.approximateLatitude,
          approximateLongitude: application?.approximateLongitude,
          nearbyDiscoveryEnabled: Boolean(
            validated.value.mode !== 'online'
            && savedCoordinates
            && application?.nearbyDiscoveryEnabled,
          ),
        })
        formDirtyRef.current = false
        setMessage('Friend Host profile sent for review.')
      } catch {
        setMessage('Your Friend Host profile could not be saved. Review the details and try again.')
      } finally {
        busyRef.current = false
        setBusy(null)
      }
      return
    }

    if (action === 'rate') {
      const validated = validateHourlyRate(quickRate)
      if (!validated.ok) {
        setMessage(validated.message)
        return
      }
      busyRef.current = true
      setBusy(action)
      setMessage('')
      try {
        await updateHourlyRate({ hourlyRateCentavos: validated.hourlyRateCentavos })
        setMessage('Hourly rate updated.')
      } catch {
        setMessage('The hourly rate could not be updated. Please try again.')
      } finally {
        busyRef.current = false
        setBusy(null)
      }
      return
    }

    if (action === 'nearby') {
      if (!application || nextNearby === undefined || (nextNearby && !savedCoordinates)) return
      busyRef.current = true
      setBusy(action)
      setMessage('')
      try {
        await setNearbyVisibility({ enabled: nextNearby })
        setMessage(nextNearby ? 'Nearby discovery is on.' : 'Nearby discovery is off.')
      } catch {
        setMessage('Nearby discovery could not be changed. Please try again.')
      } finally {
        busyRef.current = false
        setBusy(null)
      }
      return
    }

    if (!verificationUrl) {
      setMessage('Identity verification on the web is unavailable in this build.')
      return
    }
    busyRef.current = true
    setBusy(action)
    setMessage('')
    try {
      await Linking.openURL(verificationUrl)
    } catch {
      setMessage('Identity verification on the web could not be opened. Please try again.')
    } finally {
      busyRef.current = false
      setBusy(null)
    }
  }

  return (
    <Screen contentStyle={styles.content}>
      <View style={styles.header}>
        <AppText variant="label" color={theme.colors.self}>FRIEND HOST</AppText>
        <AppText variant="display">Host with clarity.</AppText>
        <AppText color={theme.colors.textMuted}>Create or update your Friend Host profile, then manage incoming bookings.</AppText>
      </View>

      <View style={[styles.statusCard, { backgroundColor: theme.colors.selfSoft, borderColor: theme.colors.self }]}>
        <AppText variant="heading">{status?.label ?? 'Not started'}</AppText>
        <AppText variant="caption" color={theme.colors.textMuted}>{status?.detail ?? 'Create a profile to apply as a Friend Host.'}</AppText>
        {application && !application.identityEligible ? (
          <>
            <AppText variant="caption" color={theme.colors.textMuted}>Identity approval is separate and must be current before the profile can be live or a booking can be accepted.</AppText>
            <ActionButton label={busy === 'verification' ? 'Opening verification' : 'Continue identity verification on web'} onPress={() => void run('verification')} intent="self" secondary disabled={busy !== null} />
          </>
        ) : null}
      </View>

      <ActionButton label="View incoming bookings" onPress={() => router.push('/host-bookings')} intent="social" />

      {application ? (
        <Section>
          <AppText variant="heading">Live profile controls</AppText>
          <View style={styles.fieldGroup}>
            <FieldLabel label="Listed hourly rate" />
            <TextInput
              accessibilityLabel="Listed hourly rate in Philippine pesos"
              keyboardType="decimal-pad"
              value={quickRate}
              onChangeText={setQuickRate}
              editable={busy === null}
              style={[styles.input, theme.typography.body, { color: theme.colors.text, borderColor: theme.colors.border, backgroundColor: theme.colors.background }]}
            />
            <ActionButton label={busy === 'rate' ? 'Updating rate' : 'Update hourly rate'} onPress={() => void run('rate')} intent="self" secondary disabled={busy !== null} />
          </View>
          <View style={[styles.nearby, { borderColor: theme.colors.border }]}>
            <View style={styles.nearbyCopy}>
              <AppText variant="bodyStrong">Nearby discovery</AppText>
              <AppText variant="caption" color={theme.colors.textMuted}>
                {savedCoordinates
                  ? 'Uses only the approximate coordinates already saved to this Friend Host profile.'
                  : 'Cannot be enabled because this profile has no saved coordinates. The mobile app does not collect GPS.'}
              </AppText>
            </View>
            <Switch
              accessibilityLabel="Nearby discovery visibility"
              value={application.nearbyDiscoveryEnabled === true}
              disabled={busy !== null || !savedCoordinates}
              onValueChange={(enabled) => void run('nearby', enabled)}
              trackColor={{ false: theme.colors.borderStrong, true: theme.colors.self }}
              thumbColor={theme.colors.background}
            />
          </View>
        </Section>
      ) : null}

      <Section>
        <AppText variant="heading">{application ? 'Edit application' : 'Friend Host application'}</AppText>
        <AppText variant="caption" color={theme.colors.textMuted}>Saving this form sends the profile for review. The mobile app never requests GPS.</AppText>
        <ModePicker value={form.mode} onChange={(mode) => editForm((current) => ({ ...current, mode }))} disabled={busy !== null} />
        <FormField label="How would you spend the time?" value={form.intro} onChange={(intro) => editForm((current) => ({ ...current, intro }))} theme={theme} multiline maxLength={500} hint={`${form.intro.length}/500 characters, minimum 40`} />
        <FormField label={form.mode === 'online' ? 'Timezone or broad region, optional' : 'City'} value={form.city} onChange={(city) => editForm((current) => ({ ...current, city }))} theme={theme} />
        <FormField label="Listed hourly rate in PHP" value={form.hourlyRatePesos} onChange={(hourlyRatePesos) => editForm((current) => ({ ...current, hourlyRatePesos }))} theme={theme} keyboardType="decimal-pad" />
        <SelectionGroup label="Strengths" options={friendStrengths} selected={form.strengths} onChange={(strengths) => editForm((current) => ({ ...current, strengths }))} disabled={busy !== null} />
        <SelectionGroup label="Activities" options={activityCategories} selected={form.categories} onChange={(categories) => editForm((current) => ({ ...current, categories }))} disabled={busy !== null} />
        <FormField label="Boundaries, one per line" value={form.boundaries} onChange={(boundaries) => editForm((current) => ({ ...current, boundaries }))} theme={theme} multiline />
        <FormField label="Note for the reviewer, optional" value={form.applicationNote} onChange={(applicationNote) => editForm((current) => ({ ...current, applicationNote }))} theme={theme} multiline />
        <ActionButton label={busy === 'application' ? 'Sending for review' : application ? 'Save and send for review' : 'Submit Friend Host application'} onPress={() => void run('application')} intent="self" disabled={busy !== null} />
      </Section>

      {message ? <AppText accessibilityLiveRegion="polite" color={theme.colors.textMuted}>{message}</AppText> : null}
      <ActionButton label="Return to Profile" onPress={() => router.replace('/profile')} intent="self" secondary />
    </Screen>
  )
}

function ModePicker({ value, onChange, disabled }: { value: HostMode; onChange: (mode: HostMode) => void; disabled: boolean }) {
  return <SelectionGroup label="Session format" options={['both', 'online', 'in_person'] as const} selected={[value]} onChange={(values) => onChange(values[0] as HostMode)} disabled={disabled} labels={{ both: 'Online and in-person', online: 'Online only', in_person: 'In-person only' }} single />
}

function SelectionGroup({ label, options, selected, onChange, disabled, labels, single = false }: {
  label: string
  options: readonly string[]
  selected: string[]
  onChange: (values: string[]) => void
  disabled: boolean
  labels?: Record<string, string>
  single?: boolean
}) {
  const theme = useAppTheme()
  return (
    <View style={styles.fieldGroup} accessibilityRole="radiogroup">
      <FieldLabel label={label} />
      <View style={styles.chips}>
        {options.map((option) => {
          const active = selected.includes(option)
          return (
            <Pressable
              key={option}
              accessibilityRole={single ? 'radio' : 'checkbox'}
              accessibilityLabel={labels?.[option] ?? option}
              accessibilityState={{ checked: active, disabled }}
              disabled={disabled}
              onPress={() => onChange(single ? [option] : active ? selected.filter((item) => item !== option) : [...selected, option])}
              style={({ pressed }) => [styles.chip, { borderColor: active ? theme.colors.self : theme.colors.border, backgroundColor: active ? theme.colors.selfSoft : theme.colors.background }, pressed && styles.pressed]}>
              <AppText variant="caption" color={active ? theme.colors.self : theme.colors.text}>{labels?.[option] ?? option}</AppText>
            </Pressable>
          )
        })}
      </View>
    </View>
  )
}

function FormField({ label, value, onChange, theme, multiline = false, maxLength, hint, keyboardType }: {
  label: string
  value: string
  onChange: (value: string) => void
  theme: ReturnType<typeof useAppTheme>
  multiline?: boolean
  maxLength?: number
  hint?: string
  keyboardType?: 'default' | 'decimal-pad'
}) {
  return (
    <View style={styles.fieldGroup}>
      <FieldLabel label={label} />
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChange}
        multiline={multiline}
        maxLength={maxLength}
        keyboardType={keyboardType}
        textAlignVertical={multiline ? 'top' : 'center'}
        style={[styles.input, multiline && styles.multiline, theme.typography.body, { color: theme.colors.text, borderColor: theme.colors.border, backgroundColor: theme.colors.background }]}
      />
      {hint ? <AppText variant="caption" color={theme.colors.textMuted}>{hint}</AppText> : null}
    </View>
  )
}

function FieldLabel({ label }: { label: string }) {
  return <AppText variant="bodyStrong">{label}</AppText>
}

function HostState({ title, detail, action, onPress }: { title: string; detail?: string; action?: string; onPress?: () => void }) {
  const theme = useAppTheme()
  return <Screen contentStyle={styles.state}><AppText variant="label" color={theme.colors.self}>FRIEND HOST</AppText><AppText variant="title">{title}</AppText>{detail ? <AppText color={theme.colors.textMuted}>{detail}</AppText> : null}{action && onPress ? <ActionButton label={action} onPress={onPress} intent="self" secondary /> : null}</Screen>
}

export function ErrorBoundary({ retry }: ErrorBoundaryProps) {
  return <HostState title="Friend Host tools are temporarily unavailable" detail="Please try again. No profile action was taken." action="Try again" onPress={retry} />
}

const styles = StyleSheet.create({
  content: { paddingTop: 24, paddingBottom: 64, gap: 20 },
  state: { flexGrow: 1, justifyContent: 'center', gap: 16 },
  header: { gap: 10 },
  statusCard: { borderWidth: 1, borderRadius: 20, padding: 16, gap: 10 },
  fieldGroup: { gap: 8, marginTop: 14 },
  input: { minHeight: 52, borderWidth: 1, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 12 },
  multiline: { minHeight: 110 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { minHeight: 42, borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' },
  nearby: { borderWidth: 1, borderRadius: 18, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 16 },
  nearbyCopy: { flex: 1, gap: 4 },
  pressed: { opacity: 0.72 },
})
