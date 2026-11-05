import { useState } from 'react'
import { StyleSheet, TextInput, View } from 'react-native'
import {
  normalizeReferralCode,
  referralCodeValidationError,
} from '@lets-be-friends/shared'

import { ActionButton } from '@/design-system/atoms/ActionButton'
import { AppText } from '@/design-system/atoms/Typography'
import { useAppTheme } from '@/theme/ThemeProvider'

export function ReferralCodeCard({
  busy,
  dismissing = false,
  error,
  notice,
  onSubmit,
  onSkip,
  onEdit,
}: {
  busy: boolean
  dismissing?: boolean
  error: string
  notice: string
  onSubmit: (code: string) => void
  onSkip: () => void
  onEdit?: () => void
}) {
  const theme = useAppTheme()
  const [code, setCode] = useState('')
  const [localError, setLocalError] = useState('')
  const displayError = localError || error

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

  return (
    <View style={[styles.card, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}>
      <View style={styles.copy}>
        <AppText variant="heading">Have a friend's code? Optional</AppText>
        <AppText variant="caption" color={theme.colors.textMuted}>
          Add it now to credit your friend. This prompt won't appear again.
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
      <ActionButton
        label="Add referral code"
        onPress={submit}
        intent="social"
        loading={busy}
        disabled={!code.trim() || dismissing}
      />
      <ActionButton
        label="Dismiss"
        onPress={onSkip}
        intent="neutral"
        secondary
        loading={dismissing}
        disabled={busy}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 14, padding: 14, gap: 8 },
  copy: { gap: 4 },
  input: { minHeight: 48, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12 },
})
