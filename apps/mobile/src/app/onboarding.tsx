import {
  currentPolicyVersion,
  friendStrengths,
  hasCurrentUnifiedAcceptance,
  maximumActivityCategoryLength,
  maximumCompanionActivityCategories,
  maximumOnboardingActivityCategories,
  normalizeUsername,
  policyDocuments,
  usernameBaseFromDisplayName,
  usernameValidationError,
  validateActivityCategories,
  type PolicyDocument,
} from '@lets-be-friends/shared'
import { useMutation, useQuery } from 'convex/react'
import * as Location from 'expo-location'
import { router } from 'expo-router'
import { useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, Linking, Pressable, StyleSheet, TextInput, View } from 'react-native'

import { useMobileAuth } from '@/auth/MobileAuth'
import { buildMobileWebHandoffUrl, resolveMobileWebAppConfiguration } from '@/backend/config'
import { mobileApi } from '@/backend/client'
import { ActionButton } from '@/design-system/atoms/ActionButton'
import { AppIcon } from '@/design-system/atoms/AppIcon'
import { Chip } from '@/design-system/atoms/Chip'
import { useAppToastMessage } from '@/design-system/molecules/AppToast'
import { Screen } from '@/design-system/templates/Screen'
import { PageSkeleton } from '@/design-system/templates/PageSkeleton'
import { AppText } from '@/design-system/atoms/Typography'
import { ProductMap } from '@/design-system/organisms/ProductMap'
import { useMobileMember } from '@/member/MobileMember'
import { initialOnboardingStep, onboardingDecision } from '@/member/onboarding'
import { ActivityCategoryBrowser } from '@/features/companion/ActivityCategoryBrowser'
import {
  COMPANION_BIO_PLACEHOLDER,
  type CompanionApplicationForm,
  type CompanionMode,
} from '@/data/companionTools'
import {
  clampOnboardingStep,
  defaultOnboardingCompanionForm,
  hasSubmittedCompanionApplication,
  mergeOnboardingCategoriesIntoForm,
  onboardingCompanionIdentityFollowupCopy,
  onboardingCompanionEarningCopy,
  onboardingCompanionJourney,
  onboardingCompanionReviewNotice,
  onboardingCompanionStatusPresentation,
  onboardingMaxStep,
  onboardingMemberJourney,
  onboardingTotalSteps,
} from '@/features/companion/onboardingCompanionApplication'
import {
  FinalizeError,
  finalizeOnboarding,
  onboardingLocationPreview,
  validateOnboardingProfile,
  type FinalizeIntent,
} from '@/features/companion/onboardingFinalization'
import { readDeviceLocation, type DeviceLocationFailureReason } from '@/features/location/deviceLocation'
import { onboardingIdentityPresentation } from '@/features/verification/onboardingIdentityPresentation'
import { useAppTheme } from '@/theme/ThemeProvider'

type OnboardingGoal = 'member' | 'companion'
type ApproximateLocation = { latitude: number; longitude: number }
type MemberVerification = Extract<ReturnType<typeof useMobileMember>, { status: 'ready' }>['verification']

const termsVersion = currentPolicyVersion

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

  return (
    <ConnectedOnboarding
      key={String(member.viewer._id)}
      viewer={member.viewer}
      verification={member.verification}
      onSignOut={auth.signOut}
    />
  )
}

