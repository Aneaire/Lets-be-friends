import {
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
import { PageSkeleton } from '@/design-system/templates/PageSkeleton'
import { AppText } from '@/design-system/atoms/Typography'
import {
  COMPANION_BIO_PLACEHOLDER,
  companionApplicationStatusCopy,
  initialCompanionApplicationForm,
  type CompanionApplicationForm,
  type CompanionMode,
  validateCompanionApplication,
  validateHourlyRate,
} from '@/data/companionTools'
import { canOpenCompanionProfile, identityActionLabel, mobileIdentityPresentation } from '@/features/verification/identityPresentation'
import { CompanionDraftController, hydrateCompanionForm } from '@/features/companion/companionDraft'
import { getCompanionDraftStorage } from '@/features/companion/companionDraftStorage'
import { companionIsPublic, companionModeLabel } from '@/member/profileSections'
import { WeeklyAvailabilityEditor } from '@/features/companion/WeeklyAvailabilityEditor'
import { ActivityCategoryBrowser } from '@/features/companion/ActivityCategoryBrowser'
import { useMobileMember } from '@/member/MobileMember'
import { useAppTheme } from '@/theme/ThemeProvider'

type CompanionApplication = NonNullable<FunctionReturnType<typeof mobileApi.companions.myApplication>>

export default function CompanionScreen() {
  const member = useMobileMember()
  if (member.status === 'signed_out') return <CompanionState title="Sign in to manage Companion tools" action="Sign in" onPress={() => router.replace('/auth')} />
  if (member.status === 'unconfigured') return <CompanionState title="Companion tools need account services" action="Return to Profile" onPress={() => router.replace('/profile')} />
  if (member.status === 'unavailable' || member.status === 'error') return <CompanionState title="Companion tools are unavailable" detail="Your member account could not be connected safely." />
  if (member.status !== 'ready') return <PageSkeleton variant="companionTools" />
  return <ReadyCompanionScreen key={String(member.viewer._id)} member={member} />
}

function ReadyCompanionScreen({ member }: { member: Extract<ReturnType<typeof useMobileMember>, { status: 'ready' }> }) {
  const theme = useAppTheme()
  const application = useQuery(mobileApi.companions.myApplication, {})
  const submitApplication = useMutation(mobileApi.companions.submitApplication)
  const updateHourlyRate = useMutation(mobileApi.companions.updateHourlyRate)
  const [form, setForm] = useState<CompanionApplicationForm>(() => initialCompanionApplicationForm())
  const [quickRate, setQuickRate] = useState('500')
  const [busy, setBusy] = useState<'application' | 'rate' | 'verification' | null>(null)
  const [message, setMessage] = useState('')
  useAppToastMessage(message)
  const [saved, setSaved] = useState(false)
  const [availabilityVisible, setAvailabilityVisible] = useState(false)
  const [draftReady, setDraftReady] = useState(false)
  const draftController = useRef(new CompanionDraftController(getCompanionDraftStorage())).current
  const [setupStep, setSetupStep] = useState(0)
  const busyRef = useRef(false)
  const formDirtyRef = useRef(false)

  useEffect(() => {
    if (application === undefined) return
    let active = true
    void draftController.switchAccount(String(member.viewer._id), (draft) => {
      if (!active) return
      setForm(hydrateCompanionForm(application, draft))
      setQuickRate(String((application?.hourlyRateCentavos ?? 50_000) / 100))
      setDraftReady(true)
    })
    return () => { active = false; void draftController.switchAccount(null, () => {}) }
  }, [member.viewer._id, application === undefined])

  useEffect(() => {
    if (draftReady && formDirtyRef.current) void draftController.save(form)
  }, [form, draftReady, draftController])

  function editForm(update: (current: CompanionApplicationForm) => CompanionApplicationForm) {
    formDirtyRef.current = true
    setSaved(false)
    setForm(update)
  }

  if (application === undefined || !draftReady) return <PageSkeleton variant="companionTools" />

  const identity = mobileIdentityPresentation(member.viewer.verificationStatus, member.verification, member.viewer.identityEligible)
  const unlocked = canOpenCompanionProfile(member.viewer.identityEligible, member.verification)
  const status = application ? companionApplicationStatusCopy[application.status as CompanionApplicationStatus] : null
  const verificationUrl = buildMobileWebHandoffUrl(resolveMobileWebAppConfiguration(), { intent: 'companion_application', mobileReturn: 'companion' })

  async function run(action: 'application' | 'rate' | 'verification') {
    if (busyRef.current) return
    if ((action === 'application' || action === 'rate') && !unlocked) return
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
        await draftController.clear(String(member.viewer._id))
        setSaved(true)
        setMessage(member.viewer.identityEligible ? 'Companion profile saved. Your changes are live.' : 'Companion profile saved. It stays hidden from discovery until identity approval.')
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
        <AppText variant="caption" color={theme.colors.textMuted}>{identity.guidance}</AppText>
        {identity.action !== 'none' ? <ActionButton label={busy === 'verification' ? 'Opening verification' : identityActionLabel(identity.action)} onPress={() => void run('verification')} intent="self" secondary disabled={busy !== null} /> : null}
        <ActionButton label="View verification status" onPress={() => router.push('/get-verified')} intent="self" secondary />

      </View>

      {application?.status === 'approved' ? <ActionButton label="View incoming bookings" onPress={() => router.push('/companion-bookings')} intent="social" icon="calendar-outline" /> : null}

      {application && unlocked && !saved ? (
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
                Approved Companion profiles can appear in nearby discovery.
              </AppText>
            </View>
          </View>
          <WeeklyAvailabilityEditor initialWindows={(application as { weeklyAvailability?: Array<{ weekday: number; startMinutes: number; endMinutes: number }> }).weeklyAvailability} />
        </Section>
      ) : null}

      {!unlocked ? <Section>
        <AppText variant="label" color={theme.colors.selfText}>Identity check required</AppText>
        <AppText variant="heading">Complete your identity check first</AppText>
        <AppText>Submit your government ID and current selfie for safety review before creating a Companion profile. Your profile stays hidden from discovery until identity approval.</AppText>
        <AppText color={theme.colors.textMuted}>{identity.guidance}</AppText>
        <ActionButton label={identityActionLabel(identity.action)} intent="self" disabled={busy !== null} onPress={() => identity.action === 'none' ? router.push('/get-verified') : void run('verification')} />
        <ActionButton label="Back" intent="self" secondary onPress={() => router.replace('/profile')} />
      </Section> : saved ? <Section>
        <AppText variant="heading">Your Companion profile is saved</AppText>
        <AppText>{member.viewer.identityEligible ? 'Your profile is live while identity approval is current.' : 'Your profile stays hidden from discovery until identity approval.'}</AppText>
        <AppText variant="bodyStrong">{member.verification?.adminStatus === 'pending' || member.verification?.personaDecision === 'declined' ? 'Next: safety review' : 'Next: identity verification'}</AppText>
        <AppText color={theme.colors.textMuted}>{identity.guidance}</AppText>
        {!member.viewer.identityEligible ? <ActionButton label="View verification status" intent="self" onPress={() => router.push('/get-verified')} /> : null}
        <ActionButton label="Set your availability" intent="self" onPress={() => setAvailabilityVisible(true)} />
        <ActionButton label="Edit Companion profile" intent="self" secondary onPress={() => setSaved(false)} />
        <ActionButton label="Return to Profile" intent="self" secondary onPress={() => router.replace('/profile')} />
      </Section> : <Section>
        <View style={styles.stepHeading}><View><AppText variant="heading">{application ? 'Edit Companion profile' : 'Create your Companion profile'}</AppText><AppText variant="caption" color={theme.colors.textMuted}>Step {setupStep + 1} of 4</AppText></View></View>
        <View accessibilityLabel={`Companion setup step ${setupStep + 1} of 4`} style={[styles.progressTrack, { backgroundColor: theme.colors.border }]}><View style={[styles.progressValue, { width: `${(setupStep + 1) * 25}%`, backgroundColor: theme.colors.self }]} /></View>
        {setupStep === 0 ? <>
          <AppText variant="caption" color={theme.colors.textMuted}>Describe the everyday help, activity, or company members can expect.</AppText>
          <ModePicker value={form.mode} onChange={(mode) => editForm((current) => ({ ...current, mode }))} disabled={busy !== null} />
          <FormField label="How can you help or spend the time?" value={form.intro} onChange={(intro) => editForm((current) => ({ ...current, intro }))} theme={theme} disabled={busy !== null} multiline maxLength={500} hint={`${form.intro.length}/500 characters, minimum 40`} />
          <FormField label="Tell me about yourself" value={form.bio} onChange={(bio) => editForm((current) => ({ ...current, bio }))} theme={theme} disabled={busy !== null} multiline maxLength={500} placeholder={COMPANION_BIO_PLACEHOLDER} hint="Required. Your member profile bio, shown on your public profile." />
          <FormField label={form.mode === 'online' ? 'Timezone or broad region, optional' : 'City'} value={form.city} onChange={(city) => editForm((current) => ({ ...current, city }))} theme={theme} disabled={busy !== null} />
        </> : null}
        {setupStep === 1 ? <>
          <AppText variant="caption" color={theme.colors.textMuted}>Choose the everyday Strengths and activities you feel comfortable offering.</AppText>
          <SelectionGroup label="Strengths" options={friendStrengths} selected={form.strengths} onChange={(strengths) => editForm((current) => ({ ...current, strengths }))} disabled={busy !== null} />
          <ActivityCategoryBrowser
            selected={form.categories}
            onChange={(categories) => editForm((current) => ({ ...current, categories }))}
            maximum={maximumCompanionActivityCategories}
            disabled={busy !== null}
          />
          <CustomCategoryInput
            selected={form.categories}
            onChange={(categories) => editForm((current) => ({ ...current, categories }))}
            disabled={busy !== null}
          />
        </> : null}
        {setupStep === 2 ? <>
          <AppText variant="caption" color={theme.colors.textMuted}>Clear boundaries help both people plan a comfortable experience.</AppText>
          <FormField label="Boundaries, one per line" value={form.boundaries} onChange={(boundaries) => editForm((current) => ({ ...current, boundaries }))} theme={theme} disabled={busy !== null} multiline />
          <FormField label="Additional note, optional" value={form.applicationNote} onChange={(applicationNote) => editForm((current) => ({ ...current, applicationNote }))} theme={theme} disabled={busy !== null} multiline />
        </> : null}
        {setupStep === 3 ? <>
          <AppText variant="caption" color={theme.colors.textMuted}>Set your rate, then review your details before sending them.</AppText>
          <FormField label="Listed hourly rate in PHP" value={form.hourlyRatePesos} onChange={(hourlyRatePesos) => editForm((current) => ({ ...current, hourlyRatePesos }))} theme={theme} disabled={busy !== null} keyboardType="decimal-pad" />
          <View style={[styles.reviewCard, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}><AppText variant="bodyStrong">Profile summary</AppText><AppText>{form.mode === 'both' ? 'Online and in-person sessions' : form.mode === 'online' ? 'Online sessions' : 'In-person sessions'}</AppText><AppText variant="caption" color={theme.colors.textMuted}>{form.strengths.length} Strengths · {form.categories.length} activities · {form.boundaries.split('\n').filter(Boolean).length} boundaries</AppText></View>
        </> : null}
        <View style={styles.stepActions}>
          {setupStep === 3
            ? <ActionButton label={busy === 'application' ? 'Saving profile' : application ? 'Save changes' : 'Save profile'} onPress={() => void run('application')} intent="self" disabled={busy !== null} icon="send-outline" />
            : <ActionButton label="Continue" onPress={() => setSetupStep((current) => Math.min(3, current + 1))} intent="self" icon="arrow-forward" disabled={busy !== null || (setupStep === 0 && (form.intro.trim().length < 40 || (form.mode !== 'online' && !form.city.trim()))) || (setupStep === 1 && (!form.strengths.length || !form.categories.length))} />}
          {setupStep > 0 ? <ActionButton label="Back" onPress={() => setSetupStep((current) => Math.max(0, current - 1))} intent="self" secondary disabled={busy !== null} /> : null}
        </View>
      </Section>}

      {saved && availabilityVisible && application ? <Section><AppText variant="heading">Weekly availability</AppText><WeeklyAvailabilityEditor initialWindows={application.weeklyAvailability} /></Section> : null}

      {unlocked ? <Section>
        <AppText variant="heading">Member preview</AppText>
        <AppText variant="bodyStrong">{application?.displayName || member.viewer.displayName}</AppText>
        <AppText>{companionModeLabel(form.mode)}{form.city.trim() ? ` · ${form.city.trim()}` : ''}</AppText>
        <AppText>{form.intro.trim() || 'Describe the experience members can expect.'}</AppText>
        <AppText>{form.categories.slice(0, 4).join(' · ')}</AppText>
        <AppText>You receive {new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(Number(form.hourlyRatePesos) || 0)} per hour</AppText>
        {application && companionIsPublic(application.status, member.viewer.identityEligible) ? <ActionButton label="View live profile" intent="self" secondary onPress={() => router.push({ pathname: '/companion-profile/[id]', params: { id: String(application._id) } })} /> : null}
      </Section> : null}

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

function FormField({ label, value, onChange, theme, multiline = false, maxLength, hint, keyboardType, placeholder, disabled = false }: {
  label: string
  value: string
  onChange: (value: string) => void
  theme: ReturnType<typeof useAppTheme>
  multiline?: boolean
  maxLength?: number
  hint?: string
  keyboardType?: 'default' | 'decimal-pad'
  placeholder?: string
  disabled?: boolean
}) {
  return (
    <View style={styles.fieldGroup}>
      <FieldLabel label={label} />
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChange}
        editable={!disabled}
        multiline={multiline}
        maxLength={maxLength}
        keyboardType={keyboardType}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.textMuted}
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
