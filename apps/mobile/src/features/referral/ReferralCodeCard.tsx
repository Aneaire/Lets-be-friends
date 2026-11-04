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
  error,
  notice,
  onSubmit,
  onSkip,
}: {
  busy: boolean
  error: string
  notice: string
  onSubmit: (code: string) => void
  onSkip: () => void
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
        <AppText variant="heading">Have a friend's code?</AppText>
        <AppText variant="caption" color={theme.colors.textMuted}>
          Add it before your first booking. One code per account.
        </AppText>
      </View>
      {displayError ? (
        <AppText accessibilityRole="alert" color={theme.colors.danger}>{displayError}</AppText>
      ) : null}
      {notice ? (
        <AppText accessibilityLiveRegion="polite" color={theme.colors.textMuted}>{notice}</AppText>
      ) : null}
      <TextInput
        accessibilityLabel="Referral code"
        value={code}
        onChangeText={(value) => {
          setCode(value.toUpperCase())
          setLocalError('')
        }}
        placeholder="ABCD1234"
        placeholderTextColor={theme.colors.textMuted}
        autoCapitalize="characters"
        autoCorrect={false}
        maxLength={12}
        editable={!busy}
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
        disabled={!code.trim()}
      />
      <ActionButton
        label="Skip for now"
        onPress={onSkip}
        intent="neutral"
        secondary
        disabled={busy}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 18, padding: 16, gap: 10 },
  copy: { gap: 4 },
  input: { minHeight: 48, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12 },
})
