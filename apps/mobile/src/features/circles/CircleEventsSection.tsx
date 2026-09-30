import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker'
import { useMutation, useQuery } from 'convex/react'
import * as ImagePicker from 'expo-image-picker'
import { useState } from 'react'
import { Alert, Platform, StyleSheet, View } from 'react-native'

import { mobileApi, type CircleEventId, type CircleId, type StorageId } from '@/backend/client'
import { ActionButton } from '@/design-system/atoms/ActionButton'
import { TextField } from '@/design-system/atoms/Field'
import { AppText } from '@/design-system/atoms/Typography'
import { InlineNotice } from '@/design-system/molecules/FeedbackState'
import { StateView } from '@/design-system/molecules/StateView'
import { useAppTheme } from '@/theme/ThemeProvider'

import { CircleEventCard } from './CircleEventCard'
import {
  canManageCircleEvents,
  circleActionError,
  groupCircleEventsByDay,
  validateCircleEventDraft,
  validateCircleEventThumbnailAsset,
  type CircleEventItem,
  type CircleEventMode,
} from './circlePresentation'

export function CircleEventsSection({ circleId, canModerate, circleState, readOnly = false }: {
  circleId: CircleId
  canModerate: boolean
  circleState?: 'active' | 'archived' | 'suspended'
  readOnly?: boolean
}) {
  const theme = useAppTheme()
  const events = useQuery(mobileApi.circleEvents.list, { circleId })
  const setState = useMutation(mobileApi.circleEvents.setState)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<CircleEventItem | null>(null)
  const [error, setError] = useState('')
  const canLead = !readOnly && canManageCircleEvents({ canModerate, circleState })

  async function changeState(event: CircleEventItem, state: 'scheduled' | 'cancelled') {
    setError('')
    try {
      await setState({ eventId: event._id as CircleEventId, state })
    } catch (cause) {
      setError(circleActionError(cause, 'The event could not be updated.'))
    }
  }

  if (events === undefined) return <StateView embedded loading title="Loading events" />
  if (events.length === 0 && !canLead) return null
  const groups = groupCircleEventsByDay(events as CircleEventItem[])

  return (
    <View style={styles.section} accessibilityLabel="Circle events">
      <View style={styles.heading}>
        <AppText variant="heading">Upcoming events</AppText>
        <AppText color={theme.colors.textMuted}>{events.length}</AppText>
      </View>
      {error ? <InlineNotice title="Event action failed" tone="danger">{error}</InlineNotice> : null}
      {events.length === 0 && canLead && !formOpen ? (
        <AppText color={theme.colors.textMuted}>No upcoming events yet. Plan the first one.</AppText>
      ) : null}
      {groups.map((group) => (
        <View key={group.key} style={styles.group}>
          <AppText variant="label" color={theme.colors.socialText}>{group.label.toUpperCase()}</AppText>
          {group.events.map((event) => (
            <CircleEventCard
              key={event._id}
              event={event}
              actions={canLead ? (
                <>
                  {event.state === 'scheduled' ? (
                    <ActionButton compact label={`Edit ${event.title}`} intent="neutral" secondary onPress={() => { setEditing(event); setFormOpen(true) }} />
                  ) : null}
                  {event.state === 'scheduled' ? (
                    <ActionButton
                      compact
                      label={`Cancel ${event.title}`}
                      intent="danger"
                      secondary
                      onPress={() => Alert.alert(`Cancel ${event.title}?`, 'Members will still see the event marked as cancelled. You can restore it while its date is still in the future.', [
                        { text: 'Keep event', style: 'cancel' },
                        { text: 'Cancel event', style: 'destructive', onPress: () => void changeState(event, 'cancelled') },
                      ])}
                    />
                  ) : (
                    <ActionButton compact label={`Restore ${event.title}`} intent="neutral" onPress={() => void changeState(event, 'scheduled')} />
                  )}
                </>
              ) : undefined}
            />
          ))}
        </View>
      ))}
      {canLead && !formOpen ? (
        <ActionButton label="Plan event" intent="social" secondary onPress={() => { setEditing(null); setFormOpen(true) }} />
      ) : null}
      {canLead && formOpen ? (
        <CircleEventForm
          circleId={circleId}
          initial={editing}
          onClose={() => { setFormOpen(false); setEditing(null) }}
          onSaved={() => { setFormOpen(false); setEditing(null) }}
        />
      ) : null}
    </View>
  )
}