function ConnectedOnboarding({
  viewer,
  verification,
  onSignOut,
}: {
  viewer: Extract<ReturnType<typeof useMobileMember>, { status: 'ready' }>['viewer']
  verification: MemberVerification
  onSignOut: () => Promise<void>
}) {
  const theme = useAppTheme()
  const decision = onboardingDecision(viewer)
  const [usernameInput, setUsernameInput] = useState(() => viewer.username || usernameBaseFromDisplayName(viewer.displayName))
  const [goal, setGoal] = useState<OnboardingGoal>(viewer.onboardingGoal || 'member')
  // Name step state mirrors the web profile step. Existing names hydrate from
  // the saved profile fields, falling back to splitting the display name.
  const existingName = splitExistingName(viewer.displayName)
  const [firstName, setFirstName] = useState(() => viewer.firstName || existingName.firstName)
  const [lastName, setLastName] = useState(() => viewer.lastName || existingName.lastName)
  const [bio, setBio] = useState(() => viewer.bio || '')
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
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [privacyAccepted, setPrivacyAccepted] = useState(false)
  const [locating, setLocating] = useState(false)
  const [locationMessage, setLocationMessage] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  useAppToastMessage(message)
  const [step, setStep] = useState(() => initialOnboardingStep(viewer))
  const totalSteps = onboardingTotalSteps(goal)
  const maxStep = onboardingMaxStep(goal)
  // The final step hands off to the private identity check on web, mirroring
  // the web welcome guide. Member checks return to the profile and Companion
  // checks return to the Companion screen through the fixed deep links.
  const verificationUrl = useMemo(
    () => buildMobileWebHandoffUrl(
      resolveMobileWebAppConfiguration(),
      goal === 'companion'
        ? { intent: 'companion_application', mobileReturn: 'companion' }
        : { intent: 'member', mobileReturn: 'profile' },
    ) ?? null,
    [goal],
  )
  const identity = onboardingIdentityPresentation({
    verificationStatus: viewer.verificationStatus,
    verification,
    identityEligible: viewer.identityEligible,
  })
  const existingApplication = useQuery(mobileApi.companions.myApplication, {})
  const submitApplication = useMutation(mobileApi.companions.submitApplication)
  const [applicationForm, setApplicationForm] = useState<CompanionApplicationForm>(() => (
    defaultOnboardingCompanionForm({ bio: viewer.bio, categories: viewer.onboardingCategories })
  ))
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
  const alreadyAccepted = hasCurrentUnifiedAcceptance(viewer)
  const acceptanceSatisfied = alreadyAccepted || (termsAccepted && privacyAccepted)
  // Previously completed accounts reaccept policies only: no profile work,
  // no category requirements, no submission actions.
  const policyOnly = Boolean(viewer.onboardingCompletedAt)
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
    setLocationMessage('Checking device location permission.')
    try {
      // Permission, the Android accuracy dialog, and the fix are resolved in
      // order so granting access previews the area from one tap.
      const outcome = await readDeviceLocation({
        getPermission: () => Location.getForegroundPermissionsAsync(),
        requestPermission: () => Location.requestForegroundPermissionsAsync(),
        ensureAccurateLocation: () => Location.enableNetworkProviderAsync(),
        getCurrentPosition: (options) => Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced, ...options }),
      })
      if (outcome.status === 'unavailable') {
        setLocationMessage(approximateLocationFailureMessage(outcome.reason))
        return
      }
      // Store the raw fix. The preview below rounds for display, and the
      // server applies its own jitter before storing anything.
      setLocation({ latitude: outcome.coordinates.latitude, longitude: outcome.coordinates.longitude })
      setLocationMessage('Preview ready. Nothing is sent until you accept in the final step. Then the device fix is sent once so the server can store only a randomized, rounded nearby point. The precise fix is not saved.')
    } catch {
      setLocationMessage(approximateLocationFailureMessage('unavailable'))
    } finally {
      setLocating(false)
    }
  }

  async function finishOnboarding(intent: FinalizeIntent = 'complete') {
    if (submitting || submitted) return
    setSubmitting(true)
    setMessage(null)
    setApplicationError(null)
    setCategoryError('')
    try {
      const result = await finalizeOnboarding(intent, {
        viewerUsername: viewer.username,
        usernameReady,
        normalizedUsername,
        location,
        termsAccepted,
        privacyAccepted,
        alreadyAccepted,
        policyOnly,
        goal,
        firstName,
        lastName,
        bio,
        categories,
        applicationForm,
        hasApplication,
        claimUsername: (args) => claimUsername(args),
        saveOnboardingLocationAndConsent: (args) => saveOnboardingLocationAndConsent(args),
        updateProfile: (args) => updateProfile(args),
        submitApplication: (args) => submitApplication(args as never),
        completeOnboarding: (args) => completeOnboarding(args),
        policyVersion: termsVersion,
      })
      if (result.submittedApplication) setApplicationSubmitted(true)
      setSubmitted(true)
      // Approved identities (and submissions where only the safety team can
      // act) finish straight into the app. Everything else opens the private
      // identity check on web, mirroring the web welcome guide. The fixed
      // deep link returns to the matching screen after the check.
      if (identity.approved || identity.action === 'none') {
        setMessage('Your welcome guide is complete. Opening your profile.')
        router.replace('/profile')
        return
      }
      if (!verificationUrl) {
        setMessage('Your welcome guide is complete. Identity verification on the web is unavailable in this build.')
        router.replace('/profile')
        return
      }
      setMessage('Your welcome guide is complete. Opening your private identity check on web.')
      try {
        await Linking.openURL(verificationUrl)
      } catch {
        setMessage('Identity verification on the web could not be opened. Continue it from your verification page later.')
        router.replace('/profile')
      }
    } catch (error) {
      if (error instanceof FinalizeError && (error.code === 'application' || error.code === 'categories')) {
        if (error.code === 'categories') {
          setCategoryError(error.message)
          setStep(2)
        } else {
          setApplicationError(error.message)
        }
        setMessage(error.message)
      } else {
        setMessage(error instanceof Error ? error.message : 'Your welcome guide could not be saved. Please review your choices and try again.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  // The name step validates early so a missing name or member bio never
  // reaches the final step, then hands over to the journey explainer.
  function continueFromProfile() {
    const validation = validateOnboardingProfile({ goal, firstName, lastName, bio })
    if (!validation.ok) {
      setMessage(validation.message)
      return
    }
    setMessage(null)
    setStep(4)
  }

  function goToFinalStep() {
    setApplicationForm((current) => mergeOnboardingCategoriesIntoForm(current, categories))
    setStep(5)
  }

  function editApplicationForm(update: (current: CompanionApplicationForm) => CompanionApplicationForm) {
    setApplicationError(null)
    setApplicationForm(update)
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

  const heroTitle = (
    [
      'Choose your name.',
      'Set your area.',
      'Choose your path.',
      goal === 'companion' ? 'Confirm your name.' : 'Confirm your public profile.',
      goal === 'companion' ? 'How helping and earning works.' : 'What happens before you meet.',
      'Review and accept.',
    ] as const
  )[step]
  const heroCopy = (
    [
      'Pick the permanent username people will recognize.',
      'Preview only a rounded area. Nothing is saved until the final step.',
      'Find help or share your everyday Strengths.',
      goal === 'companion'
        ? 'Add the name members will see. You will add your introduction and activities in the Companion profile step.'
        : 'Add the name and short introduction you want members to see. A profile photo can be added later from Profile.',
      'Read through what happens next. Nothing here is saved yet.',
      'Read the Terms and Privacy Policy, agree to both, then finish.',
    ] as const
  )[step]

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
        <AppText variant="display" style={styles.heroTitle}>{heroTitle}</AppText>
        <AppText color={theme.colors.textMuted} style={styles.heroCopy}>
          {heroCopy}
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
          <AppText variant="heading">Preview your approximate location</AppText>
          <AppText variant="caption" color={theme.colors.textMuted}>
            Use your device location to preview your rounded area.
          </AppText>
        </View>
        <View style={[styles.locationCard, { backgroundColor: theme.colors.surface, borderColor: location ? theme.colors.self : theme.colors.border }]}>
          <AppText variant="bodyStrong">Preview your discovery area</AppText>
          {location ? (
            <AppText variant="caption" color={theme.colors.selfText}>
              Approximate preview {onboardingLocationPreview(location).latitude.toFixed(2)}, {onboardingLocationPreview(location).longitude.toFixed(2)}
            </AppText>
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
        {location ? <View style={styles.mapFrame}>
          <ProductMap
            center={onboardingLocationPreview(location)}
            mapLabel="Your approximate discovery area"
          />
          <AppText variant="caption" color={theme.colors.textMuted}>
            This shows a general area, not an address or meeting point.
          </AppText>
        </View> : null}
      </View> : null}

      {step === 2 ? <View style={styles.section}>
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
            <ActivityCategoryBrowser
              selected={categories}
              onChange={(next) => {
                setCategoryError('')
                setCategories(next)
              }}
              maximum={maximumOnboardingActivityCategories}
              disabled={submitting || submitted}
              label="What would you like to offer?"
            />
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

      {step === 3 ? <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <AppText variant="heading">Public profile</AppText>
          <AppText variant="caption" color={theme.colors.textMuted}>
            Members see your name in list, booking, and messaging contexts.
          </AppText>
        </View>
        <View style={styles.nameRow}>
          <TextInput
            accessibilityLabel="First name"
            autoCapitalize="words"
            autoComplete="given-name"
            editable={!submitting && !submitted}
            maxLength={40}
            onChangeText={setFirstName}
            placeholder="First name"
            placeholderTextColor={theme.colors.textMuted}
            value={firstName}
            style={[styles.input, theme.typography.body, { color: theme.colors.text, backgroundColor: theme.colors.surface, borderColor: theme.colors.border, flex: 1 }]}
          />
          <TextInput
            accessibilityLabel="Last name"
            autoCapitalize="words"
            autoComplete="family-name"
            editable={!submitting && !submitted}
            maxLength={40}
            onChangeText={setLastName}
            placeholder="Last name"
            placeholderTextColor={theme.colors.textMuted}
            value={lastName}
            style={[styles.input, theme.typography.body, { color: theme.colors.text, backgroundColor: theme.colors.surface, borderColor: theme.colors.border, flex: 1 }]}
          />
        </View>
        {goal !== 'companion' ? <View style={styles.fieldGroup}>
          <AppText variant="bodyStrong">Bio, required</AppText>
          <TextInput
            accessibilityLabel="Public bio"
            editable={!submitting && !submitted}
            maxLength={500}
            multiline
            onChangeText={setBio}
            placeholder="For example: I can help you practice a new language, and I make everyday errands more fun."
            placeholderTextColor={theme.colors.textMuted}
            value={bio}
            style={[styles.input, styles.multiline, theme.typography.body, { color: theme.colors.text, backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
          />
          <AppText variant="caption" color={theme.colors.textMuted}>{bio.length}/500 characters.</AppText>
        </View> : null}
      </View> : null}

      {step === 4 ? <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <AppText variant="heading">{goal === 'companion' ? 'How helping and earning works' : 'What happens before you meet'}</AppText>
          <AppText variant="caption" color={theme.colors.textMuted}>
            Nothing here is saved yet.
          </AppText>
        </View>
        <View style={styles.journey}>
          {(goal === 'companion' ? onboardingCompanionJourney : onboardingMemberJourney).map(([title, copy], index) => (
            <View
              key={title}
              style={[styles.journeyItem, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
              <AppText variant="label" color={theme.colors.selfText}>{String(index + 1).padStart(2, '0')}</AppText>
              <View style={styles.journeyCopy}>
                <AppText variant="bodyStrong">{title}</AppText>
                <AppText variant="caption" color={theme.colors.textMuted}>{copy}</AppText>
              </View>
            </View>
          ))}
        </View>
      </View> : null}

      {step === 5 ? <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <AppText variant="heading">Privacy and community terms</AppText>
          <AppText variant="caption" color={theme.colors.textMuted}>Read the Terms and Privacy Policy, agree to both, then finish.</AppText>
        </View>
        <View style={[styles.statusCard, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}>
          <AppText variant="bodyStrong">{identity.finishActionLabel === 'Finish setup' ? 'You are verified and ready.' : 'Next: identity verification'}</AppText>
          <AppText variant="caption" color={theme.colors.textMuted}>{identity.lede}</AppText>
          <AppText variant="caption" color={theme.colors.textMuted}>{onboardingCompanionIdentityFollowupCopy}</AppText>
          {goal === 'companion' ? (
            <AppText variant="caption" color={theme.colors.textMuted}>{onboardingCompanionEarningCopy}</AppText>
          ) : null}
        </View>
        {policyOnly ? (
          <View style={[styles.terms, { borderColor: theme.colors.self, backgroundColor: theme.colors.selfSoft }]}>
            <AppText variant="bodyStrong">Your welcome guide is already complete</AppText>
            <AppText variant="caption" color={theme.colors.textMuted}>Accepting again keeps your account setup intact and preserves your original acceptance date.</AppText>
          </View>
        ) : null}
        {goal === 'companion' && !policyOnly ? (
          <View style={styles.applicationForm}>
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
              </View>
            ) : (
              <>
                <View style={styles.sectionHeader}>
                  <AppText variant="bodyStrong">Set up your Companion profile</AppText>
                  <AppText variant="caption" color={theme.colors.textMuted}>Saving happens only after you accept below.</AppText>
                </View>
                <View style={styles.fieldGroup}>
                  <AppText variant="bodyStrong">Session format</AppText>
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
                </View>
                <View style={styles.fieldGroup}>
                  <AppText variant="bodyStrong">How can you help or spend the time?</AppText>
                  <TextInput
                    accessibilityLabel="How can you help or spend the time"
                    value={applicationForm.intro}
                    onChangeText={(intro) => editApplicationForm((current) => ({ ...current, intro }))}
                    multiline
                    maxLength={500}
                    editable={!submitting && !submitted}
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
                    onChangeText={(value) => editApplicationForm((current) => ({ ...current, bio: value }))}
                    multiline
                    maxLength={500}
                    editable={!submitting && !submitted}
                    placeholder={COMPANION_BIO_PLACEHOLDER}
                    placeholderTextColor={theme.colors.textMuted}
                    style={[styles.input, styles.multiline, theme.typography.body, { color: theme.colors.text, backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
                  />
                  <AppText variant="caption" color={theme.colors.textMuted}>Required, up to 500 characters. Shown on your public profile.</AppText>
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
                  <ActivityCategoryBrowser
                    selected={applicationForm.categories}
                    onChange={(nextCategories) => editApplicationForm((current) => ({ ...current, categories: nextCategories }))}
                    maximum={maximumCompanionActivityCategories}
                    disabled={submitting || submitted}
                    label="Everyday help and activities"
                  />
                  <TextInput
                    accessibilityLabel="Custom Companion application category"
                    value={customApplicationCategory}
                    maxLength={maximumActivityCategoryLength}
                    editable={!submitting && !submitted && applicationForm.categories.length < maximumCompanionActivityCategories}
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
                    disabled={submitting || submitted || applicationForm.categories.length >= maximumCompanionActivityCategories}
                  />
                  {customApplicationCategoryError ? <AppText accessibilityRole="alert" variant="caption" color={theme.colors.danger}>{customApplicationCategoryError}</AppText> : null}
                </View>
                <View style={styles.fieldGroup}>
                  <AppText variant="bodyStrong">{applicationForm.mode === 'online' ? 'Timezone or broad region, optional' : 'City'}</AppText>
                  <TextInput
                    accessibilityLabel={applicationForm.mode === 'online' ? 'Timezone or broad region' : 'City'}
                    value={applicationForm.city}
                    onChangeText={(city) => editApplicationForm((current) => ({ ...current, city }))}
                    editable={!submitting && !submitted}
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
                    editable={!submitting && !submitted}
                    placeholder="Public places only"
                    placeholderTextColor={theme.colors.textMuted}
                    style={[styles.input, styles.multiline, theme.typography.body, { color: theme.colors.text, backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
                  />
                  <AppText variant="caption" color={theme.colors.textMuted}>Clear boundaries help both people plan a comfortable experience.</AppText>
                </View>
                <View style={styles.fieldGroup}>
                  <AppText variant="bodyStrong">Additional note, optional</AppText>
                  <TextInput
                    accessibilityLabel="Additional note, optional"
                    value={applicationForm.applicationNote}
                    onChangeText={(applicationNote) => editApplicationForm((current) => ({ ...current, applicationNote }))}
                    multiline
                    editable={!submitting && !submitted}
                    placeholder="Anything else to share about your offer."
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
                    editable={!submitting && !submitted}
                    placeholder="500"
                    placeholderTextColor={theme.colors.textMuted}
                    style={[styles.input, theme.typography.body, { color: theme.colors.text, backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
                  />
                  <AppText variant="caption" color={theme.colors.textMuted}>From PHP 30 to PHP 10,000 per hour.</AppText>
                </View>
                {applicationError ? <AppText accessibilityRole="alert" variant="caption" color={theme.colors.danger}>{applicationError}</AppText> : null}
                <AppText variant="caption" color={theme.colors.textMuted}>{onboardingCompanionReviewNotice}</AppText>
              </>
            )}
          </View>
        ) : null}
        <View style={[styles.terms, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]} accessible accessibilityLabel={`Policy documents version ${termsVersion}`}>
          <AppText variant="bodyStrong">Two documents, one version</AppText>
          <AppText variant="caption" color={theme.colors.textMuted}>Version {termsVersion}. The full text lives on the dedicated pages linked below.</AppText>
        </View>
        {alreadyAccepted ? (
          <View style={[styles.terms, { borderColor: theme.colors.self, backgroundColor: theme.colors.selfSoft }]}>
            <AppText variant="bodyStrong">Already accepted (version {termsVersion})</AppText>
            <AppText variant="caption" color={theme.colors.textMuted}>No need to accept again. Finishing keeps your original acceptance date.</AppText>
            <PolicyLinks />
          </View>
        ) : (
          <>
            {policyDocuments.map((document) => (
              <LinkedConsentChoice
                key={document.id}
                document={document}
                checked={document.id === 'terms' ? termsAccepted : privacyAccepted}
                onToggle={() => {
                  if (document.id === 'terms') setTermsAccepted((current) => !current)
                  else setPrivacyAccepted((current) => !current)
                }}
                disabled={submitting || submitted}
              />
            ))}
          </>
        )}
      </View> : null}

      <View style={styles.actions}>
        {step < 4 ? <ActionButton
          label="Continue"
          onPress={() => setStep((current) => Math.min(current + 1, maxStep))}
          intent="self"
          icon="arrow-forward"
          disabled={(step === 0 && !usernameReady) || (step === 1 && (!location || locating)) || (step === 2 && goal === 'companion' && !policyOnly && categories.length === 0)}
        /> : step === 3 ? <ActionButton
          label="Continue"
          onPress={continueFromProfile}
          intent="self"
          icon="arrow-forward"
          disabled={submitting || submitted}
        /> : step === 4 ? <ActionButton
          label="Continue to review"
          onPress={goToFinalStep}
          intent="self"
          icon="arrow-forward"
          disabled={submitting || submitted}
        /> : !policyOnly && goal === 'companion' && !hasApplication ? <ActionButton
          label={
            submitting || submitted
              ? 'Saving welcome guide'
              : identity.approved || identity.action === 'none'
                ? 'Save Companion profile and finish'
                : 'Save and verify identity'
          }
          onPress={() => void finishOnboarding('submit-profile')}
          intent="self"
          disabled={!usernameReady || !location || !acceptanceSatisfied || categories.length === 0 || locating || submitting || submitted}
          icon="checkmark-circle-outline"
        /> : <ActionButton
          label={submitting || submitted ? 'Saving welcome guide' : identity.approved || identity.action === 'none' ? 'Finish setup' : 'Accept and complete'}
          onPress={() => void finishOnboarding('complete')}
          intent="self"
          disabled={!usernameReady || !location || !acceptanceSatisfied || (goal === 'companion' && !policyOnly && !hasApplication && categories.length === 0) || locating || submitting || submitted}
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

function PolicyLinks() {
  const theme = useAppTheme()
  return (
    <View style={styles.policyLinks}>
      {policyDocuments.map((document) => (
        <Pressable
          key={document.id}
          accessibilityRole="link"
          accessibilityLabel={document.title}
          onPress={() => router.push(document.path)}
          style={({ pressed }) => [pressed && styles.pressed]}>
          <AppText variant="caption" style={[styles.linkedConsentLink, { color: theme.colors.selfText }]}>{document.title}</AppText>
        </Pressable>
      ))}
    </View>
  )
}

function LinkedConsentChoice({
  document,
  checked,
  onToggle,
  disabled,
}: {
  document: PolicyDocument
  checked: boolean
  onToggle: () => void
  disabled: boolean
}) {
  const theme = useAppTheme()
  return (
    <View
      style={[
        styles.linkedConsent,
        { backgroundColor: checked ? theme.colors.selfSoft : theme.colors.surface, borderColor: checked ? theme.colors.self : theme.colors.border },
      ]}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityLabel={document.acceptanceLabel}
        accessibilityState={{ checked, disabled }}
        disabled={disabled}
        onPress={onToggle}
        style={styles.linkedConsentBoxWrap}>
        <View style={[styles.linkedConsentBox, { borderColor: checked ? theme.colors.self : theme.colors.borderStrong, backgroundColor: checked ? theme.colors.self : 'transparent' }]}>
          {checked ? <AppIcon name="checkmark" color={theme.colors.accentText} size={15} /> : null}
        </View>
      </Pressable>
      <AppText style={styles.linkedConsentText}>
        {document.acceptancePrefix}
        <AppText
          accessibilityRole="link"
          accessibilityLabel={document.title}
          onPress={() => router.push(document.path)}
          style={[styles.linkedConsentLink, { color: theme.colors.selfText }]}>
          {document.title}
        </AppText>
      </AppText>
    </View>
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

// Mirrors the web welcome guide name hydration. Comma-style display names put
// the last name first; otherwise the final word is the last name.
function splitExistingName(displayName: string) {
  const name = displayName.trim()
  if (name.includes(',')) {
    const [lastName, ...firstParts] = name.split(',')
    return { firstName: firstParts.join(',').trim(), lastName: lastName.trim() }
  }
  const parts = name.split(/\s+/)
  if (parts.length < 2) return { firstName: name, lastName: '' }
  return { firstName: parts.slice(0, -1).join(' '), lastName: parts.at(-1) ?? '' }
}

// The welcome guide needs a location to continue, so each outcome explains the
// exact permission or device setting that is blocking the preview.
function approximateLocationFailureMessage(reason: DeviceLocationFailureReason): string {
  switch (reason) {
    case 'permission_denied':
      return 'Device location permission is needed to preview your area. Allow it and try again.'
    case 'permission_blocked':
      return 'Device location is off for this app. Enable it in device settings, then try again.'
    case 'accuracy_declined':
      return 'Location Accuracy is off, so your device could not provide a location. Turn it on and try again.'
    default:
      return 'Your location could not be read. Check device location services and try again.'
  }
}

const styles = StyleSheet.create({
  content: { paddingBottom: 32 },
  header: { paddingTop: 16, gap: 10 },
  stepRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  progressTrack: { height: 4, overflow: 'hidden', borderRadius: 2, backgroundColor: '#D8D8D8' },
  progressValue: { height: '100%', borderRadius: 2 },
  heroTitle: { maxWidth: 360 },
  heroCopy: { maxWidth: 340 },
  section: { marginTop: 24, gap: 10 },
  sectionHeader: { gap: 3, marginBottom: 2 },
  usernameRow: { minHeight: 48, borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center' },
  usernameInput: { flex: 1, minHeight: 48, paddingHorizontal: 6 },
  availability: { fontWeight: '600' },
  locationCard: { borderWidth: 1, borderRadius: 16, padding: 14, gap: 10 },
  mapFrame: { gap: 8 },
  terms: { borderWidth: 1, borderRadius: 16, padding: 14, gap: 8 },
  consent: { minHeight: 58, borderWidth: 1, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 12, alignItems: 'flex-start', gap: 12 },
  linkedConsent: { minHeight: 58, borderWidth: 1, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 12, flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  linkedConsentBoxWrap: { paddingVertical: 2 },
  linkedConsentBox: { width: 22, height: 22, borderWidth: 1, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  linkedConsentText: { flex: 1, minWidth: 0 },
  linkedConsentLink: { textDecorationLine: 'underline', fontWeight: '700' },
  policyLinks: { flexDirection: 'row', gap: 16, marginTop: 8 },
  goal: { minHeight: 68, borderWidth: 1, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 12 },
  radio: { width: 22, height: 22, borderWidth: 2, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 10, height: 10, borderRadius: 5 },
  goalCopy: { flex: 1, gap: 1 },
  nameRow: { flexDirection: 'row', gap: 10 },
  fieldGroup: { gap: 8 },
  journey: { gap: 10 },
  journeyItem: { minHeight: 72, borderWidth: 1, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 12, flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  journeyCopy: { flex: 1, gap: 2 },
  categorySection: { marginTop: 10, gap: 10 },
  categoryInput: { minHeight: 48, borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10 },
  statusCard: { borderWidth: 1, borderRadius: 16, padding: 14, gap: 10 },
  applicationForm: { gap: 14 },
  applicationLoading: { gap: 10, alignItems: 'center', paddingVertical: 12 },
  input: { minHeight: 48, borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10 },
  multiline: { minHeight: 110, textAlignVertical: 'top' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  actions: { marginTop: 24, gap: 3 },
  finalActions: { gap: 10 },
  signOutLink: { minHeight: 44, alignSelf: 'center', paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  backLink: { minHeight: 44, alignSelf: 'center', paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  signOutText: { fontWeight: '600', textAlign: 'center' },
  message: { borderWidth: 1, borderRadius: 16, padding: 14 },
  pressed: { opacity: 0.76 },
  state: { flexGrow: 1, justifyContent: 'center', gap: 16 },
})
