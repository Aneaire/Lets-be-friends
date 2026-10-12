import { activeMentionQuery } from '@lets-be-friends/shared'
import { useMutation, useQuery } from 'convex/react'
import * as ImagePicker from 'expo-image-picker'
import { useState } from 'react'
import { Platform, StyleSheet, View } from 'react-native'

import { mobileApi, type CircleId, type PostMediaUploadId, type StorageId } from '@/backend/client'
import { postMediaValidationError } from '@/data/discovery'
import { Checkbox } from '@/design-system/atoms/Field'
import { AppText } from '@/design-system/atoms/Typography'
import { InlineNotice } from '@/design-system/molecules/FeedbackState'
import { PostComposer } from '@/features/social/PostComposer'
import { emptyPollDraft, type PollDraft } from '@/features/social/PollComposer'
import { canPublishFeedPost, feedComposerValidationError, feedPostPollPayload } from '@/features/social/feedComposer'
import { preparePostMedia, uploadPostMedia } from '@/features/social/postMediaUpload'
import { useAppTheme } from '@/theme/ThemeProvider'

import {
  CIRCLE_APPROVAL_NOTICE,
  CIRCLE_APPROVAL_SUBMITTED_NOTICE,
  MAX_CIRCLE_POST_MEDIA,
  circleActionError,
  circleMediaLimitMessage,
  circleMediaSelectionLimit,
  circlePollAnnouncementError,
} from './circlePresentation'

/**
 * Circle discussion composer. Media authoring reuses the shared Home upload
 * pipeline with the Circle three-item limit. Poll creation reuses the shared
 * poll draft, validation, and payload helpers with the controlled
 * PostComposer poll props. Polls are text-only and never announcements.
 */
