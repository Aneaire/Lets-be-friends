import { useState } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native'

import { AppText } from '@/design-system/atoms/Typography'
import { ActionSheet, type ActionSheetItem } from '@/design-system/molecules/ActionSheet'
import {
  digestTimeRow,
  notificationToggleRows,
  quietHoursTimeRows,
  type NotificationPreferenceValues,
  type NotificationTimeField,
  type NotificationTimeRow,
  type NotificationToggleField,
  type NotificationToggleRow,
} from '@/notifications/notificationPreferences'
import { timeOptionLabels } from '@/notifications/preferenceTime'
import { useAppTheme } from '@/theme/ThemeProvider'
import { density, radii } from '@/theme/tokens'

const TIME_PICKER_COPY: Record<NotificationTimeField, { title: string; description: string }> = {
  quietHoursStartMinute: {
    title: 'Quiet hours start',
    description: 'Choose when social notifications pause in your time zone.',
  },
  quietHoursEndMinute: {
    title: 'Quiet hours end',
    description: 'Choose when social notifications resume in your time zone.',
  },
  digestHourMinute: {
    title: 'Daily digest time',
    description: 'Choose when your daily digest arrives in your time zone.',
  },
}

const TIME_OPTIONS = timeOptionLabels()

export function NotificationPreferencesPresentation({
  values,
  savingField = null,
  error = '',
  onToggle,
  onSelectTime,
}: {
  values?: NotificationPreferenceValues
  savingField?: NotificationToggleField | NotificationTimeField | null
  error?: string
  onToggle: (field: NotificationToggleField) => void
  onSelectTime: (field: NotificationTimeField, minute: number) => void
}) {
  const theme = useAppTheme()
  const [pickerField, setPickerField] = useState<NotificationTimeField | null>(null)
  const loading = values === undefined

  const toggleRows = values ? notificationToggleRows(values, savingField) : []
  const quietRows = values ? quietHoursTimeRows(values, savingField) : null
  const digestRow = values ? digestTimeRow(values, savingField) : null

  const pickerItems: ActionSheetItem[] = pickerField
    ? TIME_OPTIONS.map((option) => ({
        label: option.label,
        icon: 'time-outline',
        tone: 'self',
        onPress: () => {
          onSelectTime(pickerField, option.minute)
          setPickerField(null)
        },
      }))
    : []
  const pickerCopy = pickerField ? TIME_PICKER_COPY[pickerField] : null

  return (
    <View
      accessibilityLabel="Notification preferences"
      style={[styles.section, { borderTopColor: theme.colors.border }]}>
      <View style={styles.header}>
        <AppText variant="bodyStrong">Social and Circle updates</AppText>
        <AppText variant="caption" color={theme.colors.textMuted}>
          Choose which social and Circle updates reach you. Booking, message, safety, and account updates always arrive.
        </AppText>
      </View>

      {loading ? (
        <ActivityIndicator
          accessibilityLabel="Loading notification preferences"
          color={theme.colors.selfText}
          style={styles.indicator}
        />
      ) : (
        <>
          {toggleRows.map((row) => (
            <ToggleRow key={row.field} row={row} onPress={() => onToggle(row.field)} />
          ))}

          {quietRows ? (
            <View style={styles.timeGroup}>
              {quietRows.map((row) => (
                <TimeRow key={row.field} row={row} onPress={() => setPickerField(row.field)} />
              ))}
            </View>
          ) : null}

          {digestRow ? (
            <View style={styles.timeGroup}>
              <TimeRow row={digestRow} onPress={() => setPickerField(digestRow.field)} />
            </View>
          ) : null}
        </>
      )}

      {error ? (
        <AppText accessibilityRole="alert" variant="caption" color={theme.colors.danger}>
          {error}
        </AppText>
      ) : null}

      <ActionSheet
        visible={pickerField !== null}
        title={pickerCopy?.title ?? 'Choose a time'}
        description={pickerCopy?.description}
        items={pickerItems}
        onClose={() => setPickerField(null)}
      />
    </View>
  )
}

function ToggleRow({ row, onPress }: { row: NotificationToggleRow; onPress: () => void }) {
  const theme = useAppTheme()

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={row.label}
      accessibilityHint={row.detail}
      accessibilityState={{ checked: row.checked, disabled: row.disabled, busy: row.busy }}
      aria-checked={row.checked}
      disabled={row.disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        { borderBottomColor: theme.colors.border },
        pressed && styles.pressed,
        row.disabled && styles.inactive,
      ]}>
      <View style={styles.copy}>
        <AppText variant="bodyStrong">{row.label}</AppText>
        <AppText variant="caption" color={theme.colors.textMuted}>{row.detail}</AppText>
      </View>
      <SwitchTrack checked={row.checked} />
    </Pressable>
  )
}

/**
 * Visual toggle for the row. The Pressable row owns the accessibility contract
 * so assistive technology sees one switch control, not a nested duplicate.
 */
function SwitchTrack({ checked }: { checked: boolean }) {
  const theme = useAppTheme()

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.track,
        { backgroundColor: checked ? theme.colors.selfControl : theme.colors.borderStrong },
      ]}>
      <View
        style={[
          styles.knob,
          { backgroundColor: theme.colors.background },
          checked ? styles.knobOn : styles.knobOff,
        ]}
      />
    </View>
  )
}

function TimeRow({ row, onPress }: { row: NotificationTimeRow; onPress: () => void }) {
  const theme = useAppTheme()

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={row.accessibilityLabel}
      accessibilityHint="Opens a 30 minute time picker."
      accessibilityState={{ disabled: row.disabled, busy: row.busy }}
      disabled={row.disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        styles.timeRow,
        { borderBottomColor: theme.colors.border },
        pressed && styles.pressed,
        row.disabled && styles.inactive,
      ]}>
      <AppText variant="body">{`${row.label} ${row.timeLabel}`}</AppText>
      <AppText variant="caption" color={theme.colors.selfText}>Change</AppText>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  section: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: density.cardGap,
    marginTop: density.cardGap,
  },
  header: { gap: density.textStackGap },
  indicator: { alignSelf: 'flex-start', marginTop: density.cardGap },
  row: {
    minHeight: density.compactControlHeight,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: density.cardGap,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  timeRow: { paddingLeft: density.compactCardPadding },
  copy: { flex: 1, gap: 2 },
  pressed: { opacity: 0.62 },
  inactive: { opacity: 0.52 },
  timeGroup: { marginTop: density.textStackGap },
  track: {
    width: 46,
    height: 26,
    borderRadius: radii.pill,
    padding: 3,
    justifyContent: 'center',
  },
  knob: { width: 20, height: 20, borderRadius: 10 },
  knobOn: { alignSelf: 'flex-end' },
  knobOff: { alignSelf: 'flex-start' },
})
