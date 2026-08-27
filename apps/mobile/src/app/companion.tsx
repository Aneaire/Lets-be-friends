import {
  activityCategoryOptions,
  friendStrengths,
  maximumActivityCategoryLength,
  maximumCompanionActivityCategories,
  validateActivityCategories,
  type CompanionApplicationStatus,
} from '@lets-be-friends/shared'
import type { FunctionReturnType } from 'convex/server'
import { useMutation, useQuery } from 'convex/react'
import * as Linking from 'expo-linking'
import { router, type ErrorBoundaryProps } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import { Pressable, StyleSheet, TextInput, View } from 'react-native'

import { buildMobileWebHandoffUrl, resolveMobileWebAppConfiguration } from '@/backend/config'
import { mobileApi } from '@/backend/client'
import { ActionButton } from '@/design-system/atoms/ActionButton'
import { useAppToastMessage } from '@/design-system/molecules/AppToast'
import { Screen, Section } from '@/design-system/templates/Screen'
import { AppText } from '@/design-system/atoms/Typography'
import {
  companionApplicationStatusCopy,
  initialCompanionApplicationForm,
  type CompanionApplicationForm,
  type CompanionMode,
  validateCompanionApplication,
  validateHourlyRate,
} from '@/data/companionTools'
import { useMobileMember } from '@/member/MobileMember'
import { useAppTheme } from '@/theme/ThemeProvider'

type CompanionApplication = NonNullable<FunctionReturnType<typeof mobileApi.companions.myApplication>>

export default function CompanionScreen() {
  const member = useMobileMember()
  if (member.status === 'signed_out') return <CompanionState title="Sign in to manage Companion tools" action="Sign in" onPress={() => router.replace('/auth')} />
  if (member.status === 'unconfigured') return <CompanionState title="Companion tools need account services" action="Return to Profile" onPress={() => router.replace('/profile')} />
  if (member.status === 'unavailable' || member.status === 'error') return <CompanionState title="Companion tools are unavailable" detail="Your member account could not be connected safely." />
  if (member.status !== 'ready') return <CompanionState title="Loading Companion tools" />
  return <ReadyCompanionScreen />
}