function CircleEventForm({ circleId, initial, onClose, onSaved }: {
  circleId: CircleId
  initial: CircleEventItem | null
  onClose: () => void
  onSaved: () => void
}) {
  const theme = useAppTheme()
  const generateUploadUrl = useMutation(mobileApi.circleEvents.generateThumbnailUploadUrl)
  const createEvent = useMutation(mobileApi.circleEvents.create)
  const updateEvent = useMutation(mobileApi.circleEvents.update)
  const removeThumbnail = useMutation(mobileApi.circleEvents.removeThumbnail)
  const [title, setTitle] = useState(initial?.title ?? '')
  const [details, setDetails] = useState(initial?.details ?? '')
  const [location, setLocation] = useState(initial?.location ?? '')
  const [mode, setMode] = useState<CircleEventMode>(initial?.mode ?? 'online')
  const [date, setDate] = useState(() => (initial ? new Date(initial.startsAt) : new Date(Date.now() + 24 * 60 * 60 * 1000)))
  const [picker, setPicker] = useState<'date' | 'time' | null>(null)
  const [thumbnailStorageId, setThumbnailStorageId] = useState<string | null>(null)
  const [thumbnailRemoved, setThumbnailRemoved] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  function updateDateTime(event: DateTimePickerEvent, selected?: Date) {
    if (Platform.OS === 'android') setPicker(null)
    if (event.type === 'dismissed' || !selected) return
    setDate(selected)
  }

  async function chooseThumbnail() {
    if (busy) return
    setError('')
    try {
      if (Platform.OS !== 'web') {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync(false)
        if (!permission.granted) {
          setError('Photo access is needed to choose an event thumbnail. You can save the event without one.')
          return
        }
      }
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: false, allowsMultipleSelection: false, quality: 1 })
      if (result.canceled || !result.assets[0]) return
      const asset = result.assets[0]
      const validation = validateCircleEventThumbnailAsset({ type: asset.type, mimeType: asset.mimeType, fileName: asset.fileName, uri: asset.uri, fileSize: asset.fileSize })
      if (!validation.ok) {
        setError(validation.message)
        return
      }
      setBusy(true)
      const response = await fetch(asset.uri)
      if (!response.ok) throw new Error('The selected image could not be read. Choose it again and retry.')
      const bytes = await response.arrayBuffer()
      if (bytes.byteLength <= 0 || bytes.byteLength > 5 * 1024 * 1024) throw new Error('Event thumbnails must be 5 MB or smaller.')
      const uploadUrl = await generateUploadUrl({ circleId })
      const upload = await fetch(uploadUrl, { method: 'POST', headers: { 'Content-Type': validation.contentType }, body: bytes })
      if (!upload.ok) throw new Error('Event thumbnail upload failed.')
      const { storageId } = (await upload.json()) as { storageId: string }
      setThumbnailStorageId(storageId)
      setThumbnailRemoved(false)
    } catch (cause) {
      setError(circleActionError(cause, 'The event thumbnail could not be uploaded.'))
    } finally {
      setBusy(false)
    }
  }

  async function save() {
    if (busy) return
    const draftError = validateCircleEventDraft({ title, details, startsAt: date.getTime(), location })
    if (draftError) {
      setError(draftError)
      return
    }
    setBusy(true)
    setError('')
    try {
      if (initial) {
        await updateEvent({
          eventId: initial._id as CircleEventId,
          title: title.trim(),
          details: details.trim(),
          startsAt: date.getTime(),
          location: location.trim() || undefined,
          mode,
          thumbnailStorageId: (thumbnailStorageId as StorageId | null) ?? undefined,
        })
        if (thumbnailRemoved && !thumbnailStorageId) await removeThumbnail({ eventId: initial._id as CircleEventId })
      } else {
        await createEvent({
          circleId,
          title: title.trim(),
          details: details.trim(),
          startsAt: date.getTime(),
          location: location.trim() || undefined,
          mode,
          thumbnailStorageId: (thumbnailStorageId as StorageId | null) ?? undefined,
        })
      }
      onSaved()
    } catch (cause) {
      setError(circleActionError(cause, 'The event could not be saved.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <View style={[styles.form, { borderColor: theme.colors.border }]} accessibilityLabel={initial ? 'Edit event' : 'Plan event'}>
      <AppText variant="heading">{initial ? 'Edit event' : 'Plan event'}</AppText>
      {error ? <InlineNotice title="Event not saved" tone="danger">{error}</InlineNotice> : null}
      <View style={styles.field}><AppText variant="label">EVENT TITLE</AppText><TextField value={title} maxLength={120} placeholder="Coffee crawl in Cebu City" onChangeText={setTitle} /></View>
      <View style={styles.field}><AppText variant="label">EVENT DETAILS</AppText><TextField multiline value={details} maxLength={2000} placeholder="Share the plan, what to bring, and how to find the group." onChangeText={setDetails} /></View>
      <View style={styles.field}>
        <AppText variant="label">DATE AND TIME</AppText>
        <View style={styles.row}>
          <ActionButton compact label={`Date: ${new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(date)}`} intent="neutral" secondary onPress={() => setPicker('date')} />
          <ActionButton compact label={`Time: ${new Intl.DateTimeFormat('en', { hour: 'numeric', minute: '2-digit' }).format(date)}`} intent="neutral" secondary onPress={() => setPicker('time')} />
        </View>
        {picker ? <DateTimePicker value={date} mode={picker} display="default" minimumDate={new Date()} minuteInterval={15} onChange={updateDateTime} /> : null}
      </View>
      <View style={styles.field}><AppText variant="label">LOCATION</AppText><TextField value={location} maxLength={120} placeholder="Ayala Center Cebu, or online link" onChangeText={setLocation} /><AppText variant="caption" color={theme.colors.textMuted}>Use a public meeting place. Do not enter a home address.</AppText></View>
      <View style={styles.field}>
        <AppText variant="label">SESSION FORMAT</AppText>
        <View style={styles.row}>
          {(['online', 'in_person', 'both'] as const).map((option) => (
            <ActionButton key={option} compact label={option === 'in_person' ? 'In person' : option === 'both' ? 'Both' : 'Online'} intent="social" secondary={mode !== option} onPress={() => setMode(option)} />
          ))}
        </View>
      </View>
      <View style={styles.field}>
        <AppText variant="label">THUMBNAIL</AppText>
        <AppText variant="caption" color={theme.colors.textMuted}>Square JPEG, PNG, or WebP, 5 MB or smaller.</AppText>
        <View style={styles.row}>
          <ActionButton compact label={thumbnailStorageId ? 'Thumbnail selected' : 'Choose thumbnail'} intent="neutral" secondary loading={busy} onPress={() => void chooseThumbnail()} />
          {initial?.thumbnailUrl && !thumbnailStorageId && !thumbnailRemoved ? (
            <ActionButton compact label="Remove thumbnail" intent="danger" secondary disabled={busy} onPress={() => setThumbnailRemoved(true)} />
          ) : null}
        </View>
        {thumbnailRemoved ? <AppText variant="caption" color={theme.colors.textMuted}>The thumbnail will be removed when you save.</AppText> : null}
      </View>
      <View style={styles.row}>
        <ActionButton compact label="Cancel" intent="neutral" secondary disabled={busy} onPress={onClose} />
        <ActionButton compact label={busy ? 'Saving' : initial ? 'Save event' : 'Create event'} intent="social" loading={busy} disabled={!title.trim() || !details.trim()} onPress={() => void save()} />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  section: { gap: 12 },
  heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  group: { gap: 8 },
  form: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 16, padding: 14, gap: 12 },
  field: { gap: 5 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
})
