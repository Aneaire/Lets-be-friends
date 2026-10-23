import { useState } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'

import { activityCategoryOptions } from '@lets-be-friends/shared'

import { ActionButton } from '@/design-system/atoms/ActionButton'
import { AppIcon } from '@/design-system/atoms/AppIcon'
import { TextField } from '@/design-system/atoms/Field'
import { Chip } from '@/design-system/atoms/Chip'
import { AppText } from '@/design-system/atoms/Typography'
import { Dialog } from '@/design-system/molecules/Dialog'
import { density, radii } from '@/theme/tokens'
import { useAppTheme } from '@/theme/ThemeProvider'

import {
  ACTIVITY_CATEGORY_PAGE_SIZE,
  filterActivityCategories,
  nextActivityCategoryCount,
} from './activityCategoryBrowser'

export function ActivityCategoryBrowser({
  selected,
  onChange,
  maximum,
  disabled = false,
  label = 'Activities',
}: {
  selected: string[]
  onChange: (next: string[]) => void
  maximum: number
  disabled?: boolean
  label?: string
}) {
  const theme = useAppTheme()
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<string[]>(selected)
  const [query, setQuery] = useState('')
  const [visibleCount, setVisibleCount] = useState(ACTIVITY_CATEGORY_PAGE_SIZE)

  const options = activityCategoryOptions(selected)
  const matching = filterActivityCategories(options, query)
  const visible = matching.slice(0, visibleCount)
  const hasMore = visible.length < matching.length

  function openBrowser() {
    if (disabled) return
    setDraft(selected)
    setQuery('')
    setVisibleCount(ACTIVITY_CATEGORY_PAGE_SIZE)
    setOpen(true)
  }

  function closeBrowser() {
    setOpen(false)
  }

  function toggle(value: string) {
    setDraft((current) => {
      if (current.includes(value)) return current.filter((item) => item !== value)
      if (current.length >= maximum) return current
      return [...current, value]
    })
  }

  function updateQuery(value: string) {
    setQuery(value)
    setVisibleCount(ACTIVITY_CATEGORY_PAGE_SIZE)
  }

  function done() {
    onChange(draft)
    closeBrowser()
  }

  return (
    <View style={styles.fieldGroup}>
      <View style={styles.heading}>
        <AppText variant="bodyStrong">{label}</AppText>
        <AppText variant="caption" color={theme.colors.textMuted}>{selected.length} of {maximum} selected</AppText>
      </View>
      {selected.length > 0 ? (
        <View style={styles.chips}>
          {selected.map((value) => (
            <Chip
              key={value}
              label={`${value}  ×`}
              selected
              accent="self"
              accessibilityLabel={`Remove ${value}`}
              onPress={() => !disabled && onChange(selected.filter((item) => item !== value))}
            />
          ))}
        </View>
      ) : (
        <AppText variant="caption" color={theme.colors.textMuted}>No activities selected yet.</AppText>
      )}
      <ActionButton
        label="Browse categories"
        onPress={openBrowser}
        intent="self"
        secondary
        disabled={disabled}
        icon="search-outline"
      />

      <Dialog
        visible={open}
        onClose={closeBrowser}
        closeLabel="Close category browser"
        title="Browse activity categories"
        description={`Choose up to ${maximum}. Search the full list and remove selected activities at any time.`}
        footer={(
          <View style={styles.footer}>
            <ActionButton label="Done" onPress={done} intent="self" />
            <ActionButton label="Cancel" onPress={closeBrowser} intent="neutral" secondary />
          </View>
        )}>
        <View style={styles.browser}>
          <TextField
            accessibilityLabel="Search activity categories"
            value={query}
            onChangeText={updateQuery}
            placeholder="Search categories"
            returnKeyType="search"
          />
          <AppText variant="caption" color={theme.colors.textMuted} accessibilityLiveRegion="polite">
            {matching.length} {matching.length === 1 ? 'category' : 'categories'} found
          </AppText>
          {visible.length > 0 ? (
            <View style={styles.options} accessibilityRole="none">
              {visible.map((value) => {
                const active = draft.includes(value)
                const optionDisabled = !active && draft.length >= maximum
                return (
                  <Pressable
                    key={value}
                    accessibilityRole="checkbox"
                    accessibilityLabel={value}
                    accessibilityState={{ checked: active, disabled: optionDisabled }}
                    disabled={optionDisabled}
                    onPress={() => toggle(value)}
                    style={({ pressed }) => [
                      styles.option,
                      {
                        borderColor: active ? theme.colors.self : theme.colors.border,
                        backgroundColor: active ? theme.colors.selfSoft : theme.colors.surfaceRaised,
                      },
                      optionDisabled && styles.disabled,
                      pressed && styles.pressed,
                    ]}>
                    <AppText style={styles.optionLabel} color={active ? theme.colors.selfText : theme.colors.text}>{value}</AppText>
                    {active ? <AppIcon name="checkmark" size={17} color={theme.colors.selfText} /> : null}
                  </Pressable>
                )
              })}
            </View>
          ) : (
            <View style={styles.empty}>
              <AppText variant="bodyStrong">No matching activities</AppText>
              <AppText color={theme.colors.textMuted}>Try another search or add your own category after closing this window.</AppText>
              <ActionButton label="Reset search" onPress={() => updateQuery('')} intent="neutral" secondary compact />
            </View>
          )}
          {hasMore ? (
            <ActionButton
              label="Load more categories"
              onPress={() => setVisibleCount((count) => nextActivityCategoryCount(count, matching.length))}
              intent="neutral"
              secondary
            />
          ) : matching.length > 0 ? (
            <AppText variant="caption" color={theme.colors.textMuted}>Showing all {matching.length} categories.</AppText>
          ) : null}
          {draft.length >= maximum ? (
            <AppText variant="caption" color={theme.colors.textMuted}>You have selected the maximum of {maximum} activities. Remove one to choose another.</AppText>
          ) : null}
        </View>
      </Dialog>
    </View>
  )
}

const styles = StyleSheet.create({
  fieldGroup: { gap: density.cardGap },
  heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  browser: { gap: density.cardGap },
  options: { gap: 8 },
  option: { minHeight: 46, borderWidth: 1, borderRadius: radii.sm, paddingHorizontal: 12, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 8 },
  optionLabel: { flex: 1, minWidth: 0 },
  disabled: { opacity: 0.48 },
  pressed: { opacity: 0.72 },
  empty: { gap: 6, paddingVertical: 8 },
  footer: { flexDirection: 'row', gap: 8 },
})