function ReadyCompanionScreen() {
  const theme = useAppTheme()
  const application = useQuery(mobileApi.companions.myApplication, {})
  const submitApplication = useMutation(mobileApi.companions.submitApplication)
  const updateHourlyRate = useMutation(mobileApi.companions.updateHourlyRate)
  const [form, setForm] = useState<CompanionApplicationForm>(() => initialCompanionApplicationForm())
  const [quickRate, setQuickRate] = useState('500')
  const [busy, setBusy] = useState<'application' | 'rate' | 'verification' | null>(null)
  const [message, setMessage] = useState('')
  useAppToastMessage(message)
  const [setupStep, setSetupStep] = useState(0)
  const busyRef = useRef(false)
  const formDirtyRef = useRef(false)
  const hydratedApplicationIdRef = useRef<string | null>(null)

  useEffect(() => {
    if (!application) return
    const applicationId = String(application._id)
    if (formDirtyRef.current && hydratedApplicationIdRef.current === applicationId) return
    setForm(initialCompanionApplicationForm(application))
    setQuickRate(String((application.hourlyRateCentavos ?? 50_000) / 100))
    hydratedApplicationIdRef.current = applicationId
    formDirtyRef.current = false
  }, [application?._id, application?.updatedAt])

  function editForm(update: (current: CompanionApplicationForm) => CompanionApplicationForm) {
    formDirtyRef.current = true
    setForm(update)
  }

  if (application === undefined) return <CompanionState title="Loading your Companion profile" />

  const status = application ? companionApplicationStatusCopy[application.status as CompanionApplicationStatus] : null
  const verificationUrl = buildMobileWebHandoffUrl(resolveMobileWebAppConfiguration(), { intent: 'companion_application', mobileReturn: 'companion' })

  async function run(action: 'application' | 'rate' | 'verification') {
    if (busyRef.current) return
    if (action === 'application') {
      const validated = validateCompanionApplication(form)
      if (!validated.ok) {
        setMessage(validated.message)
        return
      }
      busyRef.current = true
      setBusy(action)
      setMessage('')
      try {
        await submitApplication(validated.value)
        formDirtyRef.current = false
        setMessage('Companion profile sent for review.')
      } catch {
        setMessage('Your Companion profile could not be saved. Review the details and try again.')
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
        <AppText variant="label" color={theme.colors.self}>COMPANION</AppText>
        <AppText variant="display">Share what you can offer.</AppText>
        <AppText color={theme.colors.textMuted}>Use everyday Strengths you already have, earn on your terms, and make meaningful connections.</AppText>
      </View>

      <View style={[styles.statusCard, { backgroundColor: theme.colors.selfSoft, borderColor: theme.colors.self }]}>
        <AppText variant="heading">{status?.label ?? 'Not started'}</AppText>
        <AppText variant="caption" color={theme.colors.textMuted}>{status?.detail ?? 'Create a profile to apply as a Companion.'}</AppText>
        {application && !application.identityEligible ? (
          <>
            <AppText variant="caption" color={theme.colors.textMuted}>Identity approval is separate and must be current before the profile can be live or a booking can be accepted.</AppText>
            <ActionButton label={busy === 'verification' ? 'Opening verification' : 'Continue identity verification on web'} onPress={() => void run('verification')} intent="self" secondary disabled={busy !== null} />
          </>
        ) : null}
      </View>

      {application?.status === 'approved' ? <ActionButton label="View incoming bookings" onPress={() => router.push('/companion-bookings')} intent="social" icon="calendar-outline" /> : null}

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
                Approved Companions are always included using the rounded approximate location saved during onboarding, including online-only profiles.
              </AppText>
            </View>
          </View>
        </Section>
      ) : null}

      <Section>
        <View style={styles.stepHeading}><View><AppText variant="heading">{application ? 'Edit Companion profile' : 'Create your Companion profile'}</AppText><AppText variant="caption" color={theme.colors.textMuted}>Step {setupStep + 1} of 4</AppText></View></View>
        <View accessibilityLabel={`Companion setup step ${setupStep + 1} of 4`} style={[styles.progressTrack, { backgroundColor: theme.colors.border }]}><View style={[styles.progressValue, { width: `${(setupStep + 1) * 25}%`, backgroundColor: theme.colors.self }]} /></View>
        {setupStep === 0 ? <>
          <AppText variant="caption" color={theme.colors.textMuted}>Describe the everyday help, activity, or company members can expect.</AppText>
          <ModePicker value={form.mode} onChange={(mode) => editForm((current) => ({ ...current, mode }))} disabled={busy !== null} />
          <FormField label="How can you help or spend the time?" value={form.intro} onChange={(intro) => editForm((current) => ({ ...current, intro }))} theme={theme} multiline maxLength={500} hint={`${form.intro.length}/500 characters, minimum 40`} />
          <FormField label={form.mode === 'online' ? 'Timezone or broad region, optional' : 'City'} value={form.city} onChange={(city) => editForm((current) => ({ ...current, city }))} theme={theme} />
        </> : null}
        {setupStep === 1 ? <>
          <AppText variant="caption" color={theme.colors.textMuted}>Choose the everyday Strengths and activities you feel comfortable offering.</AppText>
          <SelectionGroup label="Strengths" options={friendStrengths} selected={form.strengths} onChange={(strengths) => editForm((current) => ({ ...current, strengths }))} disabled={busy !== null} />
          <SelectionGroup label="Activities" options={activityCategoryOptions(form.categories)} selected={form.categories} onChange={(categories) => editForm((current) => ({ ...current, categories }))} disabled={busy !== null} maximum={maximumCompanionActivityCategories} />
          <CustomCategoryInput
            selected={form.categories}
            onChange={(categories) => editForm((current) => ({ ...current, categories }))}
            disabled={busy !== null}
          />
        </> : null}
        {setupStep === 2 ? <>
          <AppText variant="caption" color={theme.colors.textMuted}>Clear boundaries help both people plan a comfortable experience.</AppText>
          <FormField label="Boundaries, one per line" value={form.boundaries} onChange={(boundaries) => editForm((current) => ({ ...current, boundaries }))} theme={theme} multiline />
          <FormField label="Note for the reviewer, optional" value={form.applicationNote} onChange={(applicationNote) => editForm((current) => ({ ...current, applicationNote }))} theme={theme} multiline />
        </> : null}
        {setupStep === 3 ? <>
          <AppText variant="caption" color={theme.colors.textMuted}>Set your rate, then review your details before sending them.</AppText>
          <FormField label="Listed hourly rate in PHP" value={form.hourlyRatePesos} onChange={(hourlyRatePesos) => editForm((current) => ({ ...current, hourlyRatePesos }))} theme={theme} keyboardType="decimal-pad" />
          <View style={[styles.reviewCard, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}><AppText variant="bodyStrong">Profile summary</AppText><AppText>{form.mode === 'both' ? 'Online and in-person sessions' : form.mode === 'online' ? 'Online sessions' : 'In-person sessions'}</AppText><AppText variant="caption" color={theme.colors.textMuted}>{form.strengths.length} Strengths · {form.categories.length} activities · {form.boundaries.split('\n').filter(Boolean).length} boundaries</AppText></View>
        </> : null}
        <View style={styles.stepActions}>
          {setupStep === 3
            ? <ActionButton label={busy === 'application' ? 'Sending for review' : application ? 'Save and send for review' : 'Send profile for review'} onPress={() => void run('application')} intent="self" disabled={busy !== null} icon="send-outline" />
            : <ActionButton label="Continue" onPress={() => setSetupStep((current) => Math.min(3, current + 1))} intent="self" icon="arrow-forward" disabled={busy !== null || (setupStep === 0 && (form.intro.trim().length < 40 || (form.mode !== 'online' && !form.city.trim()))) || (setupStep === 1 && (!form.strengths.length || !form.categories.length))} />}
          {setupStep > 0 ? <ActionButton label="Back" onPress={() => setSetupStep((current) => Math.max(0, current - 1))} intent="self" secondary disabled={busy !== null} /> : null}
        </View>
      </Section>

      <ActionButton label="Return to Profile" onPress={() => router.replace('/profile')} intent="self" secondary />
    </Screen>
  )
}

function ModePicker({ value, onChange, disabled }: { value: CompanionMode; onChange: (mode: CompanionMode) => void; disabled: boolean }) {
  return <SelectionGroup label="Session format" options={['both', 'online', 'in_person'] as const} selected={[value]} onChange={(values) => onChange(values[0] as CompanionMode)} disabled={disabled} labels={{ both: 'Online and in-person', online: 'Online only', in_person: 'In-person only' }} single />
}

function SelectionGroup({ label, options, selected, onChange, disabled, labels, single = false, maximum }: {
  label: string
  options: readonly string[]
  selected: string[]
  onChange: (values: string[]) => void
  disabled: boolean
  labels?: Record<string, string>
  single?: boolean
  maximum?: number
}) {
  const theme = useAppTheme()
  return (
    <View style={styles.fieldGroup} accessibilityRole="radiogroup">
      <FieldLabel label={label} />
      <View style={styles.chips}>
        {options.map((option) => {
          const active = selected.includes(option)
          const optionDisabled = disabled || (!active && maximum !== undefined && selected.length >= maximum)
          return (
            <Pressable
              key={option}
              accessibilityRole={single ? 'radio' : 'checkbox'}
              accessibilityLabel={labels?.[option] ?? option}
              accessibilityState={{ checked: active, disabled: optionDisabled }}
              disabled={optionDisabled}
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

function CustomCategoryInput({ selected, onChange, disabled }: {
  selected: string[]
  onChange: (categories: string[]) => void
  disabled: boolean
}) {
  const theme = useAppTheme()
  const [value, setValue] = useState('')
  const [error, setError] = useState('')

  function addCategory() {
    const result = validateActivityCategories([...selected, value], maximumCompanionActivityCategories)
    if (!result.ok) {
      setError(result.message)
      return
    }
    onChange(result.value)
    setValue('')
    setError('')
  }

  const atLimit = selected.length >= maximumCompanionActivityCategories
  return (
    <View style={styles.fieldGroup}>
      <FieldLabel label="Add your own category" />
      <TextInput
        accessibilityLabel="Custom activity category"
        value={value}
        maxLength={maximumActivityCategoryLength}
        editable={!disabled && !atLimit}
        returnKeyType="done"
        onChangeText={(next) => { setValue(next); setError('') }}
        onSubmitEditing={addCategory}
        placeholder="For example, museum visits"
        placeholderTextColor={theme.colors.textMuted}
        style={[styles.input, theme.typography.body, { color: theme.colors.text, borderColor: theme.colors.border, backgroundColor: theme.colors.background }]}
      />
      <ActionButton label="Add category" onPress={addCategory} intent="self" secondary disabled={disabled || atLimit} />
      {error ? <AppText accessibilityRole="alert" variant="caption" color={theme.colors.danger}>{error}</AppText> : null}
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

function CompanionState({ title, detail, action, onPress }: { title: string; detail?: string; action?: string; onPress?: () => void }) {
  const theme = useAppTheme()
  return <Screen contentStyle={styles.state}><AppText variant="label" color={theme.colors.self}>COMPANION</AppText><AppText variant="title">{title}</AppText>{detail ? <AppText color={theme.colors.textMuted}>{detail}</AppText> : null}{action && onPress ? <ActionButton label={action} onPress={onPress} intent="self" secondary /> : null}</Screen>
}

export function ErrorBoundary({ retry }: ErrorBoundaryProps) {
  return <CompanionState title="Companion tools are temporarily unavailable" detail="Please try again. No profile action was taken." action="Try again" onPress={retry} />
}

const styles = StyleSheet.create({
  content: { paddingTop: 16, paddingBottom: 40, gap: 16 },
  state: { flexGrow: 1, justifyContent: 'center', gap: 16 },
  header: { gap: 10 },
  statusCard: { borderWidth: 1, borderRadius: 16, padding: 14, gap: 10 },
  fieldGroup: { gap: 8, marginTop: 14 },
  input: { minHeight: 48, borderWidth: 1, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 12 },
  multiline: { minHeight: 110 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { minHeight: 44, borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' },
  nearby: { borderWidth: 1, borderRadius: 16, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 16 },
  nearbyCopy: { flex: 1, gap: 4 },
  stepHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  progressTrack: { height: 4, borderRadius: 2, overflow: 'hidden', marginTop: 10 },
  progressValue: { height: '100%', borderRadius: 2 },
  reviewCard: { borderWidth: 1, borderRadius: 16, padding: 14, gap: 6, marginVertical: 14 },
  stepActions: { marginTop: 22, gap: 12 },
  pressed: { opacity: 0.72 },
})
