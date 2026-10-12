import {
  MAX_POLL_OPTIONS,
  MAX_POLL_OPTION_LENGTH,
  MAX_POLL_QUESTION_LENGTH,
  MIN_POLL_OPTIONS,
  pollValidationError,
} from '@lets-be-friends/shared'
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'

import { AppIcon } from '@/design-system/atoms/AppIcon'
import { TextField } from '@/design-system/atoms/Field'
import { AppText } from '@/design-system/atoms/Typography'
import { useAppTheme } from '@/theme/ThemeProvider'
import { density, radii } from '@/theme/tokens'

export type PollDraft = {
  question: string
  options: string[]
}

export function emptyPollDraft(): PollDraft {
  return { question: '', options: ['', ''] }
}

export type PollComposerProps = {
  value: PollDraft
  onChange: (next: PollDraft) => void
  disabled?: boolean
  style?: StyleProp<ViewStyle>
}

/**
 * Reusable native poll editor. Home and Circle discussions share this
 * component so poll validation stays identical: {@link pollValidationError}
 * is the same shared rule the website and backend enforce. Polls are
 * text-only companions to a post body, so callers must keep media and polls
 * mutually exclusive (see `feedComposer` for the Home gating helpers).
 */
export function PollComposer({ value, onChange, disabled = false, style }: PollComposerProps) {
  const theme = useAppTheme()
  const error = pollValidationError(value)

  function update(next: Partial<PollDraft>) {
    onChange({ ...value, ...next })
  }

  function setOption(index: number, text: string) {
    update({ options: value.options.map((option, current) => (current === index ? text : option)) })
  }

  function addOption() {
    if (value.options.length >= MAX_POLL_OPTIONS) return
    update({ options: [...value.options, ''] })
  }

  function removeOption(index: number) {
    if (value.options.length <= MIN_POLL_OPTIONS) return
    update({ options: value.options.filter((_, current) => current !== index) })
  }

  return (
    <View
      style={[
        styles.composer,
        { borderColor: theme.colors.border, backgroundColor: theme.colors.surface },
        style,
      ]}
    >
      <AppText variant="bodyStrong">Poll</AppText>
      <View style={styles.field}>
        <AppText variant="caption" color={theme.colors.textMuted}>Question</AppText>
        <TextField
          accessibilityLabel="Poll question"
          value={value.question}
          onChangeText={(text) => update({ question: text })}
          placeholder="Ask the community a question"
          maxLength={MAX_POLL_QUESTION_LENGTH}
          editable={!disabled}
        />
        <AppText variant="caption" color={theme.colors.textMuted}>
          {value.question.length}/{MAX_POLL_QUESTION_LENGTH}
        </AppText>
      </View>
      <View style={styles.options}>
        {value.options.map((option, index) => (
          <View key={index} style={styles.optionRow}>
            <View style={styles.optionInput}>
              <TextField
                accessibilityLabel={`Poll option ${index + 1}`}
                value={option}
                onChangeText={(text) => setOption(index, text)}
                placeholder={`Option ${index + 1}`}
                maxLength={MAX_POLL_OPTION_LENGTH}
                editable={!disabled}
              />
            </View>
            {value.options.length > MIN_POLL_OPTIONS ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Remove option ${index + 1}`}
                accessibilityState={{ disabled }}
                disabled={disabled}
                onPress={() => removeOption(index)}
                hitSlop={8}
                style={({ pressed }) => [styles.removeButton, pressed && styles.pressed]}
              >
                <AppIcon name="close" color={theme.colors.text} size={18} />
              </Pressable>
            ) : null}
          </View>
        ))}
      </View>
      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Add poll option"
          accessibilityState={{ disabled: disabled || value.options.length >= MAX_POLL_OPTIONS }}
          disabled={disabled || value.options.length >= MAX_POLL_OPTIONS}
          onPress={addOption}
          style={({ pressed }) => [
            styles.addButton,
            { borderColor: theme.colors.border },
            (disabled || value.options.length >= MAX_POLL_OPTIONS) && styles.disabled,
            pressed && styles.pressed,
          ]}
        >
          <AppIcon name="add" color={theme.colors.socialText} size={16} />
          <AppText variant="caption" color={theme.colors.socialText}>Add option</AppText>
        </Pressable>
        <AppText
          accessibilityRole={error ? 'alert' : undefined}
          variant="caption"
          color={error ? theme.colors.danger : theme.colors.textMuted}
        >
          {error ?? `${value.options.length} of ${MAX_POLL_OPTIONS} options`}
        </AppText>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  composer: {
    borderWidth: 1,
    borderRadius: radii.md,
    padding: density.compactCardPadding,
    gap: density.textStackGap,
  },
  field: {
    gap: 4,
  },
  options: {
    gap: 6,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  optionInput: {
    flex: 1,
  },
  removeButton: {
    width: density.compactControlHeight,
    height: density.compactControlHeight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  addButton: {
    minHeight: density.compactControlHeight,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: radii.sm,
    paddingHorizontal: 10,
  },
  pressed: {
    opacity: 0.68,
  },
  disabled: {
    opacity: 0.5,
  },
})