export function CircleComposer({
  circleId,
  canModerate,
  approvalNotice,
  disabled = false,
  onPublished,
}: {
  circleId: CircleId
  canModerate: boolean
  approvalNotice: boolean
  disabled?: boolean
  onPublished?: (info: { approvalNotice: boolean }) => void
}) {
  const createPost = useMutation(mobileApi.social.createPost)
  const generateMediaUpload = useMutation(mobileApi.social.generatePostMediaUploadUrl)
  const registerMediaUpload = useMutation(mobileApi.social.registerPostMediaUpload)
  const discardMediaUpload = useMutation(mobileApi.social.discardPostMediaUpload)
  const mediaUsage = useQuery(mobileApi.social.mediaUploadUsage, {})
  const [body, setBody] = useState('')
  const [announcement, setAnnouncement] = useState(false)
  const [composerOpen, setComposerOpen] = useState(false)
  const [mediaAssets, setMediaAssets] = useState<ImagePicker.ImagePickerAsset[]>([])
  const [pollOpen, setPollOpen] = useState(false)
  const [pollDraft, setPollDraft] = useState<PollDraft>(emptyPollDraft)
  const [mentionCaret, setMentionCaret] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [submittedNotice, setSubmittedNotice] = useState(false)
  const mentionToken = activeMentionQuery(body, mentionCaret)
  const mentionSuggestions = useQuery(
    mobileApi.social.mentionLookup,
    mentionToken ? { query: mentionToken, circleId } : 'skip',
  )
  const effectiveAnnouncement = canModerate && announcement && !pollOpen

  function togglePoll() {
    if (busy || disabled) return
    setError('')
    if (announcement) {
      setError(circlePollAnnouncementError({ announcement: true, pollOpen: true }) ?? 'Announcements cannot include a poll.')
      return
    }
    // Polls are text-only, so opening a poll discards staged media.
    if (!pollOpen) setMediaAssets([])
    setPollOpen((open) => !open)
  }

  function handleAnnouncementChange(value: boolean) {
    setAnnouncement(value)
    setError('')
    // Announcements never carry a poll.
    if (value) setPollOpen(false)
  }

  async function publish() {
    const text = body.trim()
    const draft = { body, mediaCount: mediaAssets.length, pollOpen, pollDraft }
    const announcementError = circlePollAnnouncementError({ announcement: effectiveAnnouncement, pollOpen })
    if (announcementError) {
      setError(announcementError)
      return
    }
    const composerError = feedComposerValidationError(draft)
    if (busy || disabled || !canPublishFeedPost(draft, busy)) {
      if (composerError) setError(composerError)
      return
    }
    setBusy(true)
    setError('')
    const grantedUploads: Array<{ uploadId: PostMediaUploadId; storageId?: StorageId }> = []
    try {
      if (pollOpen) {
        // Poll-only publishing: no media uploads are granted, so a Circle
        // poll post can never carry photos or video.
        await createPost({
          body: text,
          circleId,
          circleKind: 'discussion',
          poll: feedPostPollPayload(draft),
        })
        setBody('')
        setMediaAssets([])
        setAnnouncement(false)
        setPollDraft(emptyPollDraft())
        setPollOpen(false)
        setComposerOpen(false)
        setSubmittedNotice(approvalNotice)
        onPublished?.({ approvalNotice })
        return
      }
      if (mediaAssets.length > (mediaUsage?.remaining ?? 0)) throw new Error('Daily media quota reached')
      const preparedAssets = await Promise.all(
        mediaAssets.map(async (asset) => {
          const prepared = await preparePostMedia(asset)
          const validationError = postMediaValidationError({ type: asset.type, mimeType: prepared.mimeType, fileSize: prepared.fileSize })
          if (validationError) throw new Error(validationError)
          return prepared
        }),
      )
      const uploadIds: PostMediaUploadId[] = []
      for (const prepared of preparedAssets) {
        const grant = await generateMediaUpload({})
        const granted = { uploadId: grant.uploadId as PostMediaUploadId, storageId: undefined as StorageId | undefined }
        grantedUploads.push(granted)
        const storageId = (await uploadPostMedia(grant.uploadUrl, prepared)) as StorageId
        granted.storageId = storageId
        await registerMediaUpload({ uploadId: granted.uploadId, storageId })
        uploadIds.push(granted.uploadId)
      }
      await createPost({
        body: text,
        circleId,
        circleKind: effectiveAnnouncement ? 'announcement' : 'discussion',
        mediaUploadIds: uploadIds.length ? uploadIds : undefined,
      })
      setBody('')
      setMediaAssets([])
      setAnnouncement(false)
      setPollDraft(emptyPollDraft())
      setPollOpen(false)
      setComposerOpen(false)
      setSubmittedNotice(approvalNotice)
      onPublished?.({ approvalNotice })
    } catch (cause) {
      await Promise.all(grantedUploads.map(({ uploadId, storageId }) => discardMediaUpload({ uploadId, storageId }).catch(() => undefined)))
      const message = cause instanceof Error ? cause.message : ''
      if (message.includes('quota') || message.includes('limit reached')) {
        setError('Your daily community media allowance is used. You can publish without media or try again tomorrow.')
      } else {
        setError(circleActionError(cause, 'Your post could not be published. Please try again.'))
      }
    } finally {
      setBusy(false)
    }
  }

  async function chooseMedia() {
    if (busy || disabled) return
    setError('')
    if (pollOpen) {
      setError('Polls cannot include photos or video. Remove the poll to add media.')
      return
    }
    try {
      const remainingQuota = mediaUsage?.remaining
      if (remainingQuota === undefined) {
        setError('Checking your remaining community media allowance. Please try again in a moment.')
        return
      }
      const selectionLimit = circleMediaSelectionLimit({ selected: mediaAssets.length, remaining: remainingQuota })
      if (selectionLimit <= 0) {
        setError(circleMediaLimitMessage({ selected: mediaAssets.length, remaining: remainingQuota }) ?? 'No more media can be added right now.')
        return
      }
      if (Platform.OS !== 'web') {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync(false)
        if (!permission.granted) {
          setError('Photo access lets you add Circle post media. You can still publish a text post.')
          return
        }
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images', 'videos'],
        allowsEditing: false,
        allowsMultipleSelection: true,
        selectionLimit,
        quality: 0.9,
        videoMaxDuration: 60,
      })
      const selected = result.canceled ? [] : result.assets.slice(0, selectionLimit)
      const invalid = selected.map((asset) => postMediaValidationError({ type: asset.type, mimeType: asset.mimeType, fileSize: asset.fileSize })).find(Boolean)
      if (invalid) {
        setError(invalid)
        return
      }
      if (selected.length) {
        setMediaAssets((current) => [...current, ...selected].slice(0, MAX_CIRCLE_POST_MEDIA))
        setComposerOpen(true)
      }
    } catch {
      setError('Your media library could not be opened. Please try again.')
    }
  }

  function insertMention(username: string) {
    const before = body.slice(0, mentionCaret).replace(/@[a-z0-9_]*$/i, `@${username} `)
    const after = body.slice(mentionCaret)
    const next = before + after
    setBody(next)
    setMentionCaret(before.length)
  }

  return (
    <CircleComposerView
      body={body}
      expanded={composerOpen}
      busy={busy}
      disabled={disabled}
      error={error}
      canModerate={canModerate}
      announcement={announcement}
      approvalNotice={approvalNotice}
      submittedNotice={submittedNotice}
      media={mediaAssets.map((asset) => ({
        key: asset.assetId ?? asset.uri,
        kind: asset.type === 'image' ? 'image' : 'video',
        previewUrl: asset.type === 'image' ? asset.uri : undefined,
      }))}
      remainingUploads={mediaUsage?.remaining}
      mentionSuggestions={mentionToken ? mentionSuggestions ?? [] : []}
      pollOpen={pollOpen}
      pollDraft={pollDraft}
      onPollChange={(next) => {
        setPollDraft(next)
        setError('')
        setSubmittedNotice(false)
      }}
      onTogglePoll={togglePoll}
      onExpand={() => setComposerOpen(true)}
      onBodyChange={(value) => {
        setBody(value)
        setError('')
        setSubmittedNotice(false)
      }}
      onCaretChange={setMentionCaret}
      onChooseMedia={() => void chooseMedia()}
      onRemoveMedia={(index) => setMediaAssets((current) => current.filter((_, itemIndex) => itemIndex !== index))}
      onSelectMention={insertMention}
      onAnnouncementChange={handleAnnouncementChange}
      onPublish={() => void publish()}
    />
  )
}

