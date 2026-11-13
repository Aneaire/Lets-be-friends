import { useEffect, useState } from 'react'
import { StyleSheet, TextInput, View } from 'react-native'
import {
  normalizeReferralCode,
  referralCodeValidationError,
} from '@lets-be-friends/shared'

import { ActionButton } from '@/design-system/atoms/ActionButton'
import { AppText } from '@/design-system/atoms/Typography'
import { useAppTheme } from '@/theme/ThemeProvider'

export function referralCodeCardValue(initialCode?: string) {
  return normalizeReferralCode(initialCode ?? '')
}

export function ReferralCodeCard({
  busy,
  dismissing = false,
  error,
  notice,
  initialCode,
  autoClaimOnFinish = false,
  onSubmit,
  onSkip,
  onRemove,
  onEdit,
}: {
  busy: boolean
  dismissing?: boolean
  error: string
  notice: string
  initialCode?: string
  autoClaimOnFinish?: boolean
  onSubmit: (code: string) => void
  onSkip: () => void
  onRemove?: () => void
  onEdit?: () => void
}) {
  const theme = useAppTheme()
  const [code, setCode] = useState(() => referralCodeCardValue(initialCode))
  const [localError, setLocalError] = useState('')
  const [removed, setRemoved] = useState(false)
  const displayError = localError || error
  const saved = Boolean(referralCodeCardValue(initialCode)) && !removed

  useEffect(() => {
    if (!initialCode) return
    setCode(referralCodeCardValue(initialCode))
  }, [initialCode])

  function submit() {
    if (busy) return
    const normalized = normalizeReferralCode(code)
    const validationError = referralCodeValidationError(normalized)
    if (validationError) {
      setLocalError(validationError)
      return
    }
    setLocalError('')
    onSubmit(normalized)
  }

  if (saved && autoClaimOnFinish) {
    return (
      <View style={[styles.card, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}>
        <View style={styles.copy}>
          <AppText variant="heading">Have a friend&apos;s code? Saved</AppText>
          <AppText variant="caption" color={theme.colors.textMuted}>
            Saved from the invitation link you opened.
          </AppText>
          <AppText variant="caption" color={theme.colors.textMuted}>
            Your friend earns 5% of the booking subtotal. You pay the normal price.
          </AppText>
        </View>
        <AppText variant="caption" color={theme.colors.textMuted}>
          Invitation {referralCodeCardValue(initialCode)} will be added when you finish setup.
        </AppText>
        <ActionButton
          label="Remove this code"
          onPress={() => {
            setCode('')
            setRemoved(true)
            onRemove?.()
          }}
          intent="neutral"
          secondary
          compact
          style={styles.startAction}
        />
      </View>
    )
  }

  return (
    <View style={[styles.card, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}>
      <View style={styles.copy}>
        <AppText variant="heading">Have a friend's code? {saved ? 'Saved' : 'Optional'}</AppText>
        <AppText variant="caption" color={theme.colors.textMuted}>
          {saved
            ? 'Saved from the invitation link you opened.'
            : "Add it within 30 days of joining and before your first booking. This prompt won't appear again."}
        </AppText>
        <AppText variant="caption" color={theme.colors.textMuted}>
          Your friend earns 5% of the booking subtotal. You pay the normal price.
        </AppText>
      </View>
      {displayError ? (
        <AppText accessibilityRole="alert" color={theme.colors.danger}>{displayError}</AppText>
      ) : null}
      {notice ? (
        <AppText accessibilityLiveRegion="polite" color={theme.colors.textMuted}>{notice}</AppText>
      ) : null}
      <AppText variant="caption" color={theme.colors.textMuted}>Referral code (optional)</AppText>
      <TextInput
        accessibilityLabel="Referral code (optional)"
        accessibilityHint={displayError || undefined}
        value={code}
        onChangeText={(value) => {
          setCode(value.toUpperCase())
          setLocalError('')
          onEdit?.()
        }}
        placeholder="ABCD1234"
        placeholderTextColor={theme.colors.textMuted}
        autoCapitalize="characters"
        autoCorrect={false}
        maxLength={12}
        editable={!busy && !dismissing}
        style={[
          styles.input,
          theme.typography.body,
          {
            color: theme.colors.text,
            backgroundColor: theme.colors.surfaceRaised,
            borderColor: theme.colors.border,
          },
        ]}
      />
      <View style={styles.actions}>
        <ActionButton
          label="Add referral code"
          onPress={submit}
          intent="social"
          compact
          style={styles.action}
          loading={busy}
          loadingLabel="Adding code..."
          disabled={!code.trim() || dismissing}
        />
        <ActionButton
          label={saved ? 'Remove this code' : 'Not now'}
          onPress={() => {
            if (saved) {
              setCode('')
              setRemoved(true)
              onRemove?.()
            } else {
              onSkip()
            }
          }}
          intent="neutral"
          secondary
          compact
          style={styles.action}
          loading={dismissing}
          loadingLabel="Hiding..."
          disabled={busy}
        />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 10, padding: 12, gap: 8 },
  copy: { gap: 4 },
  input: { minHeight: 44, borderWidth: 1, borderRadius: 8, paddingHorizontal: 10 },
  actions: { flexDirection: 'row', gap: 8 },
  startAction: { alignSelf: 'flex-start', paddingHorizontal: 12 },
  action: { flex: 1 },
})
