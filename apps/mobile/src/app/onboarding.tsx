import {
  activityCategoryOptions,
  friendStrengths,
  maximumActivityCategoryLength,
  maximumCompanionActivityCategories,
  maximumOnboardingActivityCategories,
  normalizeUsername,
  usernameBaseFromDisplayName,
  usernameValidationError,
  validateActivityCategories,
} from '@lets-be-friends/shared'
import { useMutation, useQuery } from 'convex/react'
import * as Location from 'expo-location'
import { router } from 'expo-router'
import { useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native'

import { useMobileAuth } from '@/auth/MobileAuth'
import { mobileApi } from '@/backend/client'
import { ActionButton } from '@/design-system/atoms/ActionButton'
import { AppIcon } from '@/design-system/atoms/AppIcon'
import { Chip } from '@/design-system/atoms/Chip'
import { Checkbox } from '@/design-system/atoms/Field'
import { useAppToastMessage } from '@/design-system/molecules/AppToast'
import { Screen } from '@/design-system/templates/Screen'
import { PageSkeleton } from '@/design-system/templates/PageSkeleton'
import { AppText } from '@/design-system/atoms/Typography'
import { useMobileMember } from '@/member/MobileMember'
import { onboardingDecision } from '@/member/onboarding'
import {
  COMPANION_BIO_PLACEHOLDER,
  validateCompanionApplication,
  type CompanionApplicationForm,
  type CompanionMode,
} from '@/data/companionTools'
import {
  clampOnboardingStep,
  defaultOnboardingCompanionForm,
  hasSubmittedCompanionApplication,
  mergeOnboardingCategoriesIntoForm,
  onboardingCompanionHeroCopy,
  onboardingCompanionHeroTitle,
  onboardingCompanionIdentityFollowupCopy,
  onboardingCompanionReviewNotice,
  onboardingCompanionSkipCopy,
  onboardingCompanionStatusPresentation,
  onboardingMaxStep,
  onboardingTotalSteps,
} from '@/features/companion/onboardingCompanionApplication'
import { useAppTheme } from '@/theme/ThemeProvider'

type OnboardingGoal = 'member' | 'companion'
type ApproximateLocation = { latitude: number; longitude: number }

const termsVersion = '2026-08-13'

export default function OnboardingScreen() {
  const auth = useMobileAuth()
  const member = useMobileMember()

  if (auth.status === 'signed_out') {
    return (
      <OnboardingState
        title="Sign in to continue"
        detail="Your welcome guide is connected to your member account."
        actionLabel="Sign in"
        onAction={() => router.replace('/auth')}
      />
    )
  }
  if (auth.status === 'unconfigured') {
    return <OnboardingState title="Account services unavailable" detail="This build cannot connect to member onboarding." />
  }
  if (auth.status === 'setup_error') return <OnboardingState title="Account services unavailable" detail="Live member onboarding is unavailable in this build." />
  if (auth.status === 'loading' || member.status === 'loading' || member.status === 'syncing') {
    return <PageSkeleton variant="onboarding" />
  }
  if (member.status === 'unavailable' || member.status === 'error') {
    return <OnboardingState title="Member setup is unavailable" detail={member.message} />
  }
  if (member.status !== 'ready') {
    return <OnboardingState title="Sign in to continue" detail="Your member account is not available yet." />
  }

  return <ConnectedOnboarding viewer={member.viewer} onSignOut={auth.signOut} />
}

function ConnectedOnboarding({
  viewer,
  onSignOut,
}: {
  viewer: Extract<ReturnType<typeof useMobileMember>, { status: 'ready' }>['viewer']
  onSignOut: () => Promise<void>
}) {
  const theme = useAppTheme()
  const decision = onboardingDecision(viewer)
  const [usernameInput, setUsernameInput] = useState(() => viewer.username || usernameBaseFromDisplayName(viewer.displayName))
  const [goal, setGoal] = useState<OnboardingGoal>(viewer.onboardingGoal || 'member')
  const [categories, setCategories] = useState<string[]>(viewer.onboardingCategories ?? [])
  const [customCategory, setCustomCategory] = useState('')
  const [categoryError, setCategoryError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [location, setLocation] = useState<ApproximateLocation | null>(() => (
    typeof viewer.approximateLatitude === 'number' && typeof viewer.approximateLongitude === 'number'
      ? { latitude: viewer.approximateLatitude, longitude: viewer.approximateLongitude }
      : null
  ))
  const [locationConsent, setLocationConsent] = useState(Boolean(viewer.approximateLocationConsentedAt))
  const [termsAccepted, setTermsAccepted] = useState(Boolean(viewer.termsAcceptedAt && viewer.termsVersion === termsVersion))
  const [locating, setLocating] = useState(false)
  const [locationMessage, setLocationMessage] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  useAppToastMessage(message)
  const [step, setStep] = useState(0)
  const totalSteps = onboardingTotalSteps(goal)
  const maxStep = onboardingMaxStep(goal)
  const existingApplication = useQuery(mobileApi.companions.myApplication, {})
  const submitApplication = useMutation(mobileApi.companions.submitApplication)
  const [applicationForm, setApplicationForm] = useState<CompanionApplicationForm>(() => (
    defaultOnboardingCompanionForm({ bio: viewer.bio, categories: viewer.onboardingCategories })
  ))
  const [applicationBusy, setApplicationBusy] = useState(false)
  const [applicationError, setApplicationError] = useState<string | null>(null)
  const [applicationSubmitted, setApplicationSubmitted] = useState(false)
  const [customApplicationCategory, setCustomApplicationCategory] = useState('')
  const [customApplicationCategoryError, setCustomApplicationCategoryError] = useState('')
  const hasApplication = hasSubmittedCompanionApplication(existingApplication, applicationSubmitted)
  const applicationLoading = existingApplication === undefined && !applicationSubmitted
  const applicationStatus = hasApplication
    ? onboardingCompanionStatusPresentation(existingApplication, applicationSubmitted)
    : null
  const normalizedUsername = normalizeUsername(usernameInput)
  const validationError = viewer.username ? null : usernameValidationError(normalizedUsername)
  const availability = useQuery(
    mobileApi.users.usernameAvailability,
    !viewer.username && !validationError ? { username: normalizedUsername } : 'skip',
  )
  const claimUsername = useMutation(mobileApi.users.claimUsername)
  const saveOnboardingLocationAndConsent = useMutation(mobileApi.users.saveOnboardingLocationAndConsent)
  const completeOnboarding = useMutation(mobileApi.users.completeOnboarding)
  const updateProfile = useMutation(mobileApi.users.updateProfile)
  const usernameReady = Boolean(viewer.username || (!validationError && availability?.available))
  const availabilityColor = usernameReady
    ? theme.colors.self
    : validationError || availability?.available === false
      ? theme.colors.danger
      : theme.colors.textMuted
  const availabilityMessage = useMemo(() => {
    if (viewer.username) return 'Your permanent username is already set.'
    if (validationError) return validationError
    if (availability === undefined) return 'Checking username availability.'
    if (!availability.available) return availability.validationError || 'That username is already taken.'
    return `@${availability.username} is available.`
  }, [availability, validationError, viewer.username])

  useEffect(() => {
    if (decision === 'complete') router.replace('/profile')
  }, [decision])

  useEffect(() => {
    setStep((current) => clampOnboardingStep(current, goal))
  }, [goal])

  async function requestApproximateLocation() {
    if (locating || submitting || submitted) return
    setLocating(true)
    setLocationMessage('Requesting foreground location permission.')
    try {
      const permission = await Location.requestForegroundPermissionsAsync()
      if (!permission.granted) {
        setLocationMessage('Foreground location permission is required to complete onboarding. You can enable it in device settings and try again.')
        return
      }
      const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
      const rounded = roundLocation({ latitude: current.coords.latitude, longitude: current.coords.longitude })
      setLocation(rounded)
      setLocationMessage('Your approximate area is ready. Your precise device location will not be sent or saved.')
    } catch {
      setLocationMessage('Your location could not be read. Check device location services and try again.')
    } finally {
      setLocating(false)
    }
  }

  async function finishOnboarding() {
    if (!usernameReady || !location || !locationConsent || !termsAccepted || submitting) return
    const categoryResult = goal === 'companion'
      ? validateActivityCategories(categories, maximumOnboardingActivityCategories)
      : null
    if (categoryResult && (!categoryResult.ok || categoryResult.value.length === 0)) {
      setCategoryError(categoryResult.ok ? 'Choose at least one category you would like to offer.' : categoryResult.message)
      return
    }

    setSubmitting(true)
    setMessage(null)
    try {
      if (!viewer.username) await claimUsername({ username: normalizedUsername })
      await saveOnboardingLocationAndConsent({
        ...roundLocation(location),
        locationConsent,
        termsAccepted,
        termsVersion,
      })
      if (categoryResult?.ok) {
        await updateProfile({
          displayName: viewer.displayName,
          ...(viewer.bio !== undefined ? { bio: viewer.bio } : {}),
          onboardingCategories: categoryResult.value,
        })
      }
      await completeOnboarding({ goal })
      setSubmitted(true)
      setMessage('Your welcome guide is complete. Opening your profile.')
    } catch {
      setMessage('Your welcome guide could not be saved. Please review your choices and try again.')
    } finally {
      setSubmitting(false)
    }
  }

  function editApplicationForm(update: (current: CompanionApplicationForm) => CompanionApplicationForm) {
    setApplicationError(null)
    setApplicationForm(update)
  }

  function goToApplicationStep() {
    setApplicationForm((current) => mergeOnboardingCategoriesIntoForm(current, categories))
    setStep(4)
  }

  async function submitOnboardingApplication() {
    if (applicationBusy || submitting || submitted || hasApplication) return
    const validated = validateCompanionApplication(applicationForm)
    if (!validated.ok) {
      setApplicationError(validated.message)
      return
    }
    setApplicationBusy(true)
    setApplicationError(null)
    try {
      await submitApplication(validated.value)
      setApplicationSubmitted(true)
      setMessage('Companion profile sent for review. Complete the welcome guide to continue.')
    } catch {
      setApplicationError('Your Companion profile could not be saved. Review the details and try again.')
    } finally {
      setApplicationBusy(false)
    }
  }

  function addApplicationCustomCategory() {
    const result = validateActivityCategories(
      [...applicationForm.categories, customApplicationCategory],
      maximumCompanionActivityCategories,
    )
    if (!result.ok) {
      setCustomApplicationCategoryError(result.message)
      return
    }
    editApplicationForm((current) => ({ ...current, categories: result.value }))
    setCustomApplicationCategory('')
    setCustomApplicationCategoryError('')
  }

  function addCustomCategory() {
    const result = validateActivityCategories(
      [...categories, customCategory],
      maximumOnboardingActivityCategories,
    )
    if (!result.ok) {
      setCategoryError(result.message)
      return
    }
    setCategories(result.value)
    setCustomCategory('')
    setCategoryError('')
  }

  async function signOutToSwitchAccount() {
    if (submitting || signingOut) return

    setSigningOut(true)
    setMessage(null)
    try {
      await onSignOut()
      router.replace('/auth')
    } catch {
      setMessage('Sign out could not be completed. Please try again.')
      setSigningOut(false)
    }
  }

  return (
    <Screen contentStyle={styles.content} keyboardDismissMode="on-drag">
      <View style={styles.header}>
        <View style={styles.stepRow}>
          <AppText variant="label" color={theme.colors.selfText}>WELCOME GUIDE</AppText>
          <AppText variant="caption" color={theme.colors.textMuted}>Step {step + 1} of {totalSteps}</AppText>
        </View>
        <View accessibilityLabel={`Step ${step + 1} of ${totalSteps}`} style={styles.progressTrack}>
          <View style={[styles.progressValue, { width: `${((step + 1) / totalSteps) * 100}%`, backgroundColor: theme.colors.self }]} />
        </View>
        <AppText variant="display" style={styles.heroTitle}>{['Choose your name.', 'Set your area.', 'Review your privacy.', 'Choose your path.', onboardingCompanionHeroTitle][step]}</AppText>
        <AppText color={theme.colors.textMuted} style={styles.heroCopy}>
          {['Pick the permanent username people will recognize.', 'We use only a rounded area for nearby discovery.', 'Know what is stored before you agree.', 'Find help or share your everyday Strengths.', onboardingCompanionHeroCopy][step]}
        </AppText>
      </View>

      {step === 0 ? <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <AppText variant="heading">Choose your username</AppText>
          <AppText variant="caption" color={theme.colors.textMuted}>
            This is permanent once you claim it.
          </AppText>
        </View>
        <View style={[styles.usernameRow, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <AppText variant="bodyStrong" color={theme.colors.self}>@</AppText>
          <TextInput
            accessibilityLabel="Permanent username"
            autoCapitalize="none"
            autoComplete="username-new"
            autoCorrect={false}
            editable={!viewer.username && !submitting && !submitted}
            maxLength={24}
            onChangeText={setUsernameInput}
            returnKeyType="done"
            selectionColor={theme.colors.self}
            value={viewer.username || usernameInput}
            style={[styles.usernameInput, theme.typography.body, { color: theme.colors.text }]}
          />
        </View>
        <AppText
          accessibilityLiveRegion="polite"
          variant="caption"
          color={availabilityColor}
          style={styles.availability}>
          {availabilityMessage}
        </AppText>
        {!viewer.username && availability && !availability.available && !availability.validationError && (
          <AppText variant="caption" color={theme.colors.textMuted}>
            If this username is yours, sign out below and use the Google account that originally claimed it.
          </AppText>
        )}
      </View> : null}

      {step === 1 ? <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <AppText variant="heading">Add your approximate location</AppText>
          <AppText variant="caption" color={theme.colors.textMuted}>
            We save only a rounded area, never the precise point read from your device.
          </AppText>
        </View>
        <View style={[styles.locationCard, { backgroundColor: theme.colors.surface, borderColor: location ? theme.colors.self : theme.colors.border }]}>
          <AppText variant="bodyStrong">Always-on discovery</AppText>
          <AppText variant="caption" color={theme.colors.textMuted}>
            Your approximate area helps with nearby discovery. Members are never placed on the map. Approved Companions can appear nearby using this rounded area.
          </AppText>
          {location ? (
            <AppText variant="caption" color={theme.colors.selfText}>Approximate area saved</AppText>
          ) : null}
          <ActionButton
            label={locating ? 'Finding approximate location' : location ? 'Refresh approximate location' : 'Use device location'}
            onPress={() => void requestApproximateLocation()}
            intent="self"
            secondary
            disabled={locating || submitting || submitted}
          />
          {locating ? <ActivityIndicator accessibilityLabel="Finding approximate location" color={theme.colors.self} /> : null}
          {locationMessage ? <AppText accessibilityLiveRegion="polite" variant="caption" color={theme.colors.textMuted}>{locationMessage}</AppText> : null}
        </View>
        <ConsentChoice
          label="I consent to Let's Be Friends storing and using my rounded approximate location for always-on discovery as described above."
          checked={locationConsent}
          onPress={() => setLocationConsent((current) => !current)}
          disabled={submitting || submitted}
        />
      </View> : null}

      {step === 2 ? <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <AppText variant="heading">Privacy and community terms</AppText>
          <AppText variant="caption" color={theme.colors.textMuted}>Read this summary before continuing.</AppText>
        </View>
        <View style={[styles.terms, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]} accessible accessibilityLabel={`Terms and Conditions version ${termsVersion}`}>
          <AppText variant="bodyStrong">Terms and Conditions</AppText>
          <AppText variant="caption" color={theme.colors.textMuted}>
            You must provide accurate account information, use discovery and messaging safely, respect boundaries, and follow applicable laws and platform safety rules.
          </AppText>
          <AppText variant="caption" color={theme.colors.textMuted}>
            Your area is rounded before it is saved and used for discovery. Approved Companions can appear in nearby discovery. Exact addresses and precise device location are not stored during onboarding.
          </AppText>
          <AppText variant="caption" color={theme.colors.textMuted}>Version {termsVersion}.</AppText>
        </View>
        <ConsentChoice
          label="I agree to the displayed Terms and Conditions."
          checked={termsAccepted}
          onPress={() => setTermsAccepted((current) => !current)}
          disabled={submitting || submitted}
        />
      </View> : null}

      {step === 3 ? <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <AppText variant="heading">Choose your starting point</AppText>
          <AppText variant="caption" color={theme.colors.textMuted}>
            You can explore either path later.
          </AppText>
        </View>
        <GoalChoice
          label="Find a Companion"
          detail="Find everyday help, friendly company, or someone for a shared plan."
          selected={goal === 'member'}
          onPress={() => setGoal('member')}
          disabled={submitting || submitted}
        />
        <GoalChoice
          label="Become a Companion"
          detail="Share your Strengths, choose what you offer, and earn on your terms."
          selected={goal === 'companion'}
          onPress={() => setGoal('companion')}
          disabled={submitting || submitted}
        />
        {goal === 'companion' ? (
          <View style={styles.categorySection}>
            <View style={styles.sectionHeader}>
              <AppText variant="bodyStrong">What would you like to offer?</AppText>
              <AppText variant="caption" color={theme.colors.textMuted}>Choose up to 6 categories or add your own.</AppText>
            </View>
            <View style={styles.categoryChips}>
              {activityCategoryOptions(categories).map((category) => (
                <Chip
                  key={category}
                  label={category}
                  selected={categories.includes(category)}
                  accent="self"
                  onPress={() => {
                    if (!categories.includes(category) && categories.length >= maximumOnboardingActivityCategories) return
                    setCategoryError('')
                    setCategories((current) => current.includes(category)
                      ? current.filter((value) => value !== category)
                      : [...current, category])
                  }}
                />
              ))}
            </View>
            <TextInput
              accessibilityLabel="Custom onboarding category"
              value={customCategory}
              maxLength={maximumActivityCategoryLength}
              editable={!submitting && !submitted && categories.length < maximumOnboardingActivityCategories}
              returnKeyType="done"
              onChangeText={(value) => { setCustomCategory(value); setCategoryError('') }}
              onSubmitEditing={addCustomCategory}
              placeholder="For example, museum visits"
              placeholderTextColor={theme.colors.textMuted}
              style={[styles.categoryInput, theme.typography.body, { color: theme.colors.text, backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
            />
            <ActionButton
              label="Add category"
              onPress={addCustomCategory}
              intent="self"
              secondary
              disabled={submitting || submitted || categories.length >= maximumOnboardingActivityCategories}
            />
            {categoryError ? <AppText accessibilityRole="alert" variant="caption" color={theme.colors.danger}>{categoryError}</AppText> : null}
          </View>
        ) : null}
      </View> : null}

      {step === 4 && goal === 'companion' ? <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <AppText variant="heading">Submit your Companion profile</AppText>
          <AppText variant="caption" color={theme.colors.textMuted}>
            Applying starts review, and it does not guarantee approval.
          </AppText>
        </View>
        {applicationLoading ? (
          <View style={styles.applicationLoading}>
            <ActivityIndicator accessibilityLabel="Checking your Companion application" color={theme.colors.self} />
            <AppText variant="caption" color={theme.colors.textMuted}>Checking your Companion application.</AppText>
          </View>
        ) : applicationStatus ? (
          <View style={[styles.statusCard, { backgroundColor: theme.colors.selfSoft, borderColor: theme.colors.self }]}>
            <AppText variant="heading">{applicationStatus.label}</AppText>
            <AppText variant="caption" color={theme.colors.textMuted}>{applicationStatus.detail}</AppText>
            <AppText variant="caption" color={theme.colors.textMuted}>{applicationStatus.guidance}</AppText>
            <AppText variant="caption" color={theme.colors.textMuted}>{onboardingCompanionIdentityFollowupCopy}</AppText>
          </View>
        ) : (
          <View style={styles.applicationForm}>
            <View style={styles.sectionHeader}>
              <AppText variant="bodyStrong">Session format</AppText>
            </View>
            <View style={styles.chips}>
              {([
                ['both', 'Online and in-person'],
                ['online', 'Online only'],
                ['in_person', 'In-person only'],
              ] as const).map(([mode, label]) => (
                <Chip
                  key={mode}
                  label={label}
                  selected={applicationForm.mode === mode}
                  accent="self"
                  onPress={() => editApplicationForm((current) => ({ ...current, mode: mode as CompanionMode }))}
                />
              ))}
            </View>
            <View style={styles.fieldGroup}>
              <AppText variant="bodyStrong">How can you help or spend the time?</AppText>
              <TextInput
                accessibilityLabel="How can you help or spend the time"
                value={applicationForm.intro}
                onChangeText={(intro) => editApplicationForm((current) => ({ ...current, intro }))}
                multiline
                maxLength={500}
                editable={!applicationBusy && !submitting && !submitted}
                placeholder="For example, I can join a shopping trip, explain everyday technology, or offer unhurried conversation."
                placeholderTextColor={theme.colors.textMuted}
                style={[styles.input, styles.multiline, theme.typography.body, { color: theme.colors.text, backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
              />
              <AppText variant="caption" color={theme.colors.textMuted}>{applicationForm.intro.length}/500 characters, minimum 40.</AppText>
            </View>
            <View style={styles.fieldGroup}>
              <AppText variant="bodyStrong">Tell members about yourself</AppText>
              <TextInput
                accessibilityLabel="Tell members about yourself"
                value={applicationForm.bio}
                onChangeText={(bio) => editApplicationForm((current) => ({ ...current, bio }))}
                multiline
                maxLength={500}
                editable={!applicationBusy && !submitting && !submitted}
                placeholder={COMPANION_BIO_PLACEHOLDER}
                placeholderTextColor={theme.colors.textMuted}
                style={[styles.input, styles.multiline, theme.typography.body, { color: theme.colors.text, backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
              />
              <AppText variant="caption" color={theme.colors.textMuted}>Optional, up to 500 characters. Shown on your public profile.</AppText>
            </View>
            <View style={styles.fieldGroup}>
              <AppText variant="bodyStrong">Strengths</AppText>
              <AppText variant="caption" color={theme.colors.textMuted}>Choose at least one.</AppText>
              <View style={styles.chips}>
                {friendStrengths.map((strength) => (
                  <Chip
                    key={strength}
                    label={strength}
                    selected={applicationForm.strengths.includes(strength)}
                    accent="self"
                    onPress={() => editApplicationForm((current) => ({
                      ...current,
                      strengths: current.strengths.includes(strength)
                        ? current.strengths.filter((item) => item !== strength)
                        : [...current.strengths, strength],
                    }))}
                  />
                ))}
              </View>
            </View>
            <View style={styles.fieldGroup}>
              <AppText variant="bodyStrong">Everyday help and activities</AppText>
              <AppText variant="caption" color={theme.colors.textMuted}>Choose at least one.</AppText>
              <View style={styles.chips}>
                {activityCategoryOptions(applicationForm.categories).map((category) => (
                  <Chip
                    key={category}
                    label={category}
                    selected={applicationForm.categories.includes(category)}
                    accent="self"
                    onPress={() => {
                      if (!applicationForm.categories.includes(category) && applicationForm.categories.length >= maximumCompanionActivityCategories) return
                      editApplicationForm((current) => ({
                        ...current,
                        categories: current.categories.includes(category)
                          ? current.categories.filter((value) => value !== category)
                          : [...current.categories, category],
                      }))
                    }}
                  />
                ))}
              </View>
              <TextInput
                accessibilityLabel="Custom Companion application category"
                value={customApplicationCategory}
                maxLength={maximumActivityCategoryLength}
                editable={!applicationBusy && !submitting && !submitted && applicationForm.categories.length < maximumCompanionActivityCategories}
                returnKeyType="done"
                onChangeText={(value) => { setCustomApplicationCategory(value); setCustomApplicationCategoryError('') }}
                onSubmitEditing={addApplicationCustomCategory}
                placeholder="For example, museum visits"
                placeholderTextColor={theme.colors.textMuted}
                style={[styles.input, theme.typography.body, { color: theme.colors.text, backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
              />
              <ActionButton
                label="Add category"
                onPress={addApplicationCustomCategory}
                intent="self"
                secondary
                disabled={applicationBusy || submitting || submitted || applicationForm.categories.length >= maximumCompanionActivityCategories}
              />
              {customApplicationCategoryError ? <AppText accessibilityRole="alert" variant="caption" color={theme.colors.danger}>{customApplicationCategoryError}</AppText> : null}
            </View>
            <View style={styles.fieldGroup}>
              <AppText variant="bodyStrong">{applicationForm.mode === 'online' ? 'Timezone or broad region, optional' : 'City'}</AppText>
              <TextInput
                accessibilityLabel={applicationForm.mode === 'online' ? 'Timezone or broad region' : 'City'}
                value={applicationForm.city}
                onChangeText={(city) => editApplicationForm((current) => ({ ...current, city }))}
                editable={!applicationBusy && !submitting && !submitted}
                placeholder={applicationForm.mode === 'online' ? 'For example, Philippines, GMT+8' : 'For example, Cebu City'}
                placeholderTextColor={theme.colors.textMuted}
                style={[styles.input, theme.typography.body, { color: theme.colors.text, backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
              />
            </View>
            <View style={styles.fieldGroup}>
              <AppText variant="bodyStrong">Boundaries, one per line</AppText>
              <TextInput
                accessibilityLabel="Boundaries, one per line"
                value={applicationForm.boundaries}
                onChangeText={(boundaries) => editApplicationForm((current) => ({ ...current, boundaries }))}
                multiline
                editable={!applicationBusy && !submitting && !submitted}
                placeholder="Public places only"
                placeholderTextColor={theme.colors.textMuted}
                style={[styles.input, styles.multiline, theme.typography.body, { color: theme.colors.text, backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
              />
              <AppText variant="caption" color={theme.colors.textMuted}>Clear boundaries help both people plan a comfortable experience.</AppText>
            </View>
            <View style={styles.fieldGroup}>
              <AppText variant="bodyStrong">Why do you want to earn with this community?</AppText>
              <TextInput
                accessibilityLabel="Why do you want to earn with this community"
                value={applicationForm.earningMotivation}
                onChangeText={(earningMotivation) => editApplicationForm((current) => ({ ...current, earningMotivation }))}
                multiline
                maxLength={1000}
                editable={!applicationBusy && !submitting && !submitted}
                placeholder="Share why you want to earn as a Companion. Only the review team reads this."
                placeholderTextColor={theme.colors.textMuted}
                style={[styles.input, styles.multiline, theme.typography.body, { color: theme.colors.text, backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
              />
              <AppText variant="caption" color={theme.colors.textMuted}>Private for the review team. At least 20 characters.</AppText>
            </View>
            <View style={styles.fieldGroup}>
              <AppText variant="bodyStrong">Note for the reviewer, optional</AppText>
              <TextInput
                accessibilityLabel="Note for the reviewer, optional"
                value={applicationForm.applicationNote}
                onChangeText={(applicationNote) => editApplicationForm((current) => ({ ...current, applicationNote }))}
                multiline
                editable={!applicationBusy && !submitting && !submitted}
                placeholder="Anything the review team should know."
                placeholderTextColor={theme.colors.textMuted}
                style={[styles.input, styles.multiline, theme.typography.body, { color: theme.colors.text, backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
              />
            </View>
            <View style={styles.fieldGroup}>
              <AppText variant="bodyStrong">Listed hourly rate in PHP</AppText>
              <TextInput
                accessibilityLabel="Listed hourly rate in PHP"
                value={applicationForm.hourlyRatePesos}
                onChangeText={(hourlyRatePesos) => editApplicationForm((current) => ({ ...current, hourlyRatePesos }))}
                keyboardType="decimal-pad"
                editable={!applicationBusy && !submitting && !submitted}
                placeholder="500"
                placeholderTextColor={theme.colors.textMuted}
                style={[styles.input, theme.typography.body, { color: theme.colors.text, backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
              />
              <AppText variant="caption" color={theme.colors.textMuted}>From PHP 100 to PHP 10,000 per hour.</AppText>
            </View>
            {applicationError ? <AppText accessibilityRole="alert" variant="caption" color={theme.colors.danger}>{applicationError}</AppText> : null}
            <AppText variant="caption" color={theme.colors.textMuted}>{onboardingCompanionReviewNotice}</AppText>
            <ActionButton
              label={applicationBusy ? 'Sending for review' : 'Send profile for review'}
              onPress={() => void submitOnboardingApplication()}
              intent="self"
              icon="send-outline"
              disabled={applicationBusy || submitting || submitted}
            />
            <AppText variant="caption" color={theme.colors.textMuted}>{onboardingCompanionSkipCopy}</AppText>
          </View>
        )}
      </View> : null}

      <View style={styles.actions}>
        {step < 3 ? <ActionButton
          label="Continue"
          onPress={() => setStep((current) => Math.min(current + 1, maxStep))}
          intent="self"
          icon="arrow-forward"
          disabled={(step === 0 && !usernameReady) || (step === 1 && (!location || !locationConsent || locating)) || (step === 2 && !termsAccepted)}
        /> : step === 3 && goal === 'companion' ? <ActionButton
          label="Continue"
          onPress={goToApplicationStep}
          intent="self"
          icon="arrow-forward"
          disabled={!usernameReady || !location || !locationConsent || !termsAccepted || categories.length === 0 || locating || submitting || submitted}
        /> : <ActionButton
          label={submitting || submitted ? 'Saving welcome guide' : 'Complete welcome guide'}
          onPress={() => void finishOnboarding()}
          intent="self"
          disabled={!usernameReady || !location || !locationConsent || !termsAccepted || (goal === 'companion' && categories.length === 0) || locating || submitting || submitted || applicationBusy}
          icon="checkmark-circle-outline"
        />}
        {step > 0 ? <Pressable accessibilityRole="button" accessibilityLabel="Go to previous step" disabled={submitting || submitted} onPress={() => setStep((current) => Math.max(0, current - 1))} style={({ pressed }) => [styles.backLink, pressed && styles.pressed]}><AppIcon name="arrow-back" color={theme.colors.selfText} size={18} /><AppText variant="caption" color={theme.colors.selfText}>Back</AppText></Pressable> : null}
        {step === 0 ? <Pressable
          accessibilityRole="button"
          accessibilityLabel="Sign out and use another account"
          accessibilityHint="Returns to sign in so you can choose a different Google account"
          accessibilityState={{ disabled: submitting || submitted || signingOut }}
          disabled={submitting || submitted || signingOut}
          hitSlop={8}
          onPress={() => void signOutToSwitchAccount()}
          style={({ pressed }) => [styles.signOutLink, pressed && styles.pressed]}>
          {signingOut && <ActivityIndicator accessibilityLabel="Signing out" color={theme.colors.danger} size="small" />}
          <AppText variant="caption" color={theme.colors.danger} style={styles.signOutText}>
            {signingOut ? 'Signing out' : 'Sign out and use another account'}
          </AppText>
        </Pressable> : null}
      </View>
      {(submitting || submitted) && (
        <ActivityIndicator
          accessibilityLabel="Saving welcome guide"
          color={theme.colors.self}
        />
      )}
    </Screen>
  )
}

function ConsentChoice({
  label,
  checked,
  onPress,
  disabled,
}: {
  label: string
  checked: boolean
  onPress: () => void
  disabled: boolean
}) {
  const theme = useAppTheme()
  return (
    <Checkbox
      label={label}
      checked={checked}
      disabled={disabled}
      onChange={onPress}
      style={[
        styles.consent,
        { backgroundColor: checked ? theme.colors.selfSoft : theme.colors.surface, borderColor: checked ? theme.colors.self : theme.colors.border },
      ]}
    />
  )
}

function GoalChoice({
  label,
  detail,
  selected,
  onPress,
  disabled,
}: {
  label: string
  detail: string
  selected: boolean
  onPress: () => void
  disabled: boolean
}) {
  const theme = useAppTheme()
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityHint={detail}
      accessibilityState={{ checked: selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.goal,
        { backgroundColor: selected ? theme.colors.selfSoft : theme.colors.surface, borderColor: selected ? theme.colors.self : theme.colors.border },
        pressed && styles.pressed,
      ]}>
      <View style={[styles.radio, { borderColor: selected ? theme.colors.self : theme.colors.borderStrong }]}>
        {selected && <View style={[styles.radioDot, { backgroundColor: theme.colors.self }]} />}
      </View>
      <View style={styles.goalCopy}>
        <AppText variant="bodyStrong">{label}</AppText>
        <AppText variant="caption" color={theme.colors.textMuted}>{detail}</AppText>
      </View>
    </Pressable>
  )
}

function roundLocation(location: ApproximateLocation): ApproximateLocation {
  return {
    latitude: Math.round(location.latitude * 100) / 100,
    longitude: Math.round(location.longitude * 100) / 100,
  }
}

function OnboardingState({
  title,
  detail,
  loading = false,
  actionLabel,
  onAction,
}: {
  title: string
  detail: string
  loading?: boolean
  actionLabel?: string
  onAction?: () => void
}) {
  const theme = useAppTheme()
  return (
    <Screen contentStyle={styles.state}>
      <AppText variant="label" color={theme.colors.self}>WELCOME GUIDE</AppText>
      <AppText variant="title">{title}</AppText>
      <AppText color={theme.colors.textMuted}>{detail}</AppText>
      {loading && <ActivityIndicator accessibilityLabel="Loading member profile" color={theme.colors.self} />}
      {actionLabel && onAction && <ActionButton label={actionLabel} onPress={onAction} intent="self" />}
    </Screen>
  )
}

const styles = StyleSheet.create({
  content: { paddingBottom: 32 },
  header: { paddingTop: 16, gap: 10 },
  stepRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  progressTrack: { height: 4, overflow: 'hidden', borderRadius: 2, backgroundColor: '#D8D8D8' },
  progressValue: { height: '100%', borderRadius: 2 },
  heroTitle: { fontSize: 38, lineHeight: 40, letterSpacing: -1.2, maxWidth: 360 },
  heroCopy: { fontSize: 15, lineHeight: 22, maxWidth: 340 },
  section: { marginTop: 24, gap: 10 },
  sectionHeader: { gap: 3, marginBottom: 2 },
  usernameRow: { minHeight: 48, borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center' },
  usernameInput: { flex: 1, minHeight: 48, paddingHorizontal: 6 },
  availability: { fontWeight: '600' },
  locationCard: { borderWidth: 1, borderRadius: 16, padding: 14, gap: 10 },
  terms: { borderWidth: 1, borderRadius: 16, padding: 14, gap: 8 },
  consent: { minHeight: 58, borderWidth: 1, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 12, alignItems: 'flex-start', gap: 12 },
  goal: { minHeight: 68, borderWidth: 1, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 12 },
  radio: { width: 22, height: 22, borderWidth: 2, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 10, height: 10, borderRadius: 5 },
  goalCopy: { flex: 1, gap: 1 },
  categorySection: { marginTop: 10, gap: 10 },
  categoryChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  categoryInput: { minHeight: 48, borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10 },
  statusCard: { borderWidth: 1, borderRadius: 16, padding: 14, gap: 10 },
  applicationForm: { gap: 14 },
  applicationLoading: { gap: 10, alignItems: 'center', paddingVertical: 12 },
  fieldGroup: { gap: 8 },
  input: { minHeight: 48, borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10 },
  multiline: { minHeight: 110, textAlignVertical: 'top' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  actions: { marginTop: 24, gap: 3 },
  signOutLink: { minHeight: 44, alignSelf: 'center', paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  backLink: { minHeight: 44, alignSelf: 'center', paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  signOutText: { fontWeight: '600', textAlign: 'center' },
  message: { borderWidth: 1, borderRadius: 16, padding: 14 },
  pressed: { opacity: 0.76 },
  state: { flexGrow: 1, justifyContent: 'center', gap: 16 },
})
