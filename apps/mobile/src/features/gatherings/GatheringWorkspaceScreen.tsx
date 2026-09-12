import type { FunctionReturnType } from 'convex/server'
import { useMutation, useQuery } from 'convex/react'
import { router, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'

import { api as generatedApi } from '../../../../web/convex/_generated/api'
import { mobileApi, type CircleId, type GatheringId, type UserId } from '@/backend/client'
import { ActionButton } from '@/design-system/atoms/ActionButton'
import { Avatar } from '@/design-system/atoms/Avatar'
import { TextField } from '@/design-system/atoms/Field'
import { AppText } from '@/design-system/atoms/Typography'
import { AppHeader } from '@/design-system/molecules/AppHeader'
import { ConfirmationDialog } from '@/design-system/molecules/ConfirmationDialog'
import { InlineNotice } from '@/design-system/molecules/FeedbackState'
import { StateView } from '@/design-system/molecules/StateView'
import { Screen } from '@/design-system/templates/Screen'
import { useAppToastMessage } from '@/design-system/molecules/AppToast'
import { ReportAction } from '@/features/safety/ReportAction'
import { useAppTheme } from '@/theme/ThemeProvider'
import { density } from '@/theme/tokens'

import {
  canLeaveGathering,
  canRequestGathering,
  formatGatheringDuration,
  formatGatheringWhen,
  gatheringAudienceOptions,
  gatheringModeLabel,
  gatheringParticipantStateLabel,
  gatheringSeatLabel,
  gatheringStateLabel,
  gatheringStatusCopy,
} from './gatheringPresentation'

type GatheringDetail = NonNullable<FunctionReturnType<typeof generatedApi.gatherings.get>>
type Participant = GatheringDetail['participants'][number]

export function GatheringWorkspaceScreen() {
  const params = useLocalSearchParams<{ id: string }>()
  const gatheringId = params.id as GatheringId
  const detail = useQuery(mobileApi.gatherings.get, { gatheringId })

  if (detail === undefined) return <GatheringState loading title="Loading Gathering" />
  return <GatheringDetailView detail={detail} gatheringId={gatheringId} />
}

function GatheringDetailView({ detail, gatheringId }: { detail: GatheringDetail; gatheringId: GatheringId }) {
  const theme = useAppTheme()
  const requestJoin = useMutation(mobileApi.gatherings.requestJoin)
  const leave = useMutation(mobileApi.gatherings.leave)
  const decideParticipant = useMutation(mobileApi.gatherings.decideParticipant)
  const cancelGathering = useMutation(mobileApi.gatherings.cancel)
  const postInvite = useMutation(mobileApi.gatherings.postInvite)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [inviteBody, setInviteBody] = useState('')
  const [audience, setAudience] = useState(detail.circleId ?? 'profile')
  useAppToastMessage(success || error)

  async function run(key: string, action: () => Promise<unknown>, message: string) {
    setBusy(key)
    setError('')
    setSuccess('')
    try {
      await action()
      setSuccess(message)
      return true
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The Gathering action could not be completed.')
      return false
    } finally {
      setBusy('')
    }
  }

  const cancelled = detail.state === 'cancelled'
  const statusCopy = gatheringStatusCopy(detail.viewer)
  const canRequest = canRequestGathering(detail.viewer, detail.state)
  const canLeave = canLeaveGathering(detail.viewer)
  const audiences = gatheringAudienceOptions(detail.circleId)

  return (
    <Screen contentStyle={styles.screen}>
      <AppHeader back title={detail.category} subtitle={`with ${detail.companionDisplayName}`} />

      <View style={[styles.hero, { borderColor: theme.colors.border, backgroundColor: theme.colors.surfaceRaised }]}>
        <View style={styles.heroRow}>
          <AppText variant="heading" color={cancelled ? theme.colors.danger : theme.colors.socialText}>{gatheringStateLabel(detail.state)}</AppText>
          <AppText variant="caption" color={theme.colors.textMuted}>{gatheringSeatLabel(detail.confirmedCount, detail.capacity)}</AppText>
        </View>
        <AppText color={theme.colors.textMuted}>{formatGatheringWhen(detail.startsAt)}</AppText>
        <AppText color={theme.colors.textMuted}>{formatGatheringDuration(detail.durationMinutes)} · {gatheringModeLabel(detail.mode)} · {detail.confirmedCount}/{detail.capacity} confirmed</AppText>
        <AppText variant="caption" color={theme.colors.textMuted}>Hosted by {detail.hostDisplayName}</AppText>
      </View>

      {error ? <InlineNotice title="Gathering action failed" tone="danger">{error}</InlineNotice> : null}
      {statusCopy ? <InlineNotice title="Your place" tone="neutral">{statusCopy}</InlineNotice> : null}
      {cancelled ? <InlineNotice title="Gathering cancelled" tone="danger">This Gathering was cancelled. Reserved host funds are released.</InlineNotice> : null}

      {!cancelled && canRequest ? <ActionButton label={busy === 'join' ? 'Requesting' : 'Request to join'} intent="social" loading={busy === 'join'} onPress={() => void run('join', () => requestJoin({ gatheringId }), 'Request sent to the host.')} /> : null}
      {!cancelled && canLeave ? <ActionButton label={busy === 'leave' ? 'Leaving' : detail.viewer.participantState === 'confirmed' ? 'Leave Gathering' : 'Withdraw request'} intent="neutral" secondary loading={busy === 'leave'} onPress={() => void run('leave', () => leave({ gatheringId }), 'You left the Gathering.')} /> : null}
      {!cancelled && (detail.viewer.isHost || detail.viewer.isCompanion) ? <ActionButton label="Cancel Gathering" intent="danger" secondary onPress={() => setConfirmCancel(true)} /> : null}
      {!cancelled && !detail.viewer.isHost && !detail.viewer.isCompanion ? <ReportAction targetType="gathering" targetId={String(detail._id)} label="Report Gathering" compact /> : null}

      <View style={styles.section}>
        <View style={styles.sectionHeading}>
          <AppText variant="heading">Guests</AppText>
          <AppText variant="caption" color={theme.colors.textMuted}>{detail.confirmedCount} confirmed{detail.viewer.isHost && detail.requestedCount > 0 ? ` · ${detail.requestedCount} waiting` : ''}</AppText>
        </View>
        {detail.participants.length === 0
          ? <AppText color={theme.colors.textMuted}>{detail.viewer.isHost ? 'Share an Invite so members can request a seat.' : 'Confirmed guests will appear here.'}</AppText>
          : detail.participants.map((participant) => (
            <ParticipantRow
              key={participant.userId}
              participant={participant}
              canConfirm={detail.viewer.canConfirm}
              busy={busy === `decide-${participant.userId}`}
              onDecide={(decision) => void run(`decide-${participant.userId}`, () => decideParticipant({ gatheringId, userId: participant.userId as UserId, decision }), decision === 'confirmed' ? 'Guest confirmed.' : decision === 'declined' ? 'Request declined.' : 'Guest removed.')}
            />
          ))}
      </View>

      {detail.viewer.isHost && !cancelled ? (
        <View style={styles.section}>
          <AppText variant="heading">Post an Invite</AppText>
          <TextField multiline value={inviteBody} maxLength={1000} placeholder="Invite people to join this Gathering." onChangeText={setInviteBody} accessibilityLabel="Invite message" />
          <AppText variant="label">AUDIENCE</AppText>
          <View style={styles.wrapRow}>
            {audiences.map((option) => (
              <ActionButton
                key={option.value}
                compact
                label={option.label}
                intent="social"
                secondary={audience !== option.value}
                onPress={() => setAudience(option.value)}
              />
            ))}
          </View>
          <ActionButton
            label={busy === 'invite' ? 'Posting Invite' : 'Post Invite'}
            intent="social"
            loading={busy === 'invite'}
            disabled={!inviteBody.trim() || audience === 'none'}
            onPress={() => void run('invite', () => postInvite({
              gatheringId,
              body: inviteBody.trim(),
              circleId: audience !== 'none' && audience !== 'profile' ? audience as CircleId : undefined,
            }), 'Invite posted.').then((ok) => { if (ok) setInviteBody('') })}
          />
        </View>
      ) : null}

      <ConfirmationDialog
        visible={confirmCancel}
        title="Cancel this Gathering?"
        description="Guests will be notified and any reserved host funds are released. This cannot be undone."
        confirmLabel="Cancel Gathering"
        cancelLabel="Keep Gathering"
        intent="danger"
        busy={busy === 'cancel'}
        onClose={() => setConfirmCancel(false)}
        onConfirm={() => void run('cancel', () => cancelGathering({ gatheringId, reason: 'Cancelled by the host' }), 'Gathering cancelled.').then((ok) => setConfirmCancel(!ok))}
      />
    </Screen>
  )
}

function ParticipantRow({ participant, canConfirm, busy, onDecide }: {
  participant: Participant
  canConfirm: boolean
  busy: boolean
  onDecide: (decision: 'confirmed' | 'declined' | 'removed') => void
}) {
  const theme = useAppTheme()
  return (
    <View style={[styles.participant, { borderColor: theme.colors.border }]}>
      <Avatar uri={participant.profileImageUrl ?? undefined} name={participant.displayName} size={36} />
      <View style={styles.participantCopy}>
        <AppText variant="bodyStrong" numberOfLines={1}>{participant.displayName}</AppText>
        <AppText variant="caption" color={participant.state === 'confirmed' ? theme.colors.socialText : theme.colors.textMuted}>{gatheringParticipantStateLabel(participant.state)}</AppText>
      </View>
      {canConfirm && participant.state !== 'confirmed' ? (
        <View style={styles.participantActions}>
          <ActionButton compact label="Confirm" intent="neutral" disabled={busy} onPress={() => onDecide('confirmed')} />
          <ActionButton compact label="Decline" intent="danger" secondary disabled={busy} onPress={() => onDecide('declined')} />
        </View>
      ) : null}
      {canConfirm && participant.state === 'confirmed' ? (
        <ActionButton compact label="Remove" intent="danger" secondary disabled={busy} onPress={() => onDecide('removed')} />
      ) : null}
    </View>
  )
}

function GatheringState({ loading = false, title, detail, action, onPress }: { loading?: boolean; title: string; detail?: string; action?: string; onPress?: () => void }) {
  return (
    <Screen contentStyle={styles.state}>
      <StateView embedded loading={loading} title={title} detail={detail} actionLabel={action} onAction={onPress ? onPress : () => router.back()} />
    </Screen>
  )
}

const styles = StyleSheet.create({
  screen: { gap: 12 },
  state: { flexGrow: 1, justifyContent: 'center' },
  hero: { gap: 4, borderWidth: 1, borderRadius: density.controlRadius, padding: density.compactCardPadding },
  heroRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  section: { gap: 8, marginTop: 4 },
  sectionHeading: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  participant: { flexDirection: 'row', alignItems: 'center', gap: 8, borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: 8 },
  participantCopy: { flex: 1, minWidth: 0 },
  participantActions: { flexDirection: 'row', gap: 6 },
  wrapRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
})