export function CircleComposerView({
  body,
  expanded,
  busy,
  disabled = false,
  error,
  canModerate,
  announcement,
  approvalNotice,
  submittedNotice,
  media,
  remainingUploads,
  mentionSuggestions = [],
  pollOpen = false,
  pollDraft,
  onPollChange,
  onTogglePoll,
  onExpand,
  onBodyChange,
  onCaretChange,
  onChooseMedia,
  onRemoveMedia,
  onSelectMention,
  onAnnouncementChange,
  onPublish,
}: {
  body: string
  expanded: boolean
  busy: boolean
  disabled?: boolean
  error: string
  canModerate: boolean
  announcement: boolean
  approvalNotice: boolean
  submittedNotice: boolean
  media: Array<{ key: string; kind: string; previewUrl?: string | null }>
  remainingUploads?: number
  mentionSuggestions?: Array<{ userId: string; displayName: string; username: string }>
  pollOpen?: boolean
  pollDraft?: PollDraft
  onPollChange?: (next: PollDraft) => void
  onTogglePoll?: () => void
  onExpand: () => void
  onBodyChange: (value: string) => void
  onCaretChange: (index: number) => void
  onChooseMedia: () => void
  onRemoveMedia: (index: number) => void
  onSelectMention: (username: string) => void
  onAnnouncementChange: (value: boolean) => void
  onPublish: () => void
}) {
  const theme = useAppTheme()
  if (disabled) {
    return (
      <InlineNotice title="Read-only Circle" tone="neutral">
        Posts, comments, reactions, and saves are unavailable while this Circle is archived.
      </InlineNotice>
    )
  }
  return (
    <View style={[styles.panel, { borderColor: theme.colors.border }]}>
      <AppText variant="heading">Start a discussion</AppText>
      {approvalNotice ? (
        <InlineNotice title="Leader approval is on" tone="neutral">
          {CIRCLE_APPROVAL_NOTICE}
        </InlineNotice>
      ) : null}
      <PostComposer
        expanded={expanded}
        body={body}
        busy={busy}
        media={media}
        mediaLimit={MAX_CIRCLE_POST_MEDIA}
        remainingUploads={remainingUploads}
        mentionSuggestions={mentionSuggestions}
        pollOpen={pollOpen}
        pollDraft={pollDraft}
        onPollChange={onPollChange}
        onTogglePoll={announcement ? undefined : onTogglePoll}
        onExpand={onExpand}
        onBodyChange={onBodyChange}
        onCaretChange={onCaretChange}
        onChooseMedia={onChooseMedia}
        onRemoveMedia={onRemoveMedia}
        onSelectMention={onSelectMention}
        onPublish={onPublish}
      />
      {canModerate ? (
        <Checkbox label="Post as an announcement" checked={announcement} disabled={busy} onChange={onAnnouncementChange} />
      ) : null}
      {submittedNotice ? (
        <InlineNotice title="Waiting for leader approval" tone="neutral">
          {CIRCLE_APPROVAL_SUBMITTED_NOTICE}
        </InlineNotice>
      ) : null}
      {error ? (
        <InlineNotice title="Post action failed" tone="danger">
          {error}
        </InlineNotice>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  panel: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 16, padding: 14, gap: 10 },
})
